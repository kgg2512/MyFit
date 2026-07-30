# MyFit — 골모드 P2 감사 (2026-07-24)

> 브랜치 `goal/20260724-myfit` · 방식: 코드/DB/빌드 실측 · 불변제약: FitEngine 유지·TryOnCloud 재도입 금지

## G0 실측 인벤토리
| 항목 | 실측 결과 |
|------|----------|
| 레포/브랜치 | `kgg2512/MyFit` / master(clean) → 작업 `goal/20260724-myfit` |
| 버전 구분 | 구형(legacy, AI합성)=**폐기·은퇴**(git 이력만) / 신형(renewal, 치수 FitEngine)=**라이브** |
| 신형 소스 | `renewal/myfit-mobile`(Next.js+Capacitor) + `renewal/myfit-extension`(크롬확장) |
| 데모/스토어 슬롯 | 빌드 타겟 분리: `build:web:demo`↔`build:web:prod`, `build:android:demo`↔`prod`. 산출: `v2/`(스토어 라이브)·`demo/v2/`(데모) |
| FitEngine | `renewal/myfit-mobile/src/lib/fitEngine.ts` + `renewal/myfit-extension/sidepanel/fitEngine.js` **실존** |
| **TryOnCloud 박멸(§E)** | `scripts/eradication_check.py` → **PASS**(현재형 잔존 0, 모든 매칭=묘비/아카이브) |

## G1 코어 플로우 + 치수 데이터 전송 실측
- **불변제약 위반 0**: 자체 FitEngine 유지, TryOnCloud/FASHN 재도입 없음. TrueToForm은 벤치마크 서술로만 존재(엔진 아님).
- **코어 플로우 이미 구축(P1~P10)**: 온보딩→(옵트인)로그인→치수입력→의류/사이즈표→FitEngine 예측→결과(부위별 핏)→저장/공유. 신규 코드 변경 불요(기 구축분 검증).
- **🔒 치수 데이터 egress 정밀 실측** (핵심):
  - **기본값 = 기기 내(localStorage), 외부 전송 0.** 사진 전송은 항상 0(AI피팅 폐기).
  - **유일 egress = 옵트인 Firestore 백업**: `src/lib/cloud/FirestoreStore.ts` `setDoc(profiles/{uid})` = 6종 치수(height/weight/shoulder/chest/waist/hip)+타임스탬프. 게이트 = Google 로그인 + `CLOUD_CONSENT`(로컬 동의와 분리, CLO 블로커 시정 커밋 4aff69d). 본인 uid만 접근(firestore.rules).
  - **판정: "전송 코드 발견 = FAIL"이 아니라, 전송은 존재하되 옵트인·동의·본인계정·공개(disclosed)** — 미공개 유출 0. 단 **기존 Data Safety 문서가 이를 미반영("수집 없음") = 정직성/심사 갭** → G2에서 교정.

## G2 스토어 체크리스트 (P1 ①~⑩ + MyFit 특화)
| 항목 | 판정 | 근거 |
|------|------|------|
| (a) submission_kit 재작성(구 가상피팅 전제 무효화) | ✅ 대부분 기완료 + 교정 | STORE_SUBMISSION.md는 이미 치수 기반으로 작성됨. **단 옵트인 클라우드 미반영분을 §4 Data Safety에 정직 교정(2026-07-24)** |
| (b) 치수 기기외 전송 실증 | ✅ 실증 완료 | 위 G1 — 기본 전송0, 옵트인 Firestore만. Data Safety에 정확 신고하도록 교정 |
| (c) keystore(구=COMPROMISED) | ⏸ 판단 대기 | 구 keystore는 공개레포 커밋으로 오염(문서 §1 확정). 신규 생성=회장 비밀번호 필요(credential) → keytool 명령 준비됨(STORE_SUBMISSION.md §1), 회장 실행 |
| ① 개인정보처리방침 URL | ✅ | `/v2/privacy.html` 라이브 + 인앱 `/privacy` |
| ② 계정/데이터 삭제 | ✅ | 인앱 "내 데이터 전부 삭제"(로컬+`deleteAll` uid) |
| ③ Apple Sign In | 🟡 iOS 시 | 로그인 옵션(Google)만 → iOS 제출 시 Apple Sign In 검토(로그인 자체가 선택적이라 4.8 해석 여지, 회장/CLO 판단) |
| ④ 결제 성격 | ✅ N/A | 결제 없음(무료), IAP 무관 |
| ⑤ 권한 문자열 | ✅ | Android CAMERA/미디어(용도=치수용 사진), iOS Info.plist.additions 완비 |
| ⑥ 핵심 플로우 크래시 0 | 🟡 | 빌드 컴파일 검증(별도 기재), 라이브 실기기 E2E=회장 |
| ⑦ Data Safety 초안 | ✅ 교정 | §4 정직 신고본(옵트인 반영) |
| ⑧ 심사 데모 | ✅ | 로그인 없이 전 기능(심사 노트 문구 준비) |
| ⑨ 타겟 SDK | 🟡 | 현재 35(충족). [확인] 2026-08-31부터 신규앱 API36 필수 → 상향 권고 |
| ⑩ 메타·스크린샷 | 🟡 | 아이콘 완비, 실기기 스크린샷 미완 |

## G3 / 판단 대기 (최종 목록 통합)
- 신규 keystore 생성(회장 비밀번호) + Play App Signing — 문서 §1 절차 준비
- targetSdk 36 상향(2026-08-31 대비)
- Play 계정 유형 결정(개인=12명·14일 테스트 / 법인=면제) — 문서 §3.2
- iOS Apple Sign In 판정 + PrivacyInfo.xcprivacy 옵트인 치수 반영
- 실기기 스크린샷·피처그래픽
