# MyFit — 앱스토어 / 플레이스토어 제출 가이드 (신형 v2)

- **작성:** 2026-07-09 (G2 CTO) · **대상:** 신형 `renewal/myfit-mobile` (Next.js 15 + Capacitor 6)
- **appId:** `com.g2company.myfit` · **appName:** MyFit · **버전:** versionName 1.0 / versionCode 1
- **제품 정의:** 신체 치수 기반 **AI 핏 예측·시각화** 앱(단순 가상 피팅 합성 아님). 사이즈표 자동 분석 × 내 치수 → 부위별 핏(오버/타이트) 예측. **외부 AI 가상 피팅은 2026-07-14 전면 폐기 — 미포함.**
- **원격 의존:** 없음 — 치수·핏 예측·사진 보관은 전부 기기 로컬(localStorage). (구 AI 피팅 프록시 워커는 2026-07-14 폐기, 410 스텁)

> 이 문서는 제출 실무 체크리스트다. 코드/빌드는 준비 완료 상태이며, 남은 것은 **회장 계정·결제·서명키 재생성**(아래 §1, §4)이다.

---

## 1. 🔒 최우선 — 서명키(keystore) 오염 및 재생성 (BLOCKER)

**문제(확정):** `renewal/myfit-mobile/android/release.keystore`가 **공개(PUBLIC) GitHub 레포에 커밋되어 있었다.** `gh repo view kgg2512/MyFit → visibility=PUBLIC` [확인, 2026-07-09 이 세션 gh 결과]. 서명 개인키가 공개 노출되면 **누구나 이 키로 서명한 위조 APK를 만들 수 있으므로, 이 키는 영구적으로 신뢰 불가(오염)**다.

**이번 세션 조치(완료):**
- `git rm --cached renewal/myfit-mobile/android/release.keystore` — 추적 제거.
- 로컬 사본을 레포 밖으로 이동: `C:\Users\kgg25\Desktop\MyFit-secrets\release.keystore.COMPROMISED-20260709` (참고 보관용, **사용 금지**).
- `.gitignore`에 `*.keystore` / `*.jks` / `android/release.keystore` 추가 — 재커밋 차단.

**⚠️ 남은 필수 조치(회장/CTO, Play 등록 전):**
1. **새 keystore 생성**(로컬, 절대 커밋 금지):
   ```bash
   keytool -genkeypair -v -keystore myfit-release-NEW.keystore \
     -alias myfit-release -keyalg RSA -keysize 2048 -validity 10000 \
     -storepass <강력한-스토어-암호> -keypass <강력한-키-암호> \
     -dname "CN=G2 Company Ltd, OU=MyFit, O=G2 Company Ltd, C=KR"
   ```
2. 생성한 키를 안전한 곳(레포 밖 + 비밀번호 관리자)에 보관. **분실 시 앱 업데이트 영구 불가**(Play App Signing 미가입 시).
3. **Play App Signing 사용 권장**: 업로드 키만 관리하고 배포 서명은 Google이 대행 → 키 분실/오염 리스크 완화. 최초 AAB 업로드 시 활성화.
4. CI 서명 주입용 GitHub Secrets 등록(레포 Settings → Secrets and variables → Actions):
   - `MYFIT_KEYSTORE_B64` = `base64 -w0 myfit-release-NEW.keystore` 결과
   - `MYFIT_STORE_PASSWORD`, `MYFIT_KEY_ALIAS`(=`myfit-release`), `MYFIT_KEY_PASSWORD`
5. **히스토리 정리(선택·권장):** 오염 키는 git 히스토리에 여전히 존재. 새 키로 완전 대체하므로 실질 위험은 없으나, 위생상 `git filter-repo`로 blob 제거 가능(force-push 필요 — MyFit은 과거 filter-repo 이력 있음, CISO 확인 후 진행).

> 오염된 옛 키는 어떤 스토어 제출에도 사용하지 말 것. CI 워크플로(`android-build.yml`)는 서명 Secret이 없으면 **의도적으로 실패**하도록 가드가 있다.

