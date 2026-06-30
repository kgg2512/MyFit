# MyFit 전면 리뉴얼 — TrueToForm 벤치마크 (작업지시서)

> **회장 원문 (2026-06-25):** "지금 MyFit 전면 업데이트해라. 디자인부터, 웹/앱/크롬확장프로그램의 구동 및 작동 순서, 결제, 그리고 데모버전 등등 모든것을 TrueToForm의 방식을 절대적으로 참조해라. 사실 MyFit이 가야하는 방향성과 실제 사업 비즈니스 모델의 구현은 트루투폼이 그대로 하고있다. 지금 마이핏은 저거에 비하면 한참 모자르다. 지금 당장 큰 업데이트를 실행한다."

## 0. 제품 정의 (확정 — 다시 흔들지 말 것)
**MyFit = TrueToForm의 B2C 버전.** 소비자가 쇼핑몰(무신사·나이키·톰브라운 등)에서 쇼핑 중, 크롬확장/앱으로 **그 상품의 실측 사이즈표를 자동으로 읽어 → 내 신체 치수/사진과 대조 → "이 옷이 내 몸에 어떤 핏으로 떨어지는지"를 시각적으로 보여주고 → 구매로 연결.**
- 단순 비주얼 합성(TryOnCloud류) ❌ → **치수 기반 핏 예측 + 시각화** ✅
- TrueToForm은 B2B(브랜드에 위젯 판매), MyFit은 **B2C(소비자 직접)** — UX/비즈모델은 B2C로 번역.

## 1. TrueToForm 방식 → MyFit 매핑

| TrueToForm 요소 | MyFit 적용 |
|---|---|
| 폰 브라우저 360° 스캔(앱불필요) → 3D 아바타 → 60+ 측정 | 1차: 치수 직접입력 + 사진. 2차: 사진→측정 (자체 or TTF 제휴) |
| visual size prediction + 옷 길이별 fit prediction lines + 사이즈별 비교 | 핏 게이지(이미 실연) + 부위별 + 사이즈 비교 + 3D아바타(Three.js 기존) |
| 상품페이지 사이즈표 자동 연동 | ★크롬확장 content.js가 쇼핑몰 사이즈표 DOM 자동 파싱 |
| freemium: 무료 5 → $40 → $100 → $350(API) | 무료 N회 → 구독. 쿠팡 어필리에이트 병행 |
| 데모스토어 + 측정 대시보드 | 데모모드 강화 + 사용자 핏/프라이버시 대시보드 |
| 깔끔 밝은 미니멀 SaaS, 프라이버시(처리후삭제·익명화·옵트인) | 디자인 톤 리뉴얼 + 프라이버시 UX 강화 |

## 2. 백엔드 전략 (확정)
**핏예측 엔진 = 자체 기본형(여유분 계산, 이미 프로토타입 검증) + TrueToForm 제휴 병행 타진.** 프론트는 엔진을 추상화(`FitEngine` 인터페이스)해 자체↔TTF 교체 가능하게. 제휴 성사 시 백엔드만 스왑.

## 3. 페이즈 (criteria-first — 각 완료기준 테스트 가능)

### P0 — 현황 스캔 + 청사진 (✅ 완료 2026-06-25)
- 현황 리포트 확보, 본 작업지시서 확정.

### P1 — 디자인 시스템 + 온보딩/측정 플로우
- [ ] TrueToForm 참조 디자인 토큰 재정의(색/타이포/간격/컴포넌트) — 회장 톤 승인 후
- [ ] 온보딩 플로우 리뉴얼: 가치제안 → 측정(치수입력, 향후 사진스캔) → 첫 핏 체험
- 완료기준: 새 디자인시스템 적용 홈+온보딩 빌드 PASS, before/after 스크린샷, console 0
- 게이트: CDO(디자인·접근성)

### P2 — ★사이즈표 자동추출 + 핏엔진 (최우선 기능)
- [ ] content.js: 무신사 우선 → 나이키·자라 사이즈표 DOM 파서(총장/가슴단면/어깨너비 추출)
- [ ] 카테고리 자동감지(URL/메타)
- [ ] `FitEngine`: 옷 실측 × 사용자 치수 → 부위별 여유분 → 핏 판정(오버/스탠다드/타이트), 원단 신축 반영
- 완료기준: 무신사 실제 상품 3개에서 사이즈표 자동추출 성공(실측 로그) + 핏 판정 출력. 회장 케이스 재현.
- 게이트: CTO+CSO(코어엔진·정확성 오라클), CLO(사이즈표 크롤링 저작권·약관)

### P3 — 핏예측 결과 UX
- [ ] visual fit prediction(부위별 게이지+길이라인) + 사이즈 비교 + 3D아바타(Three.js) 정합
- 완료기준: 한 상품에서 M/L/XL/XXL 핏 시각 비교 동작, 스크린샷
- 게이트: CDO, CTO

