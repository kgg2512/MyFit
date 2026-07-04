# 작업지시서 — MyFit 데모/스토어 물리 분리 (신형 renewal)

- **날짜:** 2026-07-03
- **작성:** Alpha (G2 임원)
- **레인:** T4(대형 리팩토링) + 제품 핵심 구조 → 독립 QA 검증 필수
- **대상 레포:** `kgg2512/MyFit` (master), 로컬 `c:\Users\kgg25\Desktop\MyFit`
- **범위:** 신형 `renewal/myfit-mobile` 만. 구형 `legacy/`·크롬 확장 `renewal/myfit-extension`은 이번 범위 밖(이미 폴더 분리 양호).

---

## 1. 회장 요청 원문 (그대로 인용)

> "마이핏도 앱 / 웹 / 크롬 확장프로그램 으로 운영할 예정이지만, 각각 [데모]버전과 [스토어]버전이 별도로 구별되어야 한다. 즉 각 3개가 UI는 동일해도 되지만, 해당 파일 같은건 서로 엉켜서는 안된다는 거지. 근데 같은 하나의 폴더 안에 있다고 해서 이게 물리적으로 나눠져 있지 않을수도 있겠다는 생각이 들었는데, 이거 명확하게 제대로 분리해야 한다. 특히나 최근에 구형 버전과 신형 버전이 다르다는 점도 명확하게 이해하고, 구별해야 한다."

## 2. 진단 요약 (Alpha 실측, 2026-07-03)

- **구형/신형 축:** `legacy/` ↔ `renewal/` 폴더 물리분리 완료 ✅ (이번 범위 밖).
- **데모↔스토어 실제 차이 = 3점뿐** [확인]:
  1. **데이터 소스** — `src/lib/tryon.ts:79` `if (DEMO_MODE)` → 샘플이미지 반환 / else 실 CF Worker 호출.
  2. **시드 주입** — `src/app/page.tsx:64`, `src/app/fit/page.tsx:179`, `src/app/profile/page.tsx:62` 의 `if (DEMO_MODE) seedDemoData()`. 함수 본체 `src/lib/storage.ts:287`.
  3. **데모 전용 UI** — `page.tsx:220` 데모 리셋 버튼, `fit/page.tsx:454` 데모 배너 (`{DEMO_MODE && ...}`).
- **빌드는 이미 갈림** [확인]: `.env.app.demo`(DEMO=true) vs `.env.app`(DEMO=false), 별개 APK/AAB 산출. → 신데렐라(런타임 공존)와 달리 근본 위험 낮음. 남은 문제는 **소스 파일 공유로 인한 "편집 중 상호영향"** 뿐.
- **발견된 결함** [확인]: `package.json`이 `build:web:demo`/`build:web:prod`를 호출하나 `build-all.ps1` switch엔 `web`(DEMO 고정) 1개뿐 → **스토어 웹 빌드 경로 부재.** 현 라이브 `/v2/`는 데모 빌드.

## 3. 결정된 방식 = "B+" (한 레포 + `src/demo/` 물리 격리)

별도 레포(①)는 UI 99% 공유라 과분리 → 기각. 모노레포 워크스페이스(③)는 솔로 오버헤드 → 기각.
**채택:** 데모 전용 코드를 `src/demo/` 단일 폴더로 물리 격리하고, 스토어 로직 파일에서 데모 분기를 완전히 축출한다. 빌드타임 분리(env)는 유지·강화하고 tree-shaking으로 스토어 빌드엔 `src/demo/`가 포함되지 않게 한다. 회장이 폴더 트리에서 "데모=`src/demo/`, 스토어=나머지"를 눈으로 확인 가능 + 편집 격리 달성.

## 4. 완료 기준 (테스트 가능 체크리스트 — 항목별 PASS/FAIL)

- [ ] **C1. `src/demo/` 폴더 신설** — 데모 전용 코드 전부 이전:
  - `seedDemoData` + 데모 seed 데이터(치수·히스토리 3건) → `src/demo/seed.ts` (storage.ts에서 이동, storage.ts는 순수 저장 API만 남김)
  - 데모 배너 → `src/demo/DemoBanner.tsx` (컴포넌트, 내부에서 DEMO_MODE 체크, 비데모 시 null)
  - 데모 리셋 버튼 → `src/demo/DemoReset.tsx`
