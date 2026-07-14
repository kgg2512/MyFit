# MyFit — 버전 체계 (구형 / 신형)

> 최종 정리: 2026-07-01 · 레포: `kgg2512/MyFit` (master)
> 이 문서는 MyFit이 **두 개의 서로 다른 제품 접근**을 거쳤음을 공식 기록한다.
> 둘 다 레포에 보존하며, 호칭은 **구형 버전** / **신형 버전**으로 통일한다.

---

## 한눈에 — 두 버전의 본질적 차이

| | **구형 버전 (Legacy)** | **신형 버전 (Renewal)** |
|---|---|---|
| 별칭 | 라이브 버전 | TrueToForm 벤치마킹 버전 |
| 핵심 접근 | **AI 이미지 합성 가상피팅** | **치수 기반 핏 예측** |
| 한 줄 정의 | 사진 업로드 → AI가 옷 입은 모습 *생성* | 내 치수 × 쇼핑몰 사이즈표 → 부위별 핏 *예측* |
| 벤더/엔진 | 외부 합성 API — **2026-07-14 전면 폐기(코드 제거·워커 410 스텁, 회장 확정)** | 자체 `FitEngine` + 무신사 사이즈표 자동추출 파서 |
| 코드 위치 | **`legacy/`** (app, app-demo, api) | **`renewal/`** (myfit-mobile, myfit-extension) |
| 배포 | **라이브** `/legacy/` | **라이브** `/v2/` (2026-07-01 배포 완료) |
| 레퍼런스 | — | TrueToForm (측정→핏 예측의 B2C판) |
| 한계 | 합성 이미지 ≠ 실제 착용감, "맞을지" 답 못 줌 | (개발 중) 사이즈표 없는 쇼핑몰 커버리지 |

**전환의 의미:** "옷 입은 모습을 *보여주는*" 제품(구형)에서 → "이 옷이 너에게 *맞을지 부위별로 알려주는*" 제품(신형)으로의 피벗.
신형은 메모리 정의와 일치한다 — *MyFit = 치수기반 핏예측+시각화(TrueToForm의 B2C판), 단순 비주얼 합성이 아님.*

---

## 시점별 변천 (timeline)

### 1기 — 구형 버전 구축 (2026-06-07 ~ 06-22): AI 가상피팅

- **2026-06-07** MyFit 웹+앱 동시 구현 준비 (useRouter 통합, basePath 조건부, GitHub Pages 워크플로우). CF Worker 배포 — KV 네임스페이스 등록.
- **2026-06-08~09** CDO UX 개선, CMO 스토어 텍스트/GTM, CLO 법무 감사 — privacy/terms 생성, 국외이전(FASHN AI) 고지.
- **2026-06-11** 3-플랫폼 정비(웹·앱·확장) — Play 심사 요건 충족.
- **2026-06-14~16** 데모/실제 빌드 체계, 데모 AI 피팅 샘플 4종, 접근성·성능 WCAG AA 개선.
- **벤더 전환 (FASHN → TryOnCloud)**
  - **2026-06-20** FASHN → TryOnCloud 전환 완료 + 전면 리네이밍. 국외이전 국가 오류(미국→인도) 정정.
  - **2026-06-21** 라이브 API 실측으로 필드명 정정(`user_image`/`product_image_url`), 14세 게이트, 프라이버시 정직성 정정, DPA(GDPR 28조) 보강.
  - **2026-06-22** 의류 도메인 우회 stateless HMAC 이미지 프록시(`/g/`), SSRF 블로커 3건 시정(독립리뷰 B1/B2/B3), **TryOnCloud 실 AI피팅 E2E 200 확정**.
- → 이 상태가 현재 **라이브(gh-pages)에 떠 있는 구형 버전**. 마지막 실작업 6/22.

> 6/25 투자 시연에서 "비주얼 합성 = 실제 착용감 불일치" 방향 부적합 판정 → 접근 자체를 재검토.

### 2기 — 신형 버전 피벗 (2026-06-26 ~ 06-30): 치수 기반 핏 예측

