# 【구형】 legacy — AI 가상 피팅 (라이브 버전, 아카이브)

MyFit의 1기 접근. 사진 업로드 → AI가 옷 입은 모습을 **이미지로 합성**.
6/25 투자 시연에서 "합성 이미지 ≠ 실제 착용감" 판정 후 신형(`../renewal/`)으로 피벗.
동작하는 상태 그대로 **아카이브 보존 + 라이브 유지**한다.

## 구성 (정적 = 소스이자 배포본)
- `index.html` — 런처 (app / app-demo 링크)
- `app/`, `app-demo/` — Next export (basePath `/MyFit/legacy/app`, `/MyFit/legacy/app-demo`)
- `api/` — 프록시 관련
- `privacy.html` · `privacy-policy.html` · `terms.html` — 법무 문서

## 업데이트/배포
정적이므로 파일 편집 → `git add legacy ; git commit ; git push` → 즉시 반영.
→ 라이브: https://kgg2512.github.io/MyFit/legacy/

> ⚠️ 신형(`../renewal/`)과 독립. `/MyFit/legacy/` 경로가 자산에 baked-in 되어 있으니 폴더명 변경 시 basePath 재작성 필요.
