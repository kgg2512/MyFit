/**
 * myfit-fashn-proxy — 가상피팅 이미지 프록시 Worker (신체사진 + garment URL 중계)
 *
 * ⚠️ 이 파일은 Cloudflare에 배포된 워커의 **번들 결과물**을 CF API로 회수한 것이다
 *    (원본 pre-bundle 소스는 유실됨 — 2026-07-08 G2 보안감사 P0#1 대응, 버전관리 복원).
 *    계정 faafbdce…(kgg2512), name=myfit-fashn-proxy, compat 2024-01-01,
 *    bindings: ENVIRONMENT(plain_text=production) + RATE_LIMIT_KV(KV). 시크릿은 CF secret(코드 내 0).
 *
 * ✅ 보안(2026-07-08 감사 실측): SSRF 방어 견고 —
 *    isSafeGarmentUrl = https강제 / 모든 IP리터럴·IPv6 거부 / DNS리바인딩 TLD(nip.io·sslip.io…) 차단 /
 *    localhost·.internal·.local·metadata.google.internal 차단 / 리다이렉트 매 홉 재검증(redirect:manual) /
 *    magic-byte 이미지검증 / MAX_IMAGE_BYTES(10MB) / 토큰 exp 검증 / rate-limit / CORS origin 화이트리스트.
 *
 * 재빌드/수정 시: 원본 소스를 새로 작성해 이 파일을 대체하고 wrangler로 배포할 것.
 */
// worker.js
var MAX_IMAGE_BYTES = 10 * 1024 * 1024;
var MAX_GARMENT_URL_LEN = 1024;
var FETCH_TIMEOUT_MS = 12e3;
var MAX_REDIRECTS = 3;
var SIGN_PREFIX = "myfit-garment-proxy:v1:";
var TOKEN_TTL_SEC = 3600;
var RATE_LIMIT_MAX = 3;
var RATE_LIMIT_WINDOW_SEC = 60;
async function checkRateLimit(kv, ip) {
  if (!kv) {
    console.warn("[MyFit Worker] RATE_LIMIT_KV not bound \u2014 rate limiting disabled");
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  const key = `rl:${ip}`;
  const now = Math.floor(Date.now() / 1e3);
  let entry;
  try {
    entry = await kv.get(key, { type: "json" });
  } catch {
    return { allowed: true, remaining: 1 };
  }
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_SEC) {
    await kv.put(key, JSON.stringify({ count: 1, windowStart: now }), {
      expirationTtl: RATE_LIMIT_WINDOW_SEC * 2
    });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfter = RATE_LIMIT_WINDOW_SEC - (now - entry.windowStart);
    return { allowed: false, retryAfter: Math.max(1, retryAfter) };
  }
  await kv.put(key, JSON.stringify({ count: entry.count + 1, windowStart: entry.windowStart }), {
    expirationTtl: RATE_LIMIT_WINDOW_SEC * 2
  });
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count - 1 };
}
__name(checkRateLimit, "checkRateLimit");
function buildCorsHeaders(origin, env) {
  let allowedOrigin = null;
  if (origin && origin.startsWith("chrome-extension://")) {
    allowedOrigin = origin;
  } else if (origin && origin.startsWith("capacitor://")) {
    allowedOrigin = origin;
  } else if (origin && origin === "https://localhost") {
    allowedOrigin = origin;
  } else if (origin && origin === "https://kgg2512.github.io") {
    allowedOrigin = origin;
  } else if (env && env.ENVIRONMENT === "development" && origin === "null") {
    allowedOrigin = "null";
  }
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
  if (allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin;
  }
  return headers;
}
__name(buildCorsHeaders, "buildCorsHeaders");
function jsonResponse(body, status, corsHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders }
  });
}
__name(jsonResponse, "jsonResponse");
function detectImageType(bytes) {
  const b = bytes;
  if (b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255) {
    return { ext: "jpg", contentType: "image/jpeg" };
  }
  if (b.length >= 8 && b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71) {
    return { ext: "png", contentType: "image/png" };
  }
  if (b.length >= 12 && b[0] === 82 && b[1] === 73 && b[2] === 70 && b[3] === 70 && b[8] === 87 && b[9] === 69 && b[10] === 66 && b[11] === 80) {
    return { ext: "webp", contentType: "image/webp" };
  }
  return null;
}
__name(detectImageType, "detectImageType");
function base64ToBytes(base64) {
  const stripped = base64.includes(",") ? base64.split(",")[1] : base64;
  const binaryStr = atob(stripped);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}