---

## 2. 빌드 파이프라인 (준비 완료)

| 산출물 | 명령 | 비고 |
|--------|------|------|
| 웹 데모(라이브 `/v2/`) | `build-all.ps1 -Target web:demo` | DEMO=true, basePath `/MyFit/v2`. GitHub Pages 자동 배포. **스토어와 무관** |
| 앱 스토어 빌드(웹 자산) | `.env.app`(DEMO=false, basePath 빈값) → `npm run build` → `npx cap sync android` | 데모 코드 tree-shake 제거. 이번 세션 검증: build EXIT=0, cap sync EXIT=0 |
| Android AAB | GitHub Actions `MyFit Android (AAB)` (수동) | 서명 Secret 주입 후 실행 → `myfit-release-aab` 아티팩트 |
| iOS unsigned | GitHub Actions `MyFit iOS (unsigned)` (수동) | macOS 러너, `cap add ios` + 권한/프라이버시 병합 → `myfit-ios-unsigned` |

- **CI 워크플로는 전부 `workflow_dispatch`(수동) 전용** — push/PR 자동 트리거 없음(메일폭탄/과금 방지).
- 로컬 AAB 빌드는 Android SDK + 유효 keystore 필요. 로컬 환경에 SDK 미설치 → **CI 사용 권장**.
- iOS `ios/` 폴더는 레포에 커밋하지 않음 — CI가 매 실행 시 `cap add ios`로 재생성(권한 문구·PrivacyInfo.xcprivacy 자동 병합).

---

## 3. 회장 액션 체크리스트 (계정·결제·요건 — 현행 기준 웹 확인)

### 3.1 Apple App Store
- [ ] **Apple Developer Program 가입** — 연 **99 USD** [확인 2026-07-09, developer.apple.com/programs/whats-included/ · /support/compare-memberships/]. 개인/법인(D-U-N-S) 선택. 법인 명의(G2 Company Ltd)면 D-U-N-S 번호 필요(발급 수일 소요).
- [ ] App Store Connect에서 앱 레코드 생성(번들ID `com.g2company.myfit` 등록).
- [ ] 빌드 업로드: iOS는 **서명 인증서/프로비저닝 프로파일 필요** → 실기기 Mac 또는 CI에 Apple 인증서 주입. (현 `ios-build.yml`은 unsigned 검증 빌드까지. 업로드용 서명 단계는 인증서 secrets 추가 후 확장.)
- [ ] 앱 심사 정보: 데모 계정 불필요(로그인 없음), 심사 노트에 "로그인 없이 전 기능 이용 가능, 치수 입력 후 핏 예측 확인" 기재.

### 3.2 Google Play
- [ ] **Google Play Console 등록** — **US$25 1회** 등록비 [확인 2026-07-09, support.google.com/googleplay/android-developer/answer/6112435].
- [ ] **개인 개발자 계정 신규(2023-11-13 이후 생성) = 프로덕션 출시 전 비공개 테스트 의무**: **최소 12명 테스터 × 연속 14일** 비공개(closed) 테스트 완료 후에야 프로덕션 신청 가능 [확인 2026-07-09, support.google.com 커뮤니티 가이드 "12 testers requirement" · 20명→12명으로 완화됨]. **법인(조직) 계정은 이 요건 면제** → G2 Company Ltd **조직 계정으로 등록하면 12명·14일 테스트 우회 가능**(회장 결정 포인트).
- [ ] **target API 35(Android 15) 필수** — 신규 앱은 2025-08-31부터 API 35+ [확인 2026-07-09, support.google.com/.../answer/11926878 · developer.android.com/google/play/requirements/target-sdk]. 프로젝트는 **이미 targetSdk/compileSdk 35**(`variables.gradle`) → 충족.
- [ ] Play App Signing 활성화(§1.3).
- [ ] Data Safety 양식 작성(§5.2).

