# MyFit P10 — 3채널 구글 로그인 + 클라우드 신체정보 저장 (설계 확정)

> **회장 지시 (2026-07-11):** "휴대폰 앱(구글 플레이·애플 앱스토어)·웹·크롬 확장 3개 다 나눠서 배포·운영. 셋 다 구글 계정 로그인으로 본인인증 + 신체 사이즈/신체 정보 저장(기억)이 구현 가능해야 한다." + Apple 로그인 관련 "필수라면 그렇게 해라."
> 이 문서 = P10 설계 확정본. **구현 착수는 회장 자격증명(Supabase/Google/Apple 계정) 준비 후.** 현 상태 = 설계 승인 대기 + 회장 준비물 대기.

## 0. 방향 확정
- 인증 = **Supabase Auth (무료 티어)**, Google OAuth. 3채널이 **단일 Supabase 프로젝트** 공유 → `auth.users.id`로 채널 불문 같은 사람 = 같은 신체정보.
- 저장 = 치수(숫자)만 Postgres + RLS 클라우드 동기화. **사진은 온디바이스 유지**(P9 정책 불변). 로그인 = **선택**(게스트 유지 가능 — 현 "서버 무전송" 스탠스 최대 보존).
- 리전 = **서울(ap-northeast-2)** — 국외이전 고지 회피(기존 Cinderella·welkor도 서울, 무료 가능).

