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

**작업 절차 (웹 신형 기본 — 2026-07-11 재작성: 복사 승격 폐기):**
1. 데모 반영: `cd renewal/myfit-mobile; .\build-all.ps1 -Target web:demo` → `/demo/v2/`에 DEMO_MODE=true·basePath `/MyFit/demo/v2`·noindex로 빌드 → push → 라이브 데모 URL 검증.
2. **승격 = 재빌드 (복사 아님):** 데모 검증 PASS 후 `.\build-all.ps1 -Target web:store` → `/v2/`에 **DEMO_MODE=false**·basePath `/MyFit/v2`로 재빌드 → push.
   - ⚠️ **`robocopy demo\v2 v2`(복사) 금지.** 데모 슬롯은 DEMO_MODE=true라 데모 시드·샘플 데이터를 포함한다. 복사하면 그 데이터가 스토어로 새어든다(2026-07-11 QA 적발: "무신사 나시 (데모)" 스토어 유출). 승격은 반드시 `DEMO_MODE=false` 재빌드여야 tree-shaking이 데모 데이터를 제거한다.
3. **스토어 폴더(`v2/`·`legacy/`)는 `web:store` 빌드 산출물로만 갱신.** 손으로 직접 수정 금지. 데모 폴더는 언제 망가져도 된다.
4. 격리 검증: 승격 후 `demo-isolation-check` 스킬로 `/v2/` 청크에 데모 심볼(`getDemoFitInput`·`무신사 나시`) 0건 확인.
5. 앱(플레이/앱스토어)·크롬 확장(CWS): 스토어 제출 빌드는 **데모 웹 검증 PASS된 코드로만** 생성.

**✅ 가상피팅 외부벤더 폐기 완료 (2026-07-14 — 코드·문서·정책 전면 제거):**
AI 가상피팅(외부 합성 API)은 레포 전체에서 제거됐다. 워커 `/try-on`은 410 Gone 스텁, 크롬 확장은 로컬 치수/시각화 도구로 축소, 전 정책 문서는 "사진 외부 전송·국외이전 없음"으로 정정. **v2 = 자체 FitEngine(치수 기반)만 사용, 가상피팅 외부벤더 미사용 — 재도입 금지(회장 종결 확정).** 잔여: CF 워커 실배포 teardown(회장 크리덴셜 필요, 그 전까지 410 스텁 배포로 대체).

주의: `v2/demo/`(앱 내 데모 모드 페이지)와 루트 `demo/`(작업용 스테이징 폴더)는 별개다.
