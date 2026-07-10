"""
MyFit API Server — Free Tier
G2 Company Ltd. | CTO Agent
"""

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision
import cv2
import numpy as np
import json
from pathlib import Path

app = FastAPI(title="MyFit API", version="0.1.0")

# 보안(감사 2026-07-07 P0#2): CORS 와일드카드(*) → 명시적 허용 오리진.
# 신체사진을 받는 무인증 엔드포인트이므로 임의 사이트의 교차출처 호출을 차단한다.
# 배포 시 환경변수 MYFIT_ALLOWED_ORIGINS(콤마구분)로 프로덕션 오리진을 주입할 수 있다.
import os
ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get(
        "MYFIT_ALLOWED_ORIGINS",
        "http://localhost:8000,http://127.0.0.1:8000,http://localhost:3000,https://kgg2512.github.io",
    ).split(",") if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# 업로드 검증 상수(자원 남용·비이미지 방지)
_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10MB

MODEL_PATH = Path(__file__).parent / "pose_landmarker_lite.task"
_detector = None


def get_detector():
    global _detector
    if _detector is None:
        base_options = mp_python.BaseOptions(model_asset_path=str(MODEL_PATH))
        options = vision.PoseLandmarkerOptions(
            base_options=base_options,
            num_poses=1,
            min_pose_detection_confidence=0.7
        )
        _detector = vision.PoseLandmarker.create_from_options(options)
    return _detector


LANDMARK_MAP = {
    "nose": 0, "left_shoulder": 11, "right_shoulder": 12,
    "left_elbow": 13, "right_elbow": 14,
    "left_wrist": 15, "right_wrist": 16,
    "left_hip": 23, "right_hip": 24,
    "left_knee": 25, "right_knee": 26,
    "left_ankle": 27, "right_ankle": 28
}


def extract_keypoints(img_bytes: bytes) -> dict | None:
    arr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return None
    h, w = img.shape[:2]
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    result = get_detector().detect(mp_image)
    if not result.pose_landmarks:
        return None
    lm = result.pose_landmarks[0]
    return {
        "size": (w, h),
        "points": {
            name: {"x": lm[idx].x * w, "y": lm[idx].y * h, "z": lm[idx].z}
            for name, idx in LANDMARK_MAP.items()
        }
    }


def calc_measurements(front: dict, side: dict, height_cm: float) -> dict:
    fp = front["points"]
    sp = side["points"]
    ref_px = abs(fp["nose"]["y"] - fp["left_ankle"]["y"])

    def to_cm(px): return round((px / ref_px) * height_cm, 1)
    def hdist(a, b): return abs(a["x"] - b["x"])
    def ellipse(w, d):
        a, b = w / 2, d / 2
        return round(np.pi * (3*(a+b) - np.sqrt((3*a+b)*(a+3*b))), 1)

    sh_cm   = to_cm(hdist(fp["left_shoulder"], fp["right_shoulder"]))
    hip_cm  = to_cm(hdist(fp["left_hip"], fp["right_hip"]))
    cd_cm   = to_cm(abs(sp["left_shoulder"]["x"] - sp["left_hip"]["x"]) * 0.85)
    ins_cm  = to_cm(abs(fp["left_hip"]["y"] - fp["left_ankle"]["y"]))
    arm_cm  = to_cm(
        abs(fp["left_shoulder"]["y"] - fp["left_elbow"]["y"]) +
        abs(fp["left_elbow"]["y"] - fp["left_wrist"]["y"])
    )

    return {
        "height_cm": height_cm,
        "shoulder_width_cm": sh_cm,
        "chest_cm":  ellipse(sh_cm * 0.95, cd_cm),
        "waist_cm":  ellipse(sh_cm * 0.72, cd_cm * 0.78),
        "hip_cm":    ellipse(hip_cm, cd_cm * 0.92),
        "inseam_cm": ins_cm,
        "arm_length_cm": arm_cm,
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
    side:  UploadFile = File(...),
    back:  UploadFile = File(...),
    height_cm: float  = Form(...)
):
    if not MODEL_PATH.exists():
        return {"success": False, "error": "모델 파일 없음. api/pose_landmarker_lite.task 필요"}

    # 보안(감사 2026-07-07 P0#2): 업로드 타입·크기 검증 — 비이미지/과대 파일 거부.
    async def _read_valid(upload: UploadFile) -> bytes | None:
        if upload.content_type not in _ALLOWED_IMAGE_TYPES:
            return None
        data = await upload.read()
        if not data or len(data) > _MAX_UPLOAD_BYTES:
            return None
        return data

    front_bytes = await _read_valid(front)
    side_bytes  = await _read_valid(side)
    if front_bytes is None or side_bytes is None:
        return {"success": False, "error": "이미지 형식(JPEG/PNG/WebP)·크기(10MB 이하)를 확인해주세요."}
    front_kp = extract_keypoints(front_bytes)
    side_kp  = extract_keypoints(side_bytes)
    if not front_kp or not side_kp:
        return {"success": False, "error": "키포인트 추출 실패. 사진을 다시 찍어주세요."}
    return {"success": True, "measurements": calc_measurements(front_kp, side_kp, height_cm)}