- **2026-06-26 (대전환일)**
  - `ba73818` **P1 디자인 리뉴얼** — profile·fit 밝은 미니멀 전환 (**TrueToForm 참조**).
  - `729101b` **P2** — **무신사 사이즈표 자동추출 파서 + `FitEngine` 치수기반 핏예측** (신형의 심장).
  - `6b6a972` FitEngine 어깨 판정 가드 — 민소매는 어깨 비교 제외 (P2 독립검증 보강).
  - `ca53afb` **P3** 핏 예측 결과 화면 — FitEngine 시각화 (`/fit/result`).
  - `b49e5f2` P3-2 크롬확장 sidepanel ↔ FitEngine 연동.
  - `1c6efb4` 신규 사용자 온보딩 (가치제안→측정→첫 핏 체험).
  - `549603b` P5 데모모드 강화 + 프라이버시 대시보드 (🔒 개인정보).
  - `f170901` P6 크롬확장 sidepanel 라이트 미니멀 정합 (3플랫폼 디자인 일관).
- **2026-06-30** `a231291` **TrueToForm 소비자관점 벤치마킹 분석** — 신형 리빌드 입력 문서. → `docs/research/truetoform_benchmark.md`
- **2026-07-10** `de9b06d` **P7~P9 비전 플로우 완성** — 회장 비전(치수→신체 구현→사이즈표→사이즈별 핏→구매)의 웹 재현 가능 계층 전부: `/fit/check` 신설(실측표 붙여넣기 자동 파싱+수동 그리드), 고아 라우트 `/fit/result` 해방+홈 CTA 오배선 수정(AI합성→치수 핏예측), SVG 파라메트릭 아바타+사이즈 토글 핏 오버레이, 사진 "내 몸 기록" 통합(온디바이스·7일 만료). g2-qa-tester 독립검증 FAIL 2건(아바타 단조성 포화·증빙 부정확) 시정 후 전 게이트 PASS. P10(로그인=Supabase)은 차기.
- → 신형 소스는 `myfit-mobile/`(Next.js, 118파일) + `myfit-extension/`(크롬확장, 59파일)에 정착. 작업지시서: `docs/workorders/20260625_myfit_truetoform_renewal.md`

### 사고와 정정 (2026-07-01)

- **발견:** 2기 신형 작업 전부가 **MyFit 레포가 아니라 G2 회사 모노레포(`kgg2512/G2-Company-Ltd`)에 잘못 커밋**돼 있었음. 원인 = 매시간 `git add .` 후 자동 푸시하던 스케줄 작업(`MyFit-Auto-Commit` + `auto_commit.ps1`)이 작업폴더 전체를 무차별 덤프 → MyFit 공개레포에는 회사 내부 인프라(`.claude/` 539파일)·타 프로젝트(cinderella)까지 섞여 있었음.
- **정정:** 신형(myfit-mobile/extension/docs)을 `git subtree split`로 **이력 보존**하며 MyFit 레포로 이전. 무관/내부 파일 569개 제거. 원흉 스케줄 작업·스크립트 영구 폐기.
- **폴더 분리 + 신형 배포 + 히스토리 정화 (2026-07-01 2차):**
  - 구형 → `legacy/`, 신형 → `renewal/`로 **물리 분리**(각 버전 독립 업데이트/저장). 구형 built 자산 basePath `/MyFit/app` → `/MyFit/legacy/app` 재작성.
  - 신형 웹 빌드(Next export, basePath `/MyFit/v2`, 데모모드) → 레포 `/v2/` 배포 = **라이브**. 루트에 버전 선택 랜딩 신설.
  - git 히스토리에서 회사 내부 덤프(`.claude`·`.claude-flow`·`.swarm`·`agents`(C레벨)·`cinderella`·`G2_Office`·`CLAUDE.md`·`.env.*`·워커 `.wrangler` 캐시·셸 artifact) `git filter-repo`로 **전 커밋 완전 제거** 후 force-push(`9d5a626`→`e28ac2b`). CISO 시크릿 스캔 0. 복구 번들 `Desktop/MyFit-backups/` 보존.

---

## 참조

- 구형 라이브: https://kgg2512.github.io/MyFit/
- 신형 벤치마크 근거: [`docs/research/truetoform_benchmark.md`](docs/research/truetoform_benchmark.md)
- 신형 작업지시서: [`docs/workorders/20260625_myfit_truetoform_renewal.md`](docs/workorders/20260625_myfit_truetoform_renewal.md)