## 1. Apple 4.8 사실 확인 (2026-07-11, 공식 가이드라인 직접 확인 — [확인])
공식 원문(developer.apple.com/app-store/review/guidelines #4.8):
> "제3자/소셜 로그인(Google Sign-In 등)으로 주 계정을 인증하는 앱은 **동등한 옵션으로 다른 로그인 서비스**를 제공해야 한다 — ①수집을 이름·이메일로 제한 ②이메일 비공개 가능 ③동의 없는 광고 추적 없음."

**회장 질문 답:**
- **"구글 로그인만 넣으면 반려되나?"** → [확인] **예.** iOS 앱에서 구글 로그인이 주 인증 수단이면 위 3조건을 충족하는 동등 옵션이 **반드시** 있어야 하고, 없으면 4.8 위반 반려.
- **"Apple 로그인을 반드시 구현해야 하나?"** → [확인] **Sign in with Apple 자체가 유일 강제는 아님.** 3조건 충족하는 다른 로그인이면 됨. 그러나 그 조건(특히 "이메일 숨김")을 가장 쉽게 충족하는 게 Sign in with Apple이라 **실무 표준**. 자체 이메일/비번 계정으로 조건 맞추는 건 구현 부담이 더 큼.
- **예외(4.8 미적용):** 자체 계정 시스템만 사용 / 앱마켓 / 교육·기업 / 정부 ID / 특정 제3자 서비스 클라이언트. **MyFit은 해당 없음.**

**→ 결정: iOS 앱에 로그인을 넣는 순간 Sign in with Apple 병행이 사실상 필수.** 회장 지시("그렇다면 그렇게 해라")대로 **iOS 단계에 Apple 로그인 포함 확정.**
- 단, **웹·안드로이드·크롬 확장은 4.8 무관**(Apple 심사 대상 아님) → 구글 로그인만으로 가능.
- iOS 회피 대안(참고): iOS만 게스트 전용 출시 → 로그인은 웹/안드로이드/확장 먼저. 하지만 회장이 3채널 전부 로그인을 원하시므로 **Apple 로그인 구현으로 확정.**

## 2. 채널별 방식 (g2-backend-engineer 조사, context7/WebSearch 근거 [확인])
| 채널 | 방식 | 리스크 |
|---|---|---|
| 웹(GH Pages 정적) | Supabase `signInWithOAuth` PKCE + `detectSessionInUrl` — 서버 콜백 불필요, 정적으로 동작 | redirectTo를 Supabase 화이트리스트에 정확 등록 |
| 안드로이드(Capacitor) | 네이티브 Google Sign-In → `signInWithIdToken(idToken, accessToken)` | iOS 브라우저 리다이렉트 불안정 회피 경로 |
| iOS(Capacitor) | 위 + **Sign in with Apple 병행(4.8)** | Apple 개발자 계정 $99/년 필요 |
| 크롬 확장(MV3) | `chrome.identity.launchWebAuthFlow` + `identity` 권한 | 서비스워커엔 localStorage 없음 → `chrome.storage.local` 커스텀 어댑터 필수 |

## 3. 스키마 초안 (서울 리전, 미적용)
```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  height numeric, weight numeric,
  shoulder numeric, chest numeric, waist numeric, hip numeric,
  updated_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "own row" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
```
- 로컬→클라우드 병합: 최초 로그인 시 로컬 `Measurements`가 있고 서버 row 없으면 1회 upsert. **충돌 해소 위해 `Measurements`에 `savedAt` 필드 추가 선행 필요**(현재 없음).
- 탈퇴 = 서버 `profiles` row 실제 DELETE (PIPA 삭제권 — `clearAllData`가 현재 로컬만 지움).

## 4. 🔒 프라이버시(CISO+CLO) 필수 항목
- **치수만 클라우드, 사진 온디바이스 유지.** 인증 토큰: 웹=supabase-js 기본(PKCE), 확장=`chrome.storage.local`, 모바일=보안 스토리지 검토.
- 개인정보처리방침 개정: 수집항목(치수 6종)·목적(기기 간 동기화)·보관(로그인 중~탈퇴 시 삭제)·처리위탁(Supabase Inc.)·서울 리전. **"클라우드 계정 저장 동의"** 별도 옵트인.
- Supabase `get_advisors` 보안경고 0 확인 후 배포.

## 5. 데모/스토어 분리 하의 로그인
- 데모 빌드(DEMO_MODE=true): 로그인 UI 조건부 미포함(dead-code 제거), Supabase 클라이언트 초기화 skip. Google Console 승인 리디렉션 URI에 데모 도메인 미등록 = 2중 안전망.
- 스토어 빌드(DEMO_MODE=false)에만 실제 `SUPABASE_URL`/`ANON_KEY` 주입. `demo-isolation-check`로 데모 산출물에 로그인 심볼 잔존 검증.

## 6. 단계별 로드맵
| 단계 | 내용 | 게이트 |
|---|---|---|
| P10-0 | Supabase 신규 프로젝트(서울) + `profiles`·RLS + `Measurements.savedAt` 추가 | `get_advisors` 0, 🔒CISO |
| P10-1 | 웹 Google OAuth (데모 `/demo/v2` 검증 → `/v2` 승격) | 실로그인 1회+세션 유지 실측, 🔒CISO+CLO |
| P10-2 | 로컬→클라우드 병합(최초 1회 upsert) | 로그인 전 로컬값이 DB row로 반영 실측 |
| P10-3 | 크롬 확장 OAuth | 확장 유저ID = 웹 유저ID 동일 확인 |
| P10-4 | 안드로이드(네이티브 Google Sign-In) | Android 로그인 성공 실측 |
| P10-5 | **iOS(Google Sign-In + Sign in with Apple 병행)** | iOS 로그인 성공 + Apple 4.8 심사 통과, 🔒 |
| P10-6 | 개인정보처리방침·동의 개정 + 탈퇴=서버 삭제 | CLO 문구 확정, DELETE 실측 |

## 7. ⚠️ 회장 준비물 (P10-0 착수 전제 — 회장 자격증명 필요)
1. **Supabase 조직 계정** 접근(현재 Cinderella·welkor와 같은 조직 사용 가능 — MyFit 프로젝트 신규 생성).
2. **Google Cloud Console** OAuth 동의 화면 + Client ID 발급(회장 구글 계정) — 웹/확장/모바일 각 리디렉션 URI.
3. **Apple 개발자 계정 $99/년** (iOS P10-5 전용 — iOS 출시 시점에 필요, 그전 단계는 불요).
→ 위 3개 중 준비되는 것부터 단계적 착수 가능(웹·안드·확장은 Apple 계정 없이 P10-1~4 진행).

## 미해결·리스크
- Supabase 무료 티어 MAU 한도·최신 가격 미확인.
- Google OAuth consent screen 외부 사용자 검증(도메인 소유 등) 절차 미조사.
- `Measurements.savedAt` 부재 → 병합 로직 전 스키마 확장 선행.
