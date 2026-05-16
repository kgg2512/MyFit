# G2 Company Ltd — 프로젝트 상세

## MyFit (활성 프로젝트 #1)
**유형:** AI 기반 모바일 가상 피팅 앱 (iOS/Android/Web)  
**GitHub:** kgg2512/MyFit  
**배포:** https://kgg2512.github.io/MyFit/  
**상태:** Phase 1 — 프로토타입 완성, 투자자 데모 준비  

### 핵심 기술
1. **3D 신체 모델링** ⭐ — 사진 3장 → 정확한 3D 신체 재현 (MediaPipe + Three.js)
2. **의류 DB 통합** — 무신사, Nike, Adidas, Zara, H&M
3. **가상 피팅 시뮬레이션** — 실제 의류 사이즈 반영, 사이즈별 핏 분석
4. **E-commerce 연동** — 구매까지 완전 통합 (네이버쇼핑, 카카오쇼핑 등)

### User Flow
구글 로그인 → 신체정보 입력(신장/체중) → 3장 촬영(정면/측면/후면)
→ AI 3D 신체 생성 → 의류 검색 → 가상 피팅 → 사이즈 선택 → 구매 → 결제

### 화면 구성 (index.html)
- S1: Google 로그인
- S2: 사진 3장 촬영 (정면/측면/후면)
- S3: AI 분석 처리 애니메이션 (4단계)
- S4: 신체 프로필 (6개 측정값 + 정확도 94.2%)
- S5: 의류 텍스트 검색 (15개 제품 DB, 한국어 키워드 매핑)
- S6: Three.js 3D 가상 피팅 (드래그 회전, 사이즈별 스케일)
- S7: 구매처 선택 (4개 플랫폼)

### 완료 항목
- [x] index.html 7화면 완성 (Three.js 3D 피팅 포함)
- [x] myfit_prototype.html 투자자 데모 (6화면)
- [x] GitHub Pages 배포
- [x] FastAPI 백엔드 (api/main.py) — MediaPipe tasks API
- [x] render.yaml — Render.com 무료 배포 설정
- [x] 모두의창업 신청 완료 (2026.05.15)

### 진행 예정
- [ ] FASHN AI API 연동 ($0.075/장, 무료 15크레딧)
- [ ] Nike/무신사 실제 제품 DB (5~10개)
- [ ] Google OAuth 실제 연동
- [ ] 백엔드 Render.com 배포 활성화
- [ ] 사업계획서 작성

### 기술 스택
- Frontend: HTML/CSS/JS, Three.js 0.160.0
- Backend: FastAPI, MediaPipe Tasks API, OpenCV
- 3D: Three.js (기하학 조합 인체), SMPL-X (서버사이드 예정)
- Hosting: GitHub Pages (frontend), Render.com (backend)
- CI/CD: 자동 커밋 훅 (15분 간격)

### 인프라 비용 (현재)
- GitHub Pages: 무료
- Render.com 무료 tier: 750시간/월
- Three.js CDN: 무료 (jsdelivr)
- 총 월 비용: $0
