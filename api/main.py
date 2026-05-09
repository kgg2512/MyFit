"""
MyFit API Server — Free Tier (Render.com)
G2 Company Ltd. | CTO Agent
"""

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import mediapipe as mp
import cv2
import numpy as np
import json
import tempfile
import os

app = FastAPI(title="MyFit API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

pose_detector = mp.solutions.pose.Pose(static_image_mode=True, model_complexity=1)


def extract_keypoints(img_bytes: bytes) -> dict | None:
    arr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return None
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    result = pose_detector.process(rgb)
    if not result.pose_landmarks:
        return None
    h, w = img.shape[:2]
    lm = result.pose_landmarks.landmark
    mapping = {
        "nose": 0, "left_shoulder": 11, "right_shoulder": 12,
        "left_hip": 23, "right_hip": 24,
        "left_ankle": 27, "right_ankle": 28,
        "left_elbow": 13, "right_elbow": 14,
        "left_wrist": 15, "right_wrist": 16
    }
    return {
        "size": (w, h),
        "points": {k: {"x": lm[v].x * w, "y": lm[v].y * h} for k, v in mapping.items()}
    }


def calculate_measurements(front: dict, side: dict, height_cm: float) -> dict:
    fp = front["points"]
    sp = side["points"]
    ref_px = abs(fp["nose"]["y"] - fp["left_ankle"]["y"])

    def to_cm(px): return (px / ref_px) * height_cm
    def dist(a, b): return abs(a["x"] - b["x"])
    def ellipse(w, d):
        a, b = w / 2, d / 2
        return np.pi * (3*(a+b) - np.sqrt((3*a+b)*(a+3*b)))

    shoulder_cm = to_cm(dist(fp["left_shoulder"], fp["right_shoulder"]))
    hip_w_cm    = to_cm(dist(fp["left_hip"], fp["right_hip"]))
    chest_d_cm  = to_cm(abs(sp["left_shoulder"]["x"] - sp["left_hip"]["x"]) * 0.85)
    inseam_cm   = to_cm(abs(fp["left_hip"]["y"] - fp["left_ankle"]["y"]))
    arm_cm      = to_cm(
        abs(fp["left_shoulder"]["y"] - fp["left_elbow"]["y"]) +
        abs(fp["left_elbow"]["y"] - fp["left_wrist"]["y"])
    )

    return {
        "height_cm": height_cm,
        "shoulder_width_cm": round(shoulder_cm, 1),
        "chest_cm": round(ellipse(shoulder_cm * 0.95, chest_d_cm), 1),
        "waist_cm": round(ellipse(shoulder_cm * 0.72, chest_d_cm * 0.78), 1),
        "hip_cm":   round(ellipse(hip_w_cm, chest_d_cm * 0.92), 1),
        "inseam_cm": round(inseam_cm, 1),
        "arm_length_cm": round(arm_cm, 1),
    }


@app.get("/")
def root():
    return {"service": "MyFit API", "status": "online", "version": "0.1.0"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze/body")
async def analyze_body(
    front: UploadFile = File(...),
    side: UploadFile = File(...),
    back: UploadFile = File(...),
    height_cm: float = Form(...)
):
    front_kp = extract_keypoints(await front.read())
    side_kp  = extract_keypoints(await side.read())

    if not front_kp or not side_kp:
        return {"error": "키포인트 추출 실패. 사진을 다시 찍어주세요.", "success": False}

    measurements = calculate_measurements(front_kp, side_kp, height_cm)
    return {"success": True, "measurements": measurements}