### 3.3 공통 스토어 자산 (회장/디자인)
- [ ] App Store 아이콘 1024×1024(불투명) — **준비 완료**: `renewal/myfit-mobile/public/icons/appstore-icon-1024.png` (1024×1024, PNG color type 2 = **알파 채널 없음**, 모서리 라운딩 없음 = Apple 규격).
- [ ] Play Store 아이콘 512×512 — `renewal/myfit-mobile/android/play-store-icon.png`(기존) 또는 icon-generator.html의 512.
- [ ] 스크린샷: iOS(6.7"/6.5" 등), Android(폰) 각 최소 2~수 장. `public/icons/icon-generator.html`로 아이콘 세트 생성 가능. 스크린샷은 실기기/시뮬레이터 캡처 필요.
- [ ] 피처 그래픽(Play, 1024×500) 1장.
- [ ] **개인정보처리방침 URL(필수)**: `https://kgg2512.github.io/MyFit/v2/privacy.html` (라이브). 이용약관: 인앱 `/terms` + `https://kgg2512.github.io/MyFit/v2/terms.html`.

---

## 4. 프라이버시 라벨 매핑

### 4.1 Apple App Privacy ("Nutrition Label")
| 데이터 | 수집? | 용도 | 사용자 연결 | 추적 |
|--------|-------|------|-------------|------|
| **사진(신체 이미지)** | 수집·외부 전송 안 함(기기 내 처리만) | 앱 기능(App Functionality) | 아니오 | 아니오 |
| 신체 치수 | 기기 내 저장(서버 미수집) | 앱 기능 | 아니오 | 아니오 |
| 기기 ID(로컬 저장 키) | 수집 아님(로컬만) | 앱 기능 | 아니오 | 아니오 |

- 핵심 고지: **치수·핏 기록·사진은 기기(localStorage)에만 저장, MyFit 서버로 전송·보관하지 않음.** 사진의 외부 전송은 **없음**(AI 가상 피팅 기능 2026-07-14 폐기). 기기 내 재사용 보관 사진은 **7일 자동 폐기**.
- iOS Privacy Manifest 준비됨: `ios-templates/PrivacyInfo.xcprivacy`(사진=PhotosOrVideos·App Functionality·Not Linked·No Tracking, UserDefaults/FileTimestamp/SystemBootTime API 사유 코드 포함). CI가 App 타겟 리소스로 등록.

### 4.2 Google Play Data Safety
- 수집/공유 데이터: **없음** — 사진·치수 전부 기기 로컬 처리(서버 미전송·미공유). 외부 AI 피팅 공유는 2026-07-14 폐기. 사용자 삭제는 인앱 "내 데이터 전부 삭제".
- 위치/연락처/식별자 추적: **없음**.
- 치수: 기기 로컬 저장 = Play 기준 "수집(collected)" 아님(서버 미전송)으로 신고.

---

## 5. Apple Guideline 4.2 (Minimum Functionality) 방어 논리

App Store 심사에서 "웹사이트 래퍼/최소 기능" 사유(4.2) 리젝 가능성에 대한 대응 근거:

1. **네이티브 하드웨어 사용:** 카메라(신체 사진 촬영, `@capacitor/camera`), 햅틱 피드백(`@capacitor/haptics`), StatusBar/SplashScreen 네이티브 제어 — 단순 웹뷰가 아니라 기기 기능을 사용.
2. **온디바이스 계산 엔진(핵심 가치):** 쇼핑몰 사이즈표 파싱 × 사용자 치수를 결합해 **부위별 핏(오버/타이트)을 계산하는 자체 FitEngine**이 앱 안에서 동작. 단순 콘텐츠 표시가 아닌 **개인화된 예측·정보 생성**.
3. **오프라인 동작:** 치수 입력·핏 예측·데이터 관리가 **네트워크 없이 기기 내에서 완결**(AI 가상 피팅만 선택적 온라인). 웹 링크 모음이 아님.
4. **개인정보 로컬 보관 모델:** 사용자 데이터가 기기에만 저장·자동 만료되는 프라이버시 우선 설계 — 앱 컨테이너의 로컬 저장을 실제로 활용.
5. 심사 노트 문구(권장): *"MyFit is an on-device fit-prediction app. It measures how a specific store's size chart maps to the user's body measurements and predicts fit per body area, using the device camera and local computation. It is not a web wrapper; core prediction runs offline on-device."*

