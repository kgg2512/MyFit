# MyFit P10 — 3채널 구글 로그인 + 클라우드 신체정보 저장 (설계 확정 · Firebase)

> **회장 지시 (2026-07-11~12):** ①웹·안드·확장·iOS 3~4채널 전부 구글 계정 로그인 + 신체정보 저장(기억) ②Apple 로그인은 iOS 필수면 구현 ③백엔드 = **Firebase 확정**("일단 MyFit만 Firebase로, 나중에 문제 생기면 Supabase로 바꿔도 됨").
> **백엔드 선택 경위:** Supabase 무료는 **유저당 활성 2개** 한도(Cinderella·welkor로 꽉 참, 새 조직도 owner=kgg2512라 무효 — 2026-07-12 create_project 실제 시도로 [확인]). Firebase Spark(무료)는 프로젝트 수 무제한급 + 결제수단 불필요 + 구글 자사라 구글 로그인 최적 → MyFit=Firebase. **교체 가능성 대비: 인증·저장을 추상화 레이어로 감싼다(아래 §B).**
> 구현 착수 전제 = 회장 Firebase 콘솔 작업(§7). 현 상태 = 설계 확정 + 회장 준비물 대기.

## 0. 방향 확정
- 인증 = **Firebase Authentication (Spark 무료)**, Google 로그인. 3~4채널이 **단일 Firebase 프로젝트** 공유 → 같은 `uid`로 채널 불문 같은 사람 = 같은 신체정보.
- 저장 = 치수(숫자)만 **Cloud Firestore** + Security Rules 클라우드 동기화. **사진은 온디바이스 유지**(P9 정책 불변, Firebase Storage 미사용 → Blaze 승급 불필요, Spark 무료 유지).
- 리전 = **asia-northeast3(서울)** — 국외이전 고지 회피(Firestore 리전 선택).
- 로그인 = **선택**(게스트 유지 가능 — 현 "서버 무전송" 스탠스 최대 보존, 로그인 시에만 치수 클라우드 동기화).

## A. Apple 4.8 (변경 없음 — 백엔드 무관)
- [확인] 공식 가이드라인 4.8: iOS 앱이 구글 로그인을 주 인증으로 쓰면 "이름·이메일만 수집 + 이메일 숨김 + 광고추적 없음" 동등 옵션 필수 → 실무상 **Sign in with Apple 병행**. **iOS만 적용**, 웹·안드·확장 무관.
- Firebase Auth는 Apple 로그인 provider를 **기본 지원**(`OAuthProvider('apple.com')`) → iOS 단계에서 구글+애플 병행 구현.

## B. ★ 교체 가능 추상화 레이어 (회장 "나중에 Supabase로 바꿀 수도" 대비)
FitEngine을 인터페이스로 추상화한 것과 동일 패턴. Firebase 직접 호출을 앱 코드에 흩뿌리지 말고 **단일 어댑터 뒤에 격리**:
```
src/lib/auth/
  AuthProvider.ts      // 인터페이스: signInWithGoogle() / signOut() / onAuthChange(cb) / currentUser()
  FirebaseAuthProvider.ts   // Firebase 구현 (현재)
  // SupabaseAuthProvider.ts  // 나중에 교체 시 이것만 신규 작성
  index.ts             // 싱글톤 export (여기서만 구현체 선택)
src/lib/cloud/
  CloudStore.ts        // 인터페이스: loadMeasurements(uid) / saveMeasurements(uid, m) / deleteAll(uid)
  FirestoreStore.ts    // Firestore 구현 (현재)
  index.ts
```
- 앱 페이지·storage.ts는 `AuthProvider`/`CloudStore` 인터페이스만 참조 → 백엔드 교체 시 어댑터 2개만 갈아끼움. **교체 비용 최소화.**

## C. 채널별 방식 ([확인]=Firebase 공식 문서 기반, [추정]=미검증)
| 채널 | 방식 | 리스크 |
|---|---|---|
| 웹(GH Pages 정적) | `signInWithPopup(GoogleAuthProvider)` 또는 정적 사이트 팝업 차단 대비 `signInWithRedirect`. 서버 불필요. | 승인 도메인에 `kgg2512.github.io` 등록 필수 |
| 안드로이드(Capacitor) | `@capacitor-firebase/authentication` 플러그인(네이티브 Google Sign-In) → Firebase 세션 | google-services.json 필요 |
| iOS(Capacitor) | 위 + **Sign in with Apple 병행**(`OAuthProvider('apple.com')`, 4.8) | Apple 개발자 $99/년 |
| 크롬 확장(MV3) | `chrome.identity.launchWebAuthFlow` 또는 `getAuthToken`(구글) → `signInWithCredential(GoogleAuthProvider.credential(idToken))`. 서비스워커는 `chrome.storage` 세션 퍼시스트. [추정] offscreen document 필요할 수 있음 | MV3 서비스워커 지속성 |

