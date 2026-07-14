# MyFit

**G2 Company Ltd 공식 프로젝트**

> 한 벌을 사기 전에, **맞을지**부터.
> *Shop with confidence, not guesswork.*

MyFit은 온라인 쇼핑에서 "이 옷 나한테 맞을까?"를 해결합니다.
서로 다른 두 접근을 거쳤으며, **두 버전을 각각 독립적으로 유지·배포**합니다.

---

## 🔀 두 버전 (명확히 분리)

| | **신형 (renewal)** | **구형 (legacy)** |
|---|---|---|
| 별칭 | 치수 기반 핏 예측 · TrueToForm 벤치마킹 | AI 가상 피팅 · 라이브 버전 |
| 접근 | 내 치수 × 사이즈표 → 부위별 핏 **예측** | 사진 → AI가 옷 입은 모습 **합성** |
| 소스 폴더 | [`renewal/`](renewal/) (`myfit-mobile` Next.js + `myfit-extension`) | [`legacy/`](legacy/) (정적 빌드 + api) |
| 배포 경로 | **`/v2/`** | **`/legacy/`** |
| 라이브 | https://kgg2512.github.io/MyFit/v2/ | https://kgg2512.github.io/MyFit/legacy/ |

**진입점(버전 선택):** https://kgg2512.github.io/MyFit/

---

## 📁 폴더 구조 (한 폴더 = 한 버전 = 별도 업데이트)

```
MyFit/
├── index.html      ← 버전 선택 랜딩
├── renewal/        ← 【신형】 소스 (여기서 개발)
│   ├── myfit-mobile/     Next.js 15 (웹+Capacitor 앱)
│   └── myfit-extension/  크롬 확장
├── v2/             ← 【신형】 웹 배포본 (renewal 빌드 결과, 자동 서빙)
├── legacy/         ← 【구형】 소스=배포본 (정적)
│   ├── index.html  app/  app-demo/  api/  ...
├── docs/  VERSIONS.md
```

- **신형을 업데이트**하려면 → `renewal/myfit-mobile` 편집 → `.\build-all.ps1 -Target web` (→ `/v2/` 갱신) → commit+push
- **구형을 업데이트**하려면 → `legacy/` 편집 → commit+push (정적, 즉시 반영)
- 두 버전은 서로를 건드리지 않는다. 자세한 연혁·차이 = [`VERSIONS.md`](VERSIONS.md)

---

## 기술 스택

- **신형**: Next.js 15 · React 19 · Tailwind v4 · 자체 `FitEngine`(치수→핏) · Capacitor(모바일)
- **구형**: Chrome MV3 · Three.js · Cloudflare Workers · (외부 AI 합성 벤더는 2026-07-14 전면 폐기 — 워커 410 스텁)

---

© 2026 G2 Company Ltd. All rights reserved.
