# 【신형】 renewal — 치수 기반 핏 예측 (TrueToForm 벤치마킹)

MyFit의 현재 주력 접근. 내 치수 × 쇼핑몰 사이즈표 → **부위별 핏 예측**(자체 `FitEngine`).
AI 이미지 합성이 아니라 실제 착용감을 수치로 답한다.

## 구성
- `myfit-mobile/` — Next.js 15 앱 (웹 + Capacitor 모바일). 웹 배포본은 레포 루트 `/v2/`.
- `myfit-extension/` — 크롬 확장 (쇼핑몰 사이즈표 자동 추출 → FitEngine 연동).

## 웹 업데이트/배포
```powershell
cd renewal/myfit-mobile
.\build-all.ps1 -Target web      # basePath /MyFit/v2, 데모모드 → 레포 /v2/ 갱신
cd ../.. ; git add v2 renewal ; git commit -m "..." ; git push
```
→ 라이브: https://kgg2512.github.io/MyFit/v2/

> ⚠️ 구형(`../legacy/`)과 독립. 신형 작업은 이 폴더 안에서만.
