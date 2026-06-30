# MyFit Extension — 배포 가이드 (회장 직접 실행용)

## 사전 조건
- Node.js 18+ 설치됨
- `npm install -g wrangler` 완료 (또는 `npx wrangler` 사용)
- Cloudflare 계정 kgg2512@gmail.com 로그인 필요

---

## STEP 1 — Cloudflare 로그인

```powershell
npx wrangler login
# 브라우저가 열리면 kgg2512@gmail.com으로 로그인
```

---

## STEP 2 — KV 네임스페이스 생성

```powershell
cd "c:\Users\kgg25\Desktop\G2 Company Ltd\myfit-extension\workers\fashn-proxy"
npx wrangler kv:namespace create "MYFIT_RATE_LIMIT"
```

터미널 출력 예시:
```
{ binding = "RATE_LIMIT_KV", id = "abc123def456..." }
```

출력된 id 값을 복사해서 wrangler.toml의 아래 줄에 붙여넣기:

```toml
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id      = "여기에_붙여넣기"
```

---

## STEP 3 — TryOnCloud API Key 등록

```powershell
npx wrangler secret put TRYONCLOUD_API_KEY
# 프롬프트에서 TryOnCloud API Key 입력 (https://www.tryoncloud.com 에서 발급)
```

---

## STEP 4 — Worker 배포

```powershell
npx wrangler deploy
```

성공 시 출력:
```
Published myfit-fashn-proxy (X.XX sec)
  https://myfit-fashn-proxy.kgg2512.workers.dev
```

> panel.js의 `CF_WORKER_URL`이 이미 `https://myfit-fashn-proxy.kgg2512.workers.dev`로 설정됨.
> 위 URL과 일치하면 추가 변경 불필요.

---

## STEP 5 — 로컬 테스트 (선택)

```powershell
# .dev.vars 파일 생성 (프로젝트 루트에)
echo "TRYONCLOUD_API_KEY=your_actual_key" > .dev.vars
echo "ENVIRONMENT=development" >> .dev.vars

npx wrangler dev
# http://localhost:8787/health 접속 → {"status":"ok"} 확인
```

---

## STEP 6 — Chrome Extension 로컬 로드 (테스트)

1. Chrome 열기 → `chrome://extensions`
2. 우측 상단 "개발자 모드" 토글 ON
3. "압축 해제된 확장 프로그램 로드" 클릭
4. `c:\Users\kgg25\Desktop\G2 Company Ltd\myfit-extension` 폴더 선택
5. 무신사/Nike/Zara/Uniqlo/H&M 상품 페이지 방문
6. 우측 하단 👗 버튼 클릭 → 사이드 패널 확인

---

## STEP 7 — Chrome Web Store 제출 (CWS)

CWS 제출은 별도 가이드 참조: `CWS_SUBMISSION_GUIDE.md`

ZIP 패키징:
```powershell
cd "c:\Users\kgg25\Desktop\G2 Company Ltd\myfit-extension"
# node_modules 제외하고 압축
Compress-Archive -Path manifest.json,src,sidepanel,lib,icons,privacy-policy.html -DestinationPath ..\myfit-extension.zip -Force
```

---

## 현재 상태 요약

| 항목 | 상태 |
|------|------|
| CF Worker 코드 | 완성 (`workers/fashn-proxy/worker.js`) |
| KV Namespace ID | **미설정** — STEP 2 실행 필요 |
| TryOnCloud API Key | **미등록** — STEP 3 실행 필요 |
| Worker 배포 | **미배포** — STEP 4 실행 필요 |
| Extension 코드 | 완성 (MV3, 버그 수정 완료) |
| CWS 제출 | 미완 — Worker 배포 후 진행 |
