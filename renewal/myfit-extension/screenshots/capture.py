"""
MyFit CWS 스크린샷 + 프로모 이미지 PNG 변환 스크립트
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

BASE = Path("c:/Users/kgg25/Desktop/G2 Company Ltd/myfit-extension")
SHOTS = BASE / "screenshots"

TARGETS = [
    {
        "file": SHOTS / "screenshot-1-sidepanel.html",
        "out":  SHOTS / "screenshot-1-sidepanel.png",
        "w": 1280, "h": 800,
    },
    {
        "file": SHOTS / "screenshot-2-measurements.html",
        "out":  SHOTS / "screenshot-2-measurements.png",
        "w": 1280, "h": 800,
    },
    {
        "file": SHOTS / "screenshot-3-ai-fitting.html",
        "out":  SHOTS / "screenshot-3-ai-fitting.png",
        "w": 1280, "h": 800,
    },
    {
        "file": SHOTS / "screenshot-4-onboarding.html",
        "out":  SHOTS / "screenshot-4-onboarding.png",
        "w": 1280, "h": 800,
    },
    {
        "file": BASE / "promo-440x280.html",
        "out":  SHOTS / "promo-440x280.png",
        "w": 440, "h": 280,
    },
]

async def capture():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for t in TARGETS:
            page = await browser.new_page(viewport={"width": t["w"], "height": t["h"]})
            url = t["file"].as_uri()
            await page.goto(url, wait_until="networkidle", timeout=15000)
            await page.wait_for_timeout(500)  # 폰트 렌더링 대기
            await page.screenshot(path=str(t["out"]), full_page=False)
            print(f"OK: {t['out'].name}")
            await page.close()
        await browser.close()

asyncio.run(capture())