- [ ] **C2. `DEMO_MODE` 단일 소스** — `src/lib/appMode.ts`에 `export const DEMO_MODE`. tryon.ts 포함 전 참조가 이 파일을 import (정의 중복 제거).
- [ ] **C3. 스토어 로직 파일 정화 (grep 검증)** — `src/app/page.tsx`, `src/app/fit/page.tsx`, `src/app/profile/page.tsx` 에서 `DEMO_MODE`·`seedDemoData`·데모 UI 직접 분기 **0건**. 데모 진입은 단일 경계(예: `src/app/layout.tsx` 또는 `<DemoGate>`)에서 1회만. 페이지는 `<DemoBanner/>`·`<DemoReset/>`를 무조건 렌더(컴포넌트 내부가 알아서 null).
  - 검증: `grep -rn "DEMO_MODE\|seedDemoData" src/app/` → 히트 0 (진입 경계 1파일 제외).
- [ ] **C4. 데이터 소스 경계 유지** — tryon.ts의 데모/실 분기는 이미 격리된 경계이므로 유지하되 `appMode.ts`의 DEMO_MODE를 참조.
- [ ] **C5. 스토어 웹 빌드 경로 신설** — `build-all.ps1`에 `web:demo`(DEMO=true→`/v2` 또는 데모 배포) / `web:prod`(DEMO=false→스토어 웹 배포본) 타깃 추가, `package.json` scripts와 정합. 두 타깃 각각 산출물 생성 확인.
- [ ] **C6. 빌드 검증 (증빙 = 실제 EXIT 코드)**:
  - 데모 빌드(`NEXT_PUBLIC_DEMO_MODE=true`): `npm run build` EXIT 0, seed·배너·샘플이미지 경로 정상.
  - 스토어 빌드(`false`): `npm run build` EXIT 0, 산출물(`out/`)에서 데모 흔적(seedDemoData 호출·데모 배너 텍스트·`/demo/*.png`) grep 0건 = tree-shake 확인.
- [ ] **C7. 기능 동등성** — 분리 전후 데모 빌드의 화면·흐름 동일(리팩토링이지 기능변경 아님). 핏예측 엔진·UI 디자인 무변경.

## 5. 제약

- 핏예측 엔진(FitEngine)·UI 디자인·화면 레이아웃 **변경 금지.** 순수 구조 분리.
- 라이브 `/v2/`(현 데모)는 깨지지 않게 유지. 스토어 웹은 **새 타깃으로 신설만**(실제 배포는 회장 결정 — 이 지시서는 배포 안 함).
- Windows PowerShell 빌드 환경. `next.config` 처리 방식 먼저 확인(현재 `next.config.*` 미검출 — basePath 주입 경로 파악 후 진행).
- master에서 직접 작업, 완료 후 `git add -A && commit && push origin master`. **push 없이 완료 보고 금지.**

## 6. 도메인 주입 (§1.5 매트릭스)

- **모든 코딩(공통):** CTO + CSO — 빌드 무결성, tree-shake로 데모 코드 유출 0(스토어 빌드에 데모 자산 미포함 검증).
- **신규/변경 UI 일반:** CDO — 데모 배너·리셋 컴포넌트 추출 후 데모 빌드 시각 동일성.
- 개인정보/결제/인증 미해당(로컬 저장·가상피팅) → CISO/CLO 비대상.

## 7. 검증 게이트

- 구현자(g2-cto): C1~C7 구현 + 증빙(빌드 EXIT, grep 결과) 이 파일에 append.
- 독립 QA(g2-qa-tester): 구현자 증빙 재사용 금지, **데모/스토어 빌드 각각 독립 재실행** + grep 재검증. C3·C6이 핵심 게이트. PASS/FAIL append.
- FAIL 시 evaluator 루프(PASS까지). 같은 실패 2회 → 접근법 변경.

---

## 변경 내역 (구현자 append — g2-cto, 2026-07-03)

### 규명: basePath 주입 방식 (사전 확인 항목)
- `next.config.ts` 존재(glob 미검출은 dotfile/ts 누락). `output:"export"` + `basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''` + `assetPrefix`. 즉 **빌드타임 env로 basePath·DEMO 갈림**.
- `build-all.ps1`이 셸 `$env`를 세팅(우선순위: 셸 env > .env.production) → Build-Web은 `.env.production`(false,/MyFit/app)이 아니라 셸값(/MyFit/v2, DEMO=true)으로 빌드. 현 라이브 `/v2` = 데모 빌드. Android는 `.env.app(.demo)`를 `.env.production.local`(최우선)로 복사.