__name(base64ToBytes, "base64ToBytes");
function base64ToBlob(base64, mimeType = "image/jpeg") {
  return new Blob([base64ToBytes(base64)], { type: mimeType });
}
__name(base64ToBlob, "base64ToBlob");
function validateImageMagicBytes(base64) {
  let bytes;
  try {
    const stripped = base64.includes(",") ? base64.split(",")[1] : base64;
    const decoded = atob(stripped.slice(0, 24));
    bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  } catch {
    return "base64 \uB514\uCF54\uB529 \uC2E4\uD328 \u2014 \uC720\uD6A8\uD55C \uC774\uBBF8\uC9C0\uAC00 \uC544\uB2D9\uB2C8\uB2E4.";
  }
  if (!detectImageType(bytes)) {
    return "\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uC774\uBBF8\uC9C0 \uD615\uC2DD\uC785\uB2C8\uB2E4. JPEG, PNG, WebP\uB9CC \uD5C8\uC6A9\uB429\uB2C8\uB2E4.";
  }
  return null;
}
__name(validateImageMagicBytes, "validateImageMagicBytes");
function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(b64urlEncode, "b64urlEncode");
function b64urlDecode(s) {
  let t = s.replace(/-/g, "+").replace(/_/g, "/");
  while (t.length % 4) t += "=";
  const bin = atob(t);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
__name(b64urlDecode, "b64urlDecode");
async function hmacHex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hmacHex, "hmacHex");
function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
__name(timingSafeEqual, "timingSafeEqual");
async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(sha256Hex, "sha256Hex");
function isSafeGarmentUrl(urlStr, selfHost) {
  let u;
  try {
    u = new URL(urlStr);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (host.length === 0) return false;
  if (selfHost && host === selfHost.toLowerCase()) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  if (/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(host)) return false;
  if (host.includes(":") || urlStr.includes("[")) return false;
  if (/\.(nip\.io|sslip\.io|xip\.io|traefik\.me)$/.test(host)) return false;
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  if (host.endsWith(".internal") || host.endsWith(".local")) return false;
  if (host === "metadata.google.internal") return false;
  return true;
}
__name(isSafeGarmentUrl, "isSafeGarmentUrl");
async function fetchImageBytes(startUrl, selfHost) {
  let currentUrl = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isSafeGarmentUrl(currentUrl, selfHost)) {
      throw new RehostError(400, "\uD5C8\uC6A9\uB418\uC9C0 \uC54A\uB294 \uC758\uB958 \uC774\uBBF8\uC9C0 URL\uC785\uB2C8\uB2E4 (\uB0B4\uBD80/\uBE44\uACF5\uAC1C \uC8FC\uC18C \uCC28\uB2E8).");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let resp;
    try {
      resp = await fetch(currentUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; MyFitBot/1.0; +https://kgg2512.github.io/MyFit/)",
          "Accept": "image/avif,image/webp,image/png,image/jpeg,*/*"
        },
        redirect: "manual",
        // B1: 자동 추적 금지 — 수동 재검증
        signal: controller.signal
      });
    } catch {
      throw new RehostError(502, "\uC758\uB958 \uC774\uBBF8\uC9C0\uB97C \uAC00\uC838\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. URL\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
    } finally {
      clearTimeout(timer);
    }
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get("Location");
      if (!loc) throw new RehostError(502, "\uC758\uB958 \uC774\uBBF8\uC9C0 \uB9AC\uB2E4\uC774\uB809\uD2B8\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
      try {
        currentUrl = new URL(loc, currentUrl).toString();
      } catch {
        throw new RehostError(502, "\uC758\uB958 \uC774\uBBF8\uC9C0 \uB9AC\uB2E4\uC774\uB809\uD2B8 \uC8FC\uC18C\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
      }
      continue;
    }
    if (!resp.ok) {
      throw new RehostError(502, `\uC758\uB958 \uC774\uBBF8\uC9C0\uB97C \uAC00\uC838\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4 (${resp.status}).`);
    }
    const buf = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    if (bytes.length === 0) throw new RehostError(400, "\uC758\uB958 \uC774\uBBF8\uC9C0\uAC00 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.");
    if (bytes.length > MAX_IMAGE_BYTES) throw new RehostError(413, "\uC758\uB958 \uC774\uBBF8\uC9C0\uAC00 10MB\uB97C \uCD08\uACFC\uD569\uB2C8\uB2E4.");
    const type = detectImageType(bytes);
    if (!type) throw new RehostError(415, "\uC758\uB958 \uC774\uBBF8\uC9C0 \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4 (JPEG/PNG/WebP\uB9CC \uAC00\uB2A5).");
    return { bytes, type };
  }
  throw new RehostError(502, "\uC758\uB958 \uC774\uBBF8\uC9C0 \uB9AC\uB2E4\uC774\uB809\uD2B8\uAC00 \uB108\uBB34 \uB9CE\uC2B5\uB2C8\uB2E4.");
}
__name(fetchImageBytes, "fetchImageBytes");
function validateBody(body) {
  const { human_image, garment_image_url, garment_image_base64 } = body;
  if (typeof human_image !== "string" || human_image.length === 0) {
    return "human_image is required (base64 string)";
  }
  const hasUrl = typeof garment_image_url === "string" && garment_image_url.length > 0;
  const hasB64 = typeof garment_image_base64 === "string" && garment_image_base64.length > 0;
  if (!hasUrl && !hasB64) {
    return "garment_image_url or garment_image_base64 is required";
  }
  if (hasUrl) {
    if (garment_image_url.startsWith("data:")) {
      return "garment_image_url must be a valid https:// URL";
    }
    if (!garment_image_url.startsWith("https://")) {
      return "garment_image_url must use https://";
    }
    if (garment_image_url.length > MAX_GARMENT_URL_LEN) {
      return "\uC758\uB958 \uC774\uBBF8\uC9C0 URL\uC774 \uB108\uBB34 \uAE41\uB2C8\uB2E4.";
    }
  }
  const humanBytes = Math.ceil(human_image.length * 3 / 4);
  if (humanBytes > MAX_IMAGE_BYTES) {
    return "human_image exceeds 10MB limit";
  }
  const humanMimeError = validateImageMagicBytes(human_image);
  if (humanMimeError) return humanMimeError;
  if (hasB64) {
    const garmentBytes = Math.ceil(garment_image_base64.length * 3 / 4);
    if (garmentBytes > MAX_IMAGE_BYTES) {
      return "garment_image_base64 exceeds 10MB limit";
    }
    const garmentMimeError = validateImageMagicBytes(garment_image_base64);
    if (garmentMimeError) return "\uC758\uB958 \uC774\uBBF8\uC9C0: " + garmentMimeError;
  }
  return null;
}
__name(validateBody, "validateBody");
var RehostError = class extends Error {
  static {
    __name(this, "RehostError");
  }
  constructor(status, userMessage) {
    super(userMessage);
    this.name = "RehostError";
    this.status = status;
    this.userMessage = userMessage;
  }
};
async function buildProductImageUrl(body, request, env) {
  const reqUrl = new URL(request.url);
  const origin = reqUrl.origin;
  const selfHost = reqUrl.host;
  if (typeof body.garment_image_url === "string" && body.garment_image_url.length > 0) {
    const url = body.garment_image_url;
    if (!isSafeGarmentUrl(url, selfHost)) {
      throw new RehostError(400, "\uD5C8\uC6A9\uB418\uC9C0 \uC54A\uB294 \uC758\uB958 \uC774\uBBF8\uC9C0 URL\uC785\uB2C8\uB2E4 (https \uACF5\uAC1C \uC8FC\uC18C\uB9CC, \uB0B4\uBD80/\uC790\uAE30\uC8FC\uC18C \uBD88\uAC00).");
    }
    const exp = Math.floor(Date.now() / 1e3) + TOKEN_TTL_SEC;
    const sig = await hmacHex(env.TRYONCLOUD_API_KEY, `${SIGN_PREFIX}${exp}:${url}`);
    return `${origin}/g/${b64urlEncode(url)}.${exp}.${sig}`;
  }
  if (!env.GARMENT_BUCKET) {
    throw new RehostError(
      501,
      "\uC758\uB958 \uC0AC\uC9C4 \uC9C1\uC811 \uC5C5\uB85C\uB4DC\uB294 \uD604\uC7AC \uC900\uBE44 \uC911\uC785\uB2C8\uB2E4. \uC1FC\uD551\uBAB0 \uC0C1\uD488 \uC774\uBBF8\uC9C0 URL\uB85C \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694."
    );
  }
  const bytes = base64ToBytes(body.garment_image_base64);
  if (bytes.length > MAX_IMAGE_BYTES) throw new RehostError(413, "\uC758\uB958 \uC774\uBBF8\uC9C0\uAC00 10MB\uB97C \uCD08\uACFC\uD569\uB2C8\uB2E4.");
  const type = detectImageType(bytes);
  if (!type) throw new RehostError(415, "\uC758\uB958 \uC774\uBBF8\uC9C0 \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4 (JPEG/PNG/WebP\uB9CC \uAC00\uB2A5).");
  const hash = await sha256Hex(bytes);
  const objectKey = `${hash}.${type.ext}`;
  await env.GARMENT_BUCKET.put(objectKey, bytes, {
    httpMetadata: { contentType: type.contentType, cacheControl: "public, max-age=604800" }
  });
  return `${origin}/garment/${objectKey}`;
}
__name(buildProductImageUrl, "buildProductImageUrl");
async function serveSignedProxy(pathname, env, request) {
  if (!env.TRYONCLOUD_API_KEY) return new Response("Not configured", { status: 500 });
  const token = pathname.slice("/g/".length);
  const parts = token.split(".");
  if (parts.length !== 3) return new Response("Bad token", { status: 400 });
  const [b64, expStr, sig] = parts;
  if (!/^\d+$/.test(expStr)) return new Response("Bad token", { status: 400 });
  const exp = parseInt(expStr, 10);
  if (Math.floor(Date.now() / 1e3) > exp) return new Response("Expired", { status: 410 });
  let url;
  try {
    url = b64urlDecode(b64);
  } catch {
    return new Response("Bad token", { status: 400 });
  }
  const expected = await hmacHex(env.TRYONCLOUD_API_KEY, `${SIGN_PREFIX}${exp}:${url}`);
  if (!timingSafeEqual(sig, expected)) {
    return new Response("Forbidden", { status: 403 });
  }
  const selfHost = new URL(request.url).host;
  if (!isSafeGarmentUrl(url, selfHost)) {
    return new Response("Forbidden", { status: 403 });
  }
  let img;
  try {
    img = await fetchImageBytes(url, selfHost);
  } catch (err) {
    const status = err instanceof RehostError ? err.status : 502;
    return new Response("Upstream fetch failed", { status });
  }
  const headers = new Headers();
  headers.set("Content-Type", img.type.contentType);
  headers.set("Cache-Control", "public, max-age=604800, immutable");
  headers.set("Access-Control-Allow-Origin", "*");
  return new Response(img.bytes, { status: 200, headers });
}
__name(serveSignedProxy, "serveSignedProxy");
async function serveR2Garment(pathname, env) {
  if (!env.GARMENT_BUCKET) return new Response("Storage not configured", { status: 500 });
  const key = pathname.slice("/garment/".length);
  if (!/^[a-f0-9]{64}\.(jpg|png|webp)$/.test(key)) {
    return new Response("Not Found", { status: 404 });
  }
  const obj = await env.GARMENT_BUCKET.get(key);
  if (!obj) return new Response("Not Found", { status: 404 });
  const headers = new Headers();
  headers.set("Content-Type", obj.httpMetadata?.contentType || "image/jpeg");
  headers.set("Cache-Control", "public, max-age=604800, immutable");
  headers.set("Access-Control-Allow-Origin", "*");
  if (obj.httpEtag) headers.set("ETag", obj.httpEtag);
  return new Response(obj.body, { status: 200, headers });
}
__name(serveR2Garment, "serveR2Garment");
async function callTryOnCloudApi(apiKey, humanImageBase64, productImageUrl) {
  const formData = new FormData();
  const personBlob = base64ToBlob(humanImageBase64);
  formData.append("user_image", personBlob, "person.jpg");
  formData.append("product_image_url", productImageUrl);
  const response = await fetch("https://www.tryoncloud.com/api/tryon", {
    method: "POST",
    headers: { "x-api-key": apiKey },
    body: formData
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new TryOnCloudError(response.status, errText);
  }
  const data = await response.json();
  if (data && data.success === false) {
    throw new TryOnCloudError(502, data.error || data.message || "TryOnCloud \uCC98\uB9AC\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
  }
  const resultUrl = data.resultUrl || data.result || data.result_url || data.output_url || data.image_url;
  if (!resultUrl) {
    throw new TryOnCloudError(502, "TryOnCloud \uC751\uB2F5\uC5D0 \uACB0\uACFC URL\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
  }
  return { output_image_url: resultUrl };
}
__name(callTryOnCloudApi, "callTryOnCloudApi");
var TryOnCloudError = class extends Error {
  static {
    __name(this, "TryOnCloudError");
  }
  constructor(status, message) {
    super(message);
    this.name = "TryOnCloudError";
    this.status = status;
  }
};
var worker_default = {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const corsHeaders = buildCorsHeaders(origin, env);
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (url.pathname === "/try-on" && request.method === "POST") {
      return handleTryOn(request, env, corsHeaders);
    }
    if (url.pathname.startsWith("/g/") && request.method === "GET") {
      return serveSignedProxy(url.pathname, env, request);
    }
    if (url.pathname.startsWith("/garment/") && request.method === "GET") {
      return serveR2Garment(url.pathname, env);
    }
    if (url.pathname === "/health" && request.method === "GET") {
      return jsonResponse({ status: "ok" }, 200, corsHeaders);
    }
    return jsonResponse({ error: "Not Found" }, 404, corsHeaders);
  }
};
async function handleTryOn(request, env, corsHeaders) {
  if (!env.TRYONCLOUD_API_KEY) {
    return jsonResponse({ error: "Server configuration error" }, 500, corsHeaders);
  }
  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
  const rateCheck = await checkRateLimit(env.RATE_LIMIT_KV, clientIp);
  if (!rateCheck.allowed) {
    return jsonResponse(
      { error: "Too many requests", retryAfter: rateCheck.retryAfter },
      429,
      { ...corsHeaders, "Retry-After": String(rateCheck.retryAfter) }
    );
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, corsHeaders);
  }
  const validationError = validateBody(body);
  if (validationError) {
    return jsonResponse({ error: validationError }, 400, corsHeaders);
  }
  let productImageUrl;
  try {
    productImageUrl = await buildProductImageUrl(body, request, env);
  } catch (err) {
    if (err instanceof RehostError) {
      return jsonResponse({ error: err.userMessage }, err.status, corsHeaders);
    }
    console.error("[MyFit Worker] product url build error:", err);
    return jsonResponse({ error: "\uC758\uB958 \uC774\uBBF8\uC9C0 \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, 500, corsHeaders);
  }
  try {
    const result = await callTryOnCloudApi(
      env.TRYONCLOUD_API_KEY,
      body.human_image,
      productImageUrl
    );
    return jsonResponse({ output_image_url: result.output_image_url }, 200, corsHeaders);
  } catch (err) {
    if (err instanceof TryOnCloudError) {
      if (err.status === 402) {
        return jsonResponse(
          { error: "AI \uD53C\uD305 \uD06C\uB808\uB527\uC774 \uC18C\uC9C4\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.", code: "CREDITS_EXHAUSTED" },
          402,
          corsHeaders
        );
      }
      if (err.status === 429) {
        return jsonResponse(
          { error: "\uC6D4\uAC04 \uBB34\uB8CC \uD55C\uB3C4\uAC00 \uC18C\uC9C4\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694." },
          429,
          corsHeaders
        );
      }
      if (err.status === 403) {
        return jsonResponse(
          { error: "\uC758\uB958 \uC774\uBBF8\uC9C0 \uB3C4\uBA54\uC778\uC774 TryOnCloud\uC5D0 \uB4F1\uB85D\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." },
          403,
          corsHeaders
        );
      }
      return jsonResponse(
        { error: `AI \uD53C\uD305 \uC624\uB958: ${err.message}` },
        err.status >= 400 && err.status < 600 ? err.status : 502,
        corsHeaders
      );
    }
    console.error("[MyFit Worker] Unexpected error:", err);
    return jsonResponse({ error: "Internal server error" }, 500, corsHeaders);
  }
}
__name(handleTryOn, "handleTryOn");
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map