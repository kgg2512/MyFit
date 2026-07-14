/**
 * myfit-web-proxy — MyFit 정적 사이트(GitHub Pages) 앞단 보안헤더 프록시
 *
 * 목적(G2 보안감사 2026-07-08): GitHub Pages는 커스텀 HTTP 헤더가 불가라
 *   frame-ancestors/X-Frame-Options(클릭재킹 완전차단)·HSTS·헤더기반 CSP를 못 건다.
 *   이 워커가 Pages를 1:1 프록시하며 보안 헤더를 주입한다 → 헤더기반 방어 성립.
 *
 * 배포: cd worker/myfit-web-proxy && wrangler deploy
 * 사용: 카나리 URL(myfit-web-proxy.<acct>.workers.dev)로 검증 후, 커스텀 도메인 연결 시
 *   그 도메인이 Pages 대신 canonical이 되어 전 사용자에게 헤더 적용(회장 도메인 결정).
 *
 * CSP는 v2 런타임 실측 리소스로 스코프: Google Fonts·Adobe Typekit·musinsa 이미지·blob/data.
 * script-src는 Next 하이드레이션 인라인 때문에 'unsafe-inline' 허용하되 'unsafe-eval'은 불허(XSS 방어).
 */

const ORIGIN = "https://kgg2512.github.io";

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://use.typekit.net https://p.typekit.net",
  "font-src 'self' data: https://fonts.gstatic.com https://use.typekit.net https://p.typekit.net",
  "img-src 'self' data: blob: https://image.musinsa.com https://kgg2512.github.io",
  "connect-src 'self' https://use.typekit.net https://p.typekit.net",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = {
  "Content-Security-Policy": CSP,
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // GitHub Pages 오리진으로 동일 경로 프록시(1:1). 절대 asset 경로(/MyFit/v2/_next/*)도 그대로 프록시됨.
    const target = ORIGIN + url.pathname + url.search;
    const originReq = new Request(target, {
      method: request.method,
      headers: request.headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
    });

    let originResp;
    try {
      originResp = await fetch(originReq);
    } catch (_e) {
      return new Response("Upstream fetch failed", { status: 502 });
    }

    // 응답 복제 + 보안 헤더 주입(오리진의 약한/부재 헤더를 덮어씀).
    const resp = new Response(originResp.body, originResp);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) resp.headers.set(k, v);
    // Pages가 주는 값 중 무의미/충돌 헤더 정리
    resp.headers.delete("X-GitHub-Request-Id");
    return resp;
  },
};