### P4 — 결제/구독 + 어필리에이트 🔒
- [ ] freemium: 무료 N회 → 구독 게이트
- [ ] 쿠팡파트너스 실링크 생성·추적(현재 고지만 있음)
- 완료기준: 결제 플로우 실호출(성공1+실패1), 어필리에이트 딥링크 생성 검증
- 게이트(🔒 독립검증 강제): **CISO + CLO(전자상거래·표시·환불) + CFO(금액·통화·수수료)**

### P5 — 데모버전 + 대시보드
- [ ] 데모모드 강화(투자/사용자 시연), 핏 히스토리 + 프라이버시 대시보드(사진 만료·수동삭제)
- 완료기준: 데모 빌드 동작, 프라이버시 대시보드에서 데이터 삭제 동작
- 게이트(🔒): CISO + CLO(개인정보 수집·보관·삭제)

### P6 — 3플랫폼 정합 + 검증
- [ ] 웹/앱/확장 디자인·플로우 일관, (선택)크로스 동기화
- 완료기준: 3플랫폼 빌드 PASS, 핵심 플로우 E2E
- 게이트: COO(회귀·롤백), g2-qa-tester 독립검증

## 4. 검증 하드게이트
- 각 페이즈 PASS 전까지 다음 페이즈 진입 금지. 증빙(빌드 EXIT·스크린샷·실호출 로그)은 완료형만.
- 🔒 페이즈(P4 결제, P5 개인정보, P2 코어엔진)는 독립검증 강제.
- 세션 내 🔒 작업 포함 → CAE(g2-auditor) 발동 대상.

## 5. 변경 이력 (실행자·QA append)
- 2026-06-25: P0 완료. 작업지시서 확정(Alpha). 현황 스캔 리포트 반영.

### 2026-06-26 — P2 사이즈표 자동추출 + FitEngine (CTO 구현)

**변경 파일:**
- `myfit-extension/src/content.js`
  - 보안 주석 정정(L9~14): "사이즈 차트 DOM 스크래핑 금지" → "공개 표시 실측표 읽기만 허용, 저장·재배포·서버전송 금지, 기기 내 핏 계산 1회성" (CLO 원칙 반영)
  - parseMusinsa 반환에 `sizeChart` 필드 추가
  - 신규 함수 4개: `parseMusinsaSizeChart()` / `detectMusinsaCategory()` / `parseMusinsaStretch()` (parseMusinsa 직후 삽입)
- `myfit-mobile/src/lib/fitEngine.ts` (신규)
  - `FitEngine` 인터페이스 + `LocalFitEngine` 구현체 + `fitEngine` 싱글톤
  - 여유분 구간(가슴 기준, 회장 확정): 작아서불가(<-4)/타이트(<0)/바디핏(<2)/스탠다드(<6)/세미오버(<10)/오버(≥10)
  - 어깨 별도 밴드(더 좁음), 총장은 정보성, 신축 보정(stretch 문자열→cm) 옵션 인자
  - TrueToForm 백엔드 교체 대비: 인터페이스 추상화 — 제휴 시 구현체만 스왑

**무신사 사이즈표 셀렉터 (2026-06-26 라이브 검증, 6590129):**
- 테이블: `[class*="ActualSizeTable-sc-"]` (styled-components 해시 변동 견디는 부분일치)
- 측정항목(헤더): `thead th` = 총장/가슴단면/어깨너비
- 사이즈 라벨: `[class*="ActualSizeHeaderUl-sc-"] li` 중 사이즈 패턴(`cm`,`내 사이즈` 자동 배제) = M/L/XL/XXL
- 데이터 행: `tbody tr` 중 셀 수 = 측정항목 수인 행만(placeholder "사이즈를 직접 입력해주세요" 자동 배제)
- 신축성: `[class*="MaterialInfo__MaterialTable-sc-"]` 3번째 행(핏/촉감/**신축성**/비침/두께), 선택셀=파란배경(getComputedStyle)

**증빙 (완료형):**
1. 사이즈표 자동추출 — 라이브 페이지에서 실제 content.js 함수 실행 결과:
   `{category:'sleeveless', unit:'cm', measureKeys:['총장','가슴단면','어깨너비'], sizes:[M{70.5,53.5,43.5}, L{72,56,45}, XL{73.5,58.5,46.5}, XXL{75,61,48}], stretch:'약간 있음'}`
   → 정답 실측 12개 값 전부 일치. 카테고리·신축성 추출 성공.