---

## 6. 심사 리젝 단골 대응표

| # | 단골 사유 | MyFit 상태 / 대응 |
|---|-----------|-------------------|
| Apple 4.2 | 최소 기능/웹 래퍼 | §5 방어 논리 + 심사 노트. 카메라·햅틱·온디바이스 엔진 강조 |
| Apple 5.1.1 | 권한 사용 목적 문구 누락/모호 | Info.plist `NSCameraUsageDescription`·`NSPhotoLibraryUsageDescription` 구체 문구 병합(CI). "AI 처리 후 즉시 삭제" 명시 |
| Apple 5.1.1(v) | 계정 없이 기능 접근 제한 | 로그인 없음 — 해당 없음 |
| Apple 1.2 / UGC | 사용자 생성 콘텐츠 | 사진은 기기 로컬 + AI 처리 후 삭제, 서버 저장 없음. 신고/차단 대상 아님(공유 기능 없음) |
| Apple 2.1 | 크래시/미완성 | 스토어 빌드 EXIT=0, /terms·/privacy 인앱 라우트 렌더 확인(콘솔 에러 0) |
| Play 데이터 안전 불일치 | 실제 동작 ↔ Data Safety 신고 불일치 | §4.2 표대로 정확히 신고(사진 전송·암호화·삭제 요청) |
| Play 권한 과다 | 불필요 권한 | Manifest = INTERNET/CAMERA/READ_MEDIA_IMAGES/POST_NOTIFICATIONS/VIBRATE만. 카메라 `required=false` |
| Play target API | API 35 미충족 | 이미 35 충족 |
| Play 개인정보처리방침 | URL 누락/미접속 | 라이브 URL 제공(§3.3) |
| Play 비공개 테스트 미완 | 개인계정 12명·14일 | 조직 계정 등록으로 우회 or 테스터 12명 확보 |

---

## 7. 자산·경로 요약

- App Store 1024 아이콘: `renewal/myfit-mobile/public/icons/appstore-icon-1024.png` (신규, 이번 세션 생성)
- 아이콘 생성기(전 사이즈): `renewal/myfit-mobile/public/icons/icon-generator.html`
- Play 512 아이콘: `renewal/myfit-mobile/android/play-store-icon.png`
- iOS 권한/프라이버시 템플릿: `renewal/myfit-mobile/ios-templates/{Info.plist.additions, PrivacyInfo.xcprivacy}`
- Android 권한 패치: `renewal/myfit-mobile/android-templates/AndroidManifest.xml.patch`
- 이용약관(인앱): `renewal/myfit-mobile/src/app/terms/page.tsx` → `/terms`
- 개인정보처리방침(정적): `renewal/myfit-mobile/public/privacy.html`
- CI: `.github/workflows/{android-build.yml, ios-build.yml}` (workflow_dispatch 전용)

---

## 8. 미해결 / 회장 결정 필요

1. **[BLOCKER] 새 keystore 생성 + 서명 Secrets 등록** (§1) — 이것 없이는 Android AAB 서명 불가.
2. **Google Play 계정 유형 결정**: 개인(12명·14일 테스트 의무) vs 조직/법인(면제, D-U-N-S 유사 검증). → 조직 권장.
3. **iOS 서명 인증서/프로파일** — TestFlight/제출용. 현 CI는 unsigned 검증까지.
4. **스크린샷·피처그래픽** 실기기 캡처(디자인 작업).
5. ~~AI 가상 피팅 벤더~~ — **해소(2026-07-14): 외부 가상 피팅 전면 폐기 확정(회장). 치수 핏 예측 단독으로 제출.**
