/**
 * myfit-fashn-proxy — 폐기된 가상피팅 프록시의 410 Gone 스텁 (2026-07-14)
 *
 * 회장 확정(2026-07-09 종결 → 2026-07-14 코드 전면 제거): MyFit은 외부 가상피팅
 * 벤더를 사용하지 않는다. v2는 자체 FitEngine(치수 기반 핏 예측)만 사용한다.
 *
 * 이 스텁의 목적: 배포된 구 클라이언트(legacy 빌드 청크)가 아직 이 워커를 호출할 수
 * 있으므로, 모든 구 엔드포인트(/try-on, /g/*, /garment/*)에 410 Gone을 반환해 기능
 * 종료를 명시한다. 요청 본문(사진 등)은 판독·처리·저장하지 않는다.
 *
 * ⚠️ 실배포 teardown(워커 자체 삭제·시크릿 제거)은 회장 CF 크리덴셜 필요.
 *    teardown 전까지는 이 스텁을 `wrangler deploy` 하여 구 코드를 대체할 것.
 */

const GONE_BODY = JSON.stringify({
  error: "가상피팅 기능은 폐기되었습니다. (2026-07-14)",
  code: "FEATURE_RETIRED",
});

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
  if (
    origin &&
    (origin.startsWith("chrome-extension://") ||
      origin.startsWith("capacitor://") ||
      origin === "https://localhost" ||
      origin === "https://kgg2512.github.io")
  ) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export default {
  async fetch(request) {
    const cors = corsHeaders(request.headers.get("Origin") || "");
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    const { pathname } = new URL(request.url);
    if (pathname === "/health") {
      return new Response(JSON.stringify({ status: "retired" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }
    // /try-on, /g/*, /garment/* 포함 전 경로: 기능 폐기 — 410 Gone
    return new Response(GONE_BODY, {
      status: 410,
      headers: { "Content-Type": "application/json", ...cors },
    });
  },
};