### 신규 파일 (데모 물리 격리)
- `src/lib/appMode.ts` — `export const DEMO_MODE` 단일 소스(C2). tryon.ts 런타임 데이터 경계가 참조.
- `src/demo/seed.ts` — `seedDemoData` 이전(storage.ts에서). 저장은 storage 공개 API로만 위임(seed 데이터·치수·히스토리 3건 정의).
- `src/demo/DemoBanner.tsx` — 데모 배너(fit 배너 + IconDemo 이전).
- `src/demo/DemoReset.tsx` — 데모 리셋 버튼(page 리셋 버튼 + handleDemoReset + IconRefresh 이전).
- `src/demo/DemoGate.tsx` — **데모 진입 단일 경계**. layout.tsx에서 1회 렌더, seed를 여기서만 호출(onboarding/privacy 경로는 skip해 빈-상태 시연 보존).

### 편집 파일
- `src/lib/storage.ts` — `seedDemoData`+seed 데이터(287~347행) 제거, 순수 저장 API만 남김. `isDemoSeeded`/`markDemoSeeded` 2개 헬퍼 추가(KEYS.DEMO_SEEDED 유지 → clearAllData가 마커도 삭제).
- `src/lib/tryon.ts` — `DEMO_MODE` 정의 삭제, `@/lib/appMode`에서 import(79행 데이터 경계 유지, C4).
- `src/app/layout.tsx` — `<DemoGate/>` 렌더(body 최상단).
- `src/app/page.tsx` — DEMO_MODE·seedDemoData·clearAllData·IconRefresh·handleDemoReset·seed useEffect 제거, 데모 리셋 버튼 → `<DemoReset/>`(무조건 렌더).
- `src/app/fit/page.tsx` — DEMO_MODE·seedDemoData·IconDemo·seed useEffect 제거, 데모 배너 → `<DemoBanner/>`.
- `src/app/profile/page.tsx` — DEMO_MODE·seedDemoData·seed useEffect 제거.
- `build-all.ps1` — `web:demo`(DEMO=true,/MyFit/v2,→$REPO\v2 라이브) / `web:prod`(DEMO=false,/MyFit/app,out/ 생성·out/demo 자산 제거·배포 보류) 타깃 신설. `web`=web:demo 별칭. `all`에 web:prod 추가. package.json scripts와 정합(C5).

### 핵심 엔지니어링 판정 (tree-shake 실패→수정)
- 1차 구현: 데모 컴포넌트가 `appMode.DEMO_MODE` import. **스토어 빌드 grep 실패**(데모버전 2건·seed데이터 layout 등). 원인: `NEXT_PUBLIC_*` 빌드타임 리터럴 치환이 `'use client'` **모듈 경계를 못 넘어** dead-code 제거 실패.
- 수정: 데모 컴포넌트/게이트(DemoBanner·DemoReset·DemoGate)의 판정을 **모듈 로컬 `process.env.NEXT_PUBLIC_DEMO_MODE === 'true'` 직접 참조**로 전환 → 같은 모듈 내 minifier가 dead-code 제거. appMode.ts는 tryon 런타임 경계용 단일 소스로 유지.

### 검증 증빙 (실행 결과)
- **C3** `grep -n "DEMO_MODE|seedDemoData" src/app/` → **0건**(layout은 DemoGate import만, 진입 경계 1파일). 전 데모 참조는 src/demo/ + appMode.ts + tryon.ts(데이터 경계)에만.
- **C6 스토어 빌드** `npm run build:web:prod` → **EXIT 0**. `out/` grep 결과: `seedDemoData`=0, `데모 버전|데모 리셋`=0, `오버핏 셔츠|와이드 데님|니트 스웨터`=0, `/demo/*.png`(seed 경로)=0. `out/demo/` 자산도 제거(부재 확인). 잔존 `myfit_demo_seeded`=7건은 storage.ts의 localStorage **키 상수**(clearAllData 순회 대상)로 데모 로직/데이터가 아님 — C6 대상(호출·배너텍스트·이미지경로) 전부 0.
- **C6 데모 빌드** `npm run build:web:demo` → **EXIT 0**. v2/에 데모 흔적 3건 정상 포함(양성 대조: layout=seed, fit=배너, page=리셋).
- **C7 실브라우저**(basePath 없는 데모 빌드 → localhost 서빙 → Playwright): 홈에 seed 히스토리 3건("오버핏 셔츠"·"와이드 데님"·"니트 스웨터") + "데모 리셋" 버튼 렌더, /fit에 "데모 버전 — 핏 예측 결과는 샘플입니다" 배너 렌더. **콘솔 에러 0**. seed 타이밍(DemoGate 렌더 경계 동기 실행이 페이지 read보다 선행) 실증 — 첫 진입에 데이터 표시. 스크린샷: `renewal/myfit-mobile/.playwright-mcp/demo_separation_home_verify.png`.
- **엔진·디자인·레이아웃 무변경**(C7): 순수 로직 이동, FitEngine·globals.css·JSX 구조 미변경.