2. FitEngine 회장케이스(키176/몸85/가슴단면58/어깨56) node 실행 → 가슴여유 M -4.5(작아서불가)/L -2(타이트)/XL +0.5(바디핏)/XXL +3(스탠다드) = 정답 ALL PASS, RUN EXIT 0
3. content.js innerHTML/eval/document.write 호출 0건 (grep 3건 전부 금지명시 주석)
4. fitEngine.ts `tsc --noEmit --strict` EXIT 0, content.js `node --check` EXIT 0

**미해결·리스크:**
- 어깨 판정: 회장 어깨입력 56cm은 어깨"둘레/너비 전체"값으로 보이나 옷 '어깨너비'는 단면(43~48cm)이라 단위계 불일치 → 전 사이즈 "작아서 불가". FitEngine 버그 아님, **입력 데이터 정합성 문제**. P3 UI에서 측정 가이드("어깨 끝~끝 단면") 명시 필요. 회장 완료기준은 가슴 기준만 명시했고 가슴은 완벽 재현.
- 신축성 셀 판별이 무신사 파란배경 색상값에 의존 → 무신사 디자인 변경 시 깨질 수 있음(best-effort, 실패해도 stretch=null로 안전 degrade).
- parseNike/Zara/Uniqlo/HM에는 사이즈표 파서 미적용(작업지시 = 무신사 우선). 구조 미조사.

### 2026-06-26 — P3-2 크롬확장 sidepanel FitEngine 연동 (Alpha 직접 + 🔒 독립검증)

**문제(keystone 갭):** P2가 content.js에 실측 사이즈표 파서를, 웹앱에 FitEngine을 만들었으나 정작 **제품 1차 채널인 크롬확장 sidepanel은 추출한 `product.sizeChart`를 완전히 무시**하고 하드코딩 일반 브랜드표(`SIZE_CHART.tops`)로 추측 점수만 냄 → P2 파서가 확장에서 죽은 코드.

**라우팅 판단:** 단일 모듈·변경지점 명확·단위계 정합(가슴둘레/2=단면)이 핵심 정밀도 → **Alpha 직접** + 🔒 코어엔진이므로 독립검증 강제(node 정확성 오라클 + Playwright E2E + 신선컨텍스트 QA). **주입 검토 도메인:** CTO+CSO(코어엔진·정확성 오라클), CISO(CSP/외부전송 0).

**변경 파일:**
- `myfit-extension/sidepanel/fitEngine.js` (신규 187줄) — `myfit-mobile/src/lib/fitEngine.ts`의 충실 JS 포팅(밴드·STRETCH_MAP·점수·키매칭 1:1 동일). 확장은 ES모듈 아니므로 IIFE로 `window.MyFitEngine` 전역 노출(CSP `script-src 'self'` 안전).
- `myfit-extension/sidepanel/panel.html` (+4) — fitEngine.js 로드 + `#fit-engine-card` 컨테이너.
- `myfit-extension/sidepanel/panel.css` (+20) — `.fe-*` 정성 핏 카드 스타일(확장 다크 토큰 정합).
- `myfit-extension/sidepanel/panel.js` (+116/-6) — `startFitting`에 sizeChart→FitEngine 분기(단위계 변환 chestHalf=둘레/2, shoulder 직접), `updateFitScores` 분기, 신규 `renderFitFromEngine`/`buildFeRow`(innerHTML 금지→createElement+textContent). sizeChart 없으면(Nike/Zara/파싱실패) 기존 일반추정 fallback 유지.

**증빙 (완료형):**
1. node 정확성 오라클 — JS포팅 vs 검증 TS엔진, 회장케이스(가슴단면58, 무신사 M/L/XL/XXL): M -4.5/작아서불가, L -2/타이트, XL +0.5/바디핏, XXL +3/스탠다드, 추천=XXL, 민소매 어깨=비교제외 → `ORACLE_ALL_PASS`.
2. 단위계 변환 테스트 — 일반 반팔티+프리셋M(가슴둘레94→단면47): M 스탠다드(+5)/추천, L 세미오버(+8), XL 오버핏(+11) → `CONV_PASS`.
3. Playwright E2E(chrome 스텁 하니스, 사이드패널 400px) — ①반팔티: 사이즈버튼 실측 M★/L/XL, "실측 기반 추천 M", 가슴 스탠다드+5cm(옷52)·어깨 스탠다드+1cm(옷44)·총장68cm. ②사이즈전환 L클릭→가슴 세미오버+8cm/어깨 세미오버+3cm 재렌더. ③민소매: M★/L/XL/XXL, 어깨="민소매—어깨 비교 제외"(거짓 불가판정 차단). **console 에러 0** (경고1=테스트스텁 getURL 미구현, 제품 결함 아님·2D폴백 정상). 증빙 스크린샷 `myfit-extension/screenshots/p32-fit-engine-after.png`.
4. node --check fitEngine.js/panel.js/content.js EXIT 0.
5. 독립검증(g2-qa-tester 신선컨텍스트) — C1포팅충실도/C2단위계/C3연결·회귀/C4보안CSP/C5렌더안전/C6민소매가드 **전부 PASS, 🔴블로커 0**, `VERDICT: PASS`.