## D. Firestore 스키마 초안 (미적용)
```
컬렉션 profiles/{uid}
  { height, weight, shoulder, chest, waist, hip, updatedAt }
```
Security Rules:
```
match /profiles/{uid} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```
- 로컬→클라우드 병합: 최초 로그인 시 로컬 `Measurements` 있고 서버 문서 없으면 1회 write. 충돌 해소 위해 `Measurements`에 `savedAt`(epoch ms) 필드 추가 선행.
- 탈퇴 = Firestore `profiles/{uid}` 문서 삭제 + Firebase Auth 계정 삭제(PIPA 삭제권). 현 `clearAllData`는 로컬만 지움.

## E. 🔒 프라이버시(CISO+CLO)
- **치수만 클라우드(Firestore), 사진 온디바이스 유지.** Firebase Storage 미사용.
- 인증 토큰: 웹=Firebase SDK 기본(IndexedDB), 확장=`chrome.storage.local`, 모바일=플러그인 보안 스토리지.
- 개인정보처리방침 개정: 수집(치수 6종)·목적(기기 간 동기화)·보관(로그인 중~탈퇴 시 삭제)·**처리위탁(Google LLC — Firebase)**·서울 리전. "클라우드 계정 저장 동의" 별도 옵트인.
- ⚠️ 처리위탁사가 Supabase Inc.→**Google LLC**로 바뀜(CLO 문구 반영 필요).

## F. 데모/스토어 분리 하의 로그인
- 데모 빌드(DEMO_MODE=true): 로그인 UI 조건부 미포함(tree-shaking), Firebase 초기화 skip. `demo-isolation-check`로 데모 산출물에 Firebase config·auth 심볼 잔존 검증.
- 스토어 빌드(DEMO_MODE=false)에만 Firebase config 주입(config는 공개 클라이언트 키라 노출 자체는 안전, 단 데모엔 불포함).

## 6. 단계별 로드맵
| 단계 | 내용 | 게이트 |
|---|---|---|
| P10-0 | 회장 Firebase 프로젝트 생성(§7) + Firestore(서울)·Security Rules + `Measurements.savedAt` 추가 + 추상화 레이어(§B) 뼈대 | 🔒CISO(Rules) |
| P10-1 | 웹 Google 로그인 (데모 `/demo/v2` 검증 → `/v2` 승격) + 치수 클라우드 동기화 | 실로그인 1회+세션유지+로컬→클라우드 병합 실측, 🔒CISO+CLO |
| P10-2 | 크롬 확장 로그인(`launchWebAuthFlow`+`signInWithCredential`) | 확장 uid = 웹 uid 동일 확인 |
| P10-3 | 안드로이드(`@capacitor-firebase/authentication`) | Android 로그인 성공 실측 |
| P10-4 | iOS(구글 + **Sign in with Apple** 병행) | iOS 로그인 + Apple 4.8 심사 통과, 🔒 |
| P10-5 | 개인정보처리방침·동의 개정(위탁사 Google) + 탈퇴=서버 삭제 | CLO 문구 확정, 삭제 실측 |

## 7. ⚠️ 회장 준비물 (P10-0 착수 전제 — 회장 Google 계정 작업, 5분)
1. https://console.firebase.google.com → **프로젝트 만들기** (이름 예: `myfit-app`). Google 애널리틱스는 꺼도 됨.
2. 좌측 **빌드 > Authentication > 시작하기 > Google** 공급자 사용 설정.
3. **프로젝트 설정(톱니) > 내 앱 > 웹앱(</>) 추가** → 표시되는 **firebaseConfig**(apiKey·authDomain·projectId 등) 복사해서 Alpha에게 전달. (이 config는 공개 클라이언트 키라 노출 안전 — 보안은 Security Rules가 담당)
4. Authentication > Settings > **승인된 도메인**에 `kgg2512.github.io` 추가.
5. (Firestore) 빌드 > Firestore Database > 데이터베이스 만들기 > 위치 **asia-northeast3(서울)**.
→ **3번의 firebaseConfig만 주시면** 웹 로그인(P10-1) 구현·검증 착수. iOS(Apple $99)는 P10-4에서만 필요.

## 미해결·리스크
- 크롬 확장 MV3에서 Firebase Auth 지속성(offscreen document 필요 여부) — 구현 단계 실검증.
- `Measurements.savedAt` 부재 → 병합 로직 전 스키마 확장 선행.
- Firestore Spark 한도(읽기 50K/일·쓰기 20K/일): MyFit 규모(로그인 시 1회 read/write)엔 충분, 폭증 시 Blaze 무료 사용량 내 or 캐싱.
- 정식 출시 전 약관·개인정보처리방침 변호사 검토(위탁사 Google 반영) — CLO 권고.

---
## 부록: Supabase 설계(폐기, 이력 보존)
초기 P10 설계는 Supabase Auth(PKCE·RLS·서울 리전) 기준이었으나 무료 유저당 2개 한도로 불가 판정(2026-07-12). Firebase로 전환. 나중에 Supabase 복귀 시 §B 어댑터의 `SupabaseAuthProvider`/`SupabaseStore`만 신규 작성하면 됨(앱 코드 불변).
