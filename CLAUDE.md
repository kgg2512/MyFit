# MyFit — 작업 규칙

**언어: 항상 한국어.** 버전 상세 `VERSIONS.md`, 회사 헌법 `Desktop/G2 Company Ltd/CLAUDE.md`.

## ⚠️ 구형/신형 별도 버전 (회장 지시 — 작업 전 필수 인지)
- **구형(legacy)** = 가상 피팅. 라이브 `/legacy/`. 소스+정적 산출물 `legacy/`.
- **신형(v2/renewal)** = 치수 기반 핏 예측. 라이브 `/v2/`. 소스 `renewal/myfit-mobile/`(웹·앱), `renewal/myfit-extension/`(크롬 확장). 웹 산출물 `v2/`.
- 한 버전 = 한 폴더 = 독립 업데이트. **어느 버전 작업인지 먼저 확정하고 그 폴더만 만진다.**

## 🎭 데모/스토어 이원화 (회장 지시 2026-07-10 — 위반 금지)

| 슬롯 | 경로(라이브 URL) | 갱신 |
|------|-----------------|------|
| **데모 신형** | `/demo/v2/` → https://kgg2512.github.io/MyFit/demo/v2/ | 작업 시 자유 갱신 |
| **데모 구형** | `/demo/legacy/` → https://kgg2512.github.io/MyFit/demo/legacy/ | 작업 시 자유 갱신 |
| **스토어 신형** | `/v2/` | 데모 검증 PASS 후 복사 승격만 |
| **스토어 구형** | `/legacy/` | 데모 검증 PASS 후 복사 승격만 |

**작업 절차 (웹 기본):**
1. 빌드/수정 산출물을 **`demo/v2/`(또는 `demo/legacy/`)에 먼저** 반영 → push → 라이브 데모 URL 검증
2. PASS 후 승격: `robocopy demo\v2 v2 /MIR` (구형이면 `demo\legacy legacy`) → push
3. **스토어 폴더(`v2/`·`legacy/`) 직접 수정 금지.** 데모 폴더는 언제 망가져도 된다.
4. 앱(플레이/앱스토어)·크롬 확장(CWS): 스토어 제출 빌드는 **데모 웹 검증 PASS된 코드로만** 생성.

주의: `v2/demo/`(앱 내 데모 모드 페이지)와 루트 `demo/`(작업용 스테이징 폴더)는 별개다.