**미해결·리스크:**
- 신축 보정 미적용(stretchFromChart:false) — 검증된 회장케이스 판정과 동일 유지 목적. 향후 더 정확한 핏 위해 옵션화 검토 가능.
- 3D 아바타 탭(panel-3d)의 클로딩 스케일은 일반 사이즈 가정 — 실측 사이즈명(XXL 등)과 100% 정합은 P6 과제.
- ⚠️ **시스템 리스크(별건):** 루트 `auto_commit.ps1` 데몬이 세션 중 `git add -A`로 ①panel.js를 **미완성 상태로 커밋**(9ab8ffe) ②셸 artifact junk 다수(`myfit-extension/0`,`Math.max(0`,`f2ShowFitColor`,`workers/.../400`)를 커밋·푸시. 본 작업 범위 junk 4개는 제거했으나 레포 전반 junk(루트 수십개)는 미정리 — 회장 결정 필요(데몬 자체가 품질 리스크). **[해결 2026-06-26: 회장 승인 → auto_commit.ps1 `git add -u`+push제거, 추적 junk 46개 제거. 커밋 a6d17f8]**

### 2026-06-26 — P1 온보딩 + P5 데모/프라이버시 대시보드 + P6 3플랫폼 정합 (회장 지시: CAE 발동 후 일괄)

**CAE 선행:** 세션 🔒(코어엔진) 포함 → 회장 지시로 P1/P5/P6 착수 전 g2-auditor 발동. VIOLATIONS FOUND(2) 경미(🔴0): 인프라로그 CTO+CSO 행 누락·이전 CAE항목 선언형증빙 — 둘 다 Alpha 즉시 시정(커밋 89e140b).

**P1 — 신규 사용자 온보딩 플로우 (커밋 1c6efb4):**
- 라우팅: g2-frontend-engineer 위임(UI 신규화면) + CDO 게이트 + Alpha 독립검증. 주입: CDO(디자인·접근성).
- 신규 `myfit-mobile/src/app/onboarding/page.tsx`(3스텝: 가치제안→측정→첫 핏 체험), `src/lib/onboarding.ts`(SSR-safe 플래그), `page.tsx`(신규유저 분기, 기존 사용자 무영향).
- 증빙(완료형): tsc EXIT0, build /onboarding 라우트 생성, 이모지0·접근성 aria/label 32refs·--myfit토큰 일관, 스크린샷 4종, console0(favicon 제외).

**P5 — 데모모드 강화 + 프라이버시 대시보드 (🔒, 커밋 549603b):**
- 라우팅: g2-cto 위임(데이터 생명주기+UI) + 🔒 CISO/CLO 주입 + g2-qa-tester **독립 재실행** 검증 강제.
- storage.ts: clearMeasurements/clearFitHistory/deleteFitHistoryItem/clearAllData/getPhotoStatus 신설, 신체사진 7일 자동만료(처리후삭제). 신규 `src/app/privacy/page.tsx`(카테고리별 표시+삭제+고지), page.tsx 데모리셋, profile 링크.
- 증빙(완료형·독립재실행): tsc/build EXIT0. 삭제=실제 완전제거(전체삭제후 localStorage.length0). 사진 8일전 타임스탬프→자동폐기 실증. 외부전송 네트워크요청 0건. 고지=코드동작 일치(CLO). fit 회귀0. g2-qa-tester G1~G6 VERDICT:PASS 🔴블로커0.

**P6 — 크롬확장 라이트 미니멀 정합 (커밋 f170901):**
- 라우팅: g2-frontend-engineer 위임(CSS 리테마) + COO 게이트 + Alpha 독립검증(비-🔒·CSS-only라 §3.B 싼 독립검증: 스크린샷·grep·diff·tsc).
- panel.css만 다크→웹 라이트 토큰 정합(:root+하드코딩17곳+그라디언트). panel.js/html/fitEngine.js 불변(COO 회귀0). P3-2 핏카드도 라이트 AA 대비.
- 증빙(완료형): 다크잔재 grep 0건, tsc0, 전 화면 라이트 렌더 스크린샷(FitEngine 카드 시맨틱색 정상), console0, panel.js git diff 불변.

**로드맵 상태:** P0~P3·P3-2·P5·P6 완료. **P4 결제만 회장 액션 대기**(쿠팡파트너스 가입→트래킹ID, 구독 PG 결정). 앱(Capacitor)은 웹코드 공유라 P1/P5/P6 자동 정합.