## QA 검증 (QA append)

- **검증 주체:** g2-qa-tester (독립, 구현자 증빙 재사용 없이 전항목 재실행)
- **검증 일시:** 2026-07-03
- **검증 경로:** `c:\Users\kgg25\Desktop\MyFit\renewal\myfit-mobile` (PowerShell 환경, node_modules 기설치)

### 항목별 PASS/FAIL

| 기준 | 판정 | 근거(직접 실행 명령·결과) |
|------|------|--------------------------|
| C1. `src/demo/` 폴더 신설 | ✅ PASS | `ls src/demo/` → `DemoBanner.tsx DemoGate.tsx DemoReset.tsx seed.ts` 4개 실재. `src/lib/appMode.ts` 실재 확인(내용 열람). |
| C2. DEMO_MODE 단일 소스 | ✅ PASS (편차 1건 명시) | `grep -rn "export const DEMO_MODE" src/` → `appMode.ts:8` 1건뿐(중복 정의 없음). `tryon.ts:9` `import { DEMO_MODE } from '@/lib/appMode'` 확인. **단, DemoBanner.tsx·DemoReset.tsx·DemoGate.tsx 3개는 appMode를 import하지 않고 모듈 로컬 `process.env.NEXT_PUBLIC_DEMO_MODE` 리터럴을 직접 참조**(코드 직접 열람 확인) — 완료기준 문구("tryon.ts 포함 전 참조가 이 파일을 import")를 문자 그대로 100% 충족하지는 않음. 단 정의 자체는 appMode.ts 1곳뿐이고, 이 편차는 tree-shaking(스토어 빌드에서 데모 JSX 제거)을 위한 의도적·문서화된 트레이드오프이며 C3·C6 실측 결과로 기능 목표(스토어 정화)는 달성됨을 확인 → FAIL 처리하지 않고 편차로 기록. |
| **C3. 스토어 로직 파일 정화 (핵심 게이트)** | ✅ **PASS** | `grep -rn "DEMO_MODE\|seedDemoData" src/app/` 직접 실행 → **0건**(layout.tsx 포함 전체, DemoGate import 자체도 텍스트 매치 없음 — 문서 주장보다 더 엄격히 충족). `page.tsx`: `import DemoReset` + `<DemoReset />` 무조건 렌더 1곳뿐. `fit/page.tsx`: `import DemoBanner` + `<DemoBanner />` 무조건 렌더 1곳뿐. `profile/page.tsx`: 데모 참조 0건. |
| C4. 데이터 소스 경계 유지 | ✅ PASS | `tryon.ts:9` import, `tryon.ts:78` `if (DEMO_MODE)` — appMode 참조로 유지 확인. |
| C5. 스토어 웹 빌드 경로 신설 | ✅ PASS | `package.json` scripts에 `build:web:demo`/`build:web:prod` 존재, `build-all.ps1` 내 `web:demo`(basePath `/MyFit/v2`, DEMO=true)/`web:prod`(basePath `/MyFit/app`, DEMO=false) 타깃 확인, 스크립트-패키지 정합. |
| **C6-스토어. 빌드+유출 0 (핵심 게이트)** | ✅ **PASS** | `npm run build:web:prod` 직접 실행 → **EXIT 0**(Next.js 15.3.3, Exporting 3/3 성공 로그 확인). `out/` grep 재실행: `seedDemoData`=0, `데모 버전\|데모 리셋`=0, `오버핏 셔츠\|와이드 데님\|니트 스웨터`=0, `/demo/`=0, `out/demo/` 폴더=부재(`ls out/demo` → No such file or directory). `myfit_demo_seeded` 7건 잔존 확인 후 1건 직접 열람(`layout-*.js`): `DEMO_SEEDED:"myfit_demo_seeded"` — KEYS 상수 객체 문맥(PERSON_TS·ONBOARDED와 나란히) 확인, 데모 로직/데이터 아님. |
| **C6-데모. 양성 대조** | ✅ **PASS** | `npm run build:web:demo` 직접 실행 → **EXIT 0**. `v2/` grep: `데모 버전\|데모 리셋`=2건(fit 배너 청크, page 리셋 청크), `오버핏 셔츠\|와이드 데님\|니트 스웨터`=1건(layout 청크, DemoGate seed 위치와 일치) — 격리가 데모 빌드 자체를 죽이지 않았음을 확인. (`seedDemoData` 함수명 리터럴 0건은 minifier의 로컬 함수명 압축 때문으로, UI 텍스트·seed 데이터 값 존재로 실질 검증 충족.) |
| C7. 기능 동등성(회귀 없음) | ✅ PASS | `git show --stat eb55683` 직접 실행 → 변경 파일 목록에 FitEngine·globals.css·CSS 파일 전무(`grep -i "fitengine\|globals.css"` → 0건). 변경 파일은 claimed scope와 일치(page/fit/profile/layout.tsx, storage.ts, tryon.ts, build-all.ps1, 신규 src/demo/*, appMode.ts + v2 빌드산출물). |
| 실브라우저 검증(보조) | ✅ PASS | basePath 없는 데모 빌드: `NEXT_PUBLIC_DEMO_MODE=true NEXT_PUBLIC_BASE_PATH= npx next build` → **EXIT 0**. `npx serve out -p 5175`로 로컬 서빙(HTTP 200 확인) → Playwright 독립 재실행: `http://localhost:5175/` 접속 시 accessibility snapshot에 seed 3건("오버핏 셔츠"·"와이드 데님"·"니트 스웨터") + "데모 리셋 · 온보딩 다시 보기" 버튼 렌더 확인. `http://localhost:5175/fit` 접속 시 "데모 버전 — 핏 예측 결과는 샘플입니다" 배너 렌더 확인. `browser_console_messages(all=true)` → Total messages: 0 (Errors: 0, Warnings: 0). |

### 파괴 시도 / 추가 확인
- git 저장소 무결성: `git log origin/master..HEAD` → 빈 결과(push 완료 확인, 미푸시 커밋 없음).
- **QA 부작용 자가 정리:** 본 검증 중 `npm run build:web:demo` 재실행으로 라이브 `v2/`(실제 배포 폴더)가 Next.js 랜덤 buildId로 인해 커밋 대비 diff 발생(17개 파일, 내용은 동일 소스의 재빌드) — `git checkout -- v2/` + `git clean -fd v2/`로 커밋 상태 복원, `out/`(gitignored) 삭제, 로컬 정적서버(PID 4180) 타깃 종료. 최종 `git status --short` 확인 결과 **클린**(잔여 변경 0). 코드 수정 없음 — 전 과정이 지시서 명시 npm 스크립트 재실행 + grep/git 조회뿐.

### 비고 (버그 아님, 설계 참고사항 — FAIL 사유 아님)
1. **C2 편차**: 데모 3개 컴포넌트(DemoBanner/DemoReset/DemoGate)가 appMode.ts를 import하지 않고 `process.env.NEXT_PUBLIC_DEMO_MODE`를 로컬 재참조. 완료기준 문구는 100% 충족 아니나, 실측 결과(C3 0건, C6-스토어 0건)로 기능 목표는 달성 확인 — 통과 판정에 영향 없음.
2. `build-all.ps1`의 `web:demo` 타깃이 라이브 `../v2` 폴더에 직접 덮어쓰는 구조라, 향후 데모 빌드 재검증 때마다 Next.js 랜덤 buildId로 커밋 diff가 생김(내용 불변, 파일명 해시만 변동). 반복 검증 시 매번 v2/ 정리 필요 — 개선 여지(비차단).

### 종합 판정: ✅ **통과 (PASS)**

C1~C7 전항목 PASS. 핵심 게이트 C3(스토어 로직 파일 정화, grep 0건)·C6(양쪽 빌드 EXIT 0 + 스토어 산출물 데모 유출 0 + 데모 산출물 양성 대조 정상)이 독립 재실행으로 전부 확인됨. 실브라우저 실행(Playwright)까지 통과, 콘솔 에러 0. 재작업 불필요.
