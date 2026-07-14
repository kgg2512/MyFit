# Chrome Web Store 제출 가이드 — MyFit

## 사전 준비 상태

| 항목 | 상태 | 비고 |
|------|------|------|
| manifest.json | 완료 | MV3, 권한 최소화 |
| icon16.png | 완료 | |
| icon32.png | 완료 | |
| icon48.png | 완료 | |
| icon128.png | 완료 | |
| privacy-policy.html | 완료 | 외부 전송 없음(기기 내 처리) — 2026-07-14 가상피팅 폐기 반영 |
| ZIP 패키징 | `.\build.ps1` 실행 | myfit-extension.zip 생성됨 |
| 스크린샷 (1280x800) | 수동 필요 | 아래 참고 |
| 프로모션 이미지 (440x280) | 수동 필요 | 아래 참고 |

---

## 수동 작업 (회장 직접)

### 1. 스크린샷 촬영 (필수 — 최소 1장, 최대 5장)

1. Chrome에서 `chrome://extensions` 열기
2. "개발자 모드" 활성화
3. "압축 해제된 확장 프로그램 로드" → `myfit-extension/` 폴더 선택
4. 무신사(musinsa.com) 상품 페이지 방문
5. Extension 아이콘 클릭 → 사이드 패널 열기
6. `Ctrl+Shift+I` → DevTools → 기기 아이콘(Toggle device toolbar)
7. 해상도를 **1280x800**으로 설정
8. `Ctrl+Shift+P` → "Capture screenshot" 입력 → 실행
9. 파일 저장: `myfit-extension/screenshots/screenshot-1.png`

### 2. 프로모션 이미지 제작 (선택 — 있으면 노출에 유리)

- **Canva 무료**: canva.com → 새 디자인 → 커스텀 사이즈 → **440x280px**
- 텍스트 예시: "AI 가상 피팅 | 쇼핑 전 옷 입어보기"
- 배경색: `#6366f1` (MyFit 인디고)
- 저장: `myfit-extension/screenshots/promo-440x280.png`

---

## Chrome Web Store 제출 절차

### Step 1 — 개발자 등록 (최초 1회, $5)
- https://chrome.google.com/webstore/devconsole 접속
- Google 계정(kgg2512@gmail.com)으로 로그인
- 개발자 등록비 $5 결제 (신용카드)

### Step 2 — 새 항목 등록
1. "새 항목" 클릭
2. ZIP 업로드: `myfit-extension.zip`
3. 스크어샷 업로드 (Step 1에서 촬영한 파일)

### Step 3 — 스토어 정보 입력

| 필드 | 내용 |
|------|------|
| 이름 | MyFit — AI 가상 피팅 |
| 요약 | 쇼핑몰에서 바로 내 옷 입어보기. AI 가상 피팅으로 사이즈 실수 없앤다. |
| 카테고리 | Shopping |
| 언어 | 한국어 |
| Privacy Policy URL | https://kgg2512.github.io/MyFit/privacy-policy.html |

### Step 4 — 개인정보 공개 정보 (중요)
- "개인정보 처리 방침" 탭에서 아래 항목 체크:
  - 사용자 데이터 수집 여부: **예**
  - 수집 항목: 신체 측정치(직접 입력) — 기기 내 저장
  - 외부 전송 여부: **아니오** (신체 사진 수집·외부 전송 없음 — 2026-07-14 가상피팅 폐기)
  - 판매 여부: **아니오**

### Step 5 — 제출 및 심사
- 심사 소요 시간: 보통 1~3 영업일
- 심사 거부 주요 이유: 권한 과다, Privacy Policy 미비, 스크린샷 품질 불량
- 거부 시 수정 후 재제출 가능

---

## Privacy Policy 호스팅

현재 `privacy-policy.html`은 Extension 패키지 내에 포함됨.  
CWS 제출 시 공개 URL이 필요하므로 GitHub Pages에 업로드:

```
대상 URL: https://kgg2512.github.io/MyFit/privacy-policy.html
방법: MyFit 레포(kgg2512/MyFit)의 루트 또는 docs/ 에 privacy-policy.html 복사 후 push
```

---

## ZIP 재생성 방법

```powershell
cd "c:\Users\kgg25\Desktop\G2 Company Ltd\myfit-extension"
.\build.ps1
# 출력: G2 Company Ltd\myfit-extension.zip
```
