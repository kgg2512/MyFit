# MyFit Extension — 배포 가이드

> **⚠️ 2026-07-14 전면 개정: AI 가상피팅(외부 벤더) 기능 폐기 (회장 확정).**
> 구 버전의 이 문서는 CF Worker(myfit-fashn-proxy) 배포와 외부 벤더 API Key 등록 절차를 담고 있었다.
> 해당 기능·API Key 절차는 모두 폐기되었으며, 확장은 이제 **외부 서버 의존이 없는 로컬 치수/핏 시각화 도구**다.

## 현행 배포 절차 (Chrome Web Store)

1. `.\build.ps1` 실행 → `myfit-extension.zip` 생성
2. Chrome Web Store Developer Dashboard에 ZIP 업로드
3. 스토어 리스팅 텍스트: `CWS_STORE_LISTING.md` / 제출 절차: `CWS_SUBMISSION_GUIDE.md` 참고
4. Privacy Policy URL: https://kgg2512.github.io/MyFit/privacy-policy.html

## 잔여 (회장 크리덴셜 필요)

- 구 CF 워커(`myfit-fashn-proxy`) 실배포 teardown — Cloudflare 크리덴셜 필요.
  teardown 전까지는 `worker/myfit-fashn-proxy.js`(410 Gone 스텁)를 `wrangler deploy`로 배포해
  구 클라이언트 호출에 기능 종료를 명시한다.
