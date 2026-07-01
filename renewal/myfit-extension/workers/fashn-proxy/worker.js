/**
 * MyFit TryOnCloud Proxy — Cloudflare Worker
 *
 * 보안 원칙 (CISO/CLO 기준):
 *  - TRYONCLOUD_API_KEY: 환경변수 전용 (env.TRYONCLOUD_API_KEY). 코드 하드코딩 금지.
 *  - 사용자 사진(base64): TryOnCloud 전달 후 Worker 보관 안 함 (stateless 휘발).
 *  - 의류 도메인 우회(옵션 B): 어떤 쇼핑몰 URL이든 Worker가 HMAC 서명+만료 토큰으로
 *    감싸 Worker 자기 도메인 /g/<token> 으로 노출 → TryOnCloud가 fetch 시 Worker가
 *    원본을 즉석 스트리밍(stateless, 저장소 불필요). 회장은 Worker 도메인 1개만 등록.
 *    의류 직접촬영(base64)은 원본 URL 없어 R2(env.GARMENT_BUCKET) 필요 → 미연결 시 안내.
 *  - SSRF 방어(독립리뷰 B1/B2/B3 반영):
 *      · https + 공인 호스트만, IP리터럴/호스트내IP/IPv6/rebinding TLD/내부TLD/자기호스트 차단
 *      · redirect:'manual' 로 받아 매 홉 Location 재검증(리다이렉트 우회 차단)
 *      · 응답은 이미지 magic-byte 통과분만 반환(내부 텍스트/JSON 유출 방벽)
 *  - /g/ 오픈프록시 차단: HMAC 서명 + exp(1h) 토큰만 서빙. 자기참조 금지.
 *  - CORS: chrome-extension:// + Capacitor + GitHub Pages origin만 허용.
 */

'use strict';

// ── 한도/정책 상수 ──
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB (TryOnCloud 한도)
const MAX_GARMENT_URL_LEN = 1024;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 3;
const SIGN_PREFIX = 'myfit-garment-proxy:v1:'; // 서명 용도분리 (API키 인증과 분리)
const TOKEN_TTL_SEC = 3600;                    // 서명 URL 만료 1시간

// ── Rate Limiter (IP당 3회/분, KV 기반) ──
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_SEC = 60;

async function checkRateLimit(kv, ip) {
  if (!kv) {
    console.warn('[MyFit Worker] RATE_LIMIT_KV not bound — rate limiting disabled');
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  const key = `rl:${ip}`;
  const now = Math.floor(Date.now() / 1000);
  let entry;
  try {
    entry = await kv.get(key, { type: 'json' });
  } catch {
    return { allowed: true, remaining: 1 };
  }
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_SEC) {
    await kv.put(key, JSON.stringify({ count: 1, windowStart: now }), {
      expirationTtl: RATE_LIMIT_WINDOW_SEC * 2,
    });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfter = RATE_LIMIT_WINDOW_SEC - (now - entry.windowStart);
    return { allowed: false, retryAfter: Math.max(1, retryAfter) };
  }
  await kv.put(key, JSON.stringify({ count: entry.count + 1, windowStart: entry.windowStart }), {
    expirationTtl: RATE_LIMIT_WINDOW_SEC * 2,
  });
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count - 1 };
}

// ── CORS 헤더 빌더 ──
function buildCorsHeaders(origin, env) {
  let allowedOrigin = null;
  if (origin && origin.startsWith('chrome-extension://')) {
    allowedOrigin = origin;
  } else if (origin && origin.startsWith('capacitor://')) {
    allowedOrigin = origin;
  } else if (origin && origin === 'https://localhost') {
    allowedOrigin = origin;
  } else if (origin && origin === 'https://kgg2512.github.io') {
    allowedOrigin = origin;
  } else if (env && env.ENVIRONMENT === 'development' && origin === 'null') {
    allowedOrigin = 'null';
  }
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
  }
  return headers;
}

// ── 공통 JSON 응답 ──
function jsonResponse(body, status, corsHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

// ── 바이트 → 이미지 타입 판별 (Magic Bytes) ──
function detectImageType(bytes) {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) {
    return { ext: 'jpg', contentType: 'image/jpeg' };
  }
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) {
    return { ext: 'png', contentType: 'image/png' };
  }
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    return { ext: 'webp', contentType: 'image/webp' };
  }
  return null;
}

// ── base64 → Uint8Array ──
function base64ToBytes(base64) {
  const stripped = base64.includes(',') ? base64.split(',')[1] : base64;
  const binaryStr = atob(stripped);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

// ── base64 → Blob (사람 사진 → TryOnCloud 파일 업로드) ──
function base64ToBlob(base64, mimeType = 'image/jpeg') {
  return new Blob([base64ToBytes(base64)], { type: mimeType });
}

// ── base64 이미지 Magic Bytes 검증 ──
function validateImageMagicBytes(base64) {
  let bytes;
  try {
    const stripped = base64.includes(',') ? base64.split(',')[1] : base64;
    const decoded = atob(stripped.slice(0, 24));
    bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  } catch {
    return 'base64 디코딩 실패 — 유효한 이미지가 아닙니다.';
  }
  if (!detectImageType(bytes)) {
    return '지원하지 않는 이미지 형식입니다. JPEG, PNG, WebP만 허용됩니다.';
  }
  return null;
}

// ── URL-safe base64 ──
function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  let t = s.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  const bin = atob(t);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// ── HMAC-SHA256 hex ──
async function hmacHex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── 상수시간 비교 ──
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ── SHA-256 hex (R2 콘텐츠 키) ──
async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── SSRF 방어: 공인 https 호스트만 허용 (selfHost 자기참조 차단 포함) ──
function isSafeGarmentUrl(urlStr, selfHost) {
  let u;
  try {
    u = new URL(urlStr);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  if (host.length === 0) return false;
  if (selfHost && host === selfHost.toLowerCase()) return false;       // B3: 자기참조 차단
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;              // IPv4 리터럴(WHATWG가 dec/hex/octal 정규화)
  if (/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(host)) return false;   // B2: 호스트명에 IPv4 박힘(rebinding)
  if (host.includes(':') || urlStr.includes('[')) return false;        // IPv6 리터럴
  if (/\.(nip\.io|sslip\.io|xip\.io|traefik\.me)$/.test(host)) return false; // B2: wildcard-DNS rebinding 서비스
  if (host === 'localhost' || host.endsWith('.localhost')) return false;
  if (host.endsWith('.internal') || host.endsWith('.local')) return false;
  if (host === 'metadata.google.internal') return false;
  return true;
}

// ── 원본 의류 이미지 fetch (수동 리다이렉트 + 매 홉 SSRF 재검증) ──
async function fetchImageBytes(startUrl, selfHost) {
  let currentUrl = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isSafeGarmentUrl(currentUrl, selfHost)) {
      throw new RehostError(400, '허용되지 않는 의류 이미지 URL입니다 (내부/비공개 주소 차단).');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let resp;
    try {
      resp = await fetch(currentUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MyFitBot/1.0; +https://kgg2512.github.io/MyFit/)',
          'Accept': 'image/avif,image/webp,image/png,image/jpeg,*/*',
        },
        redirect: 'manual', // B1: 자동 추적 금지 — 수동 재검증
        signal: controller.signal,
      });
    } catch {
      throw new RehostError(502, '의류 이미지를 가져오지 못했습니다. URL을 확인해 주세요.');
    } finally {
      clearTimeout(timer);
    }

    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get('Location');
      if (!loc) throw new RehostError(502, '의류 이미지 리다이렉트가 올바르지 않습니다.');
      try {
        currentUrl = new URL(loc, currentUrl).toString(); // 다음 루프에서 isSafeGarmentUrl 재검증
      } catch {
        throw new RehostError(502, '의류 이미지 리다이렉트 주소가 올바르지 않습니다.');
      }
      continue;
    }

    if (!resp.ok) {
      throw new RehostError(502, `의류 이미지를 가져오지 못했습니다 (${resp.status}).`);
    }
    const buf = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    if (bytes.length === 0) throw new RehostError(400, '의류 이미지가 비어 있습니다.');
    if (bytes.length > MAX_IMAGE_BYTES) throw new RehostError(413, '의류 이미지가 10MB를 초과합니다.');
    const type = detectImageType(bytes);
    if (!type) throw new RehostError(415, '의류 이미지 형식이 올바르지 않습니다 (JPEG/PNG/WebP만 가능).');
    return { bytes, type };
  }
  throw new RehostError(502, '의류 이미지 리다이렉트가 너무 많습니다.');
}

// ── 입력 유효성 검사 ──
function validateBody(body) {
  const { human_image, garment_image_url, garment_image_base64 } = body;
  if (typeof human_image !== 'string' || human_image.length === 0) {
    return 'human_image is required (base64 string)';
  }
  const hasUrl = typeof garment_image_url === 'string' && garment_image_url.length > 0;
  const hasB64 = typeof garment_image_base64 === 'string' && garment_image_base64.length > 0;
  if (!hasUrl && !hasB64) {
    return 'garment_image_url or garment_image_base64 is required';
  }
  if (hasUrl) {
    if (garment_image_url.startsWith('data:')) {
      return 'garment_image_url must be a valid https:// URL';
    }
    if (!garment_image_url.startsWith('https://')) {
      return 'garment_image_url must use https://';
    }
    if (garment_image_url.length > MAX_GARMENT_URL_LEN) {
      return '의류 이미지 URL이 너무 깁니다.';
    }
  }
  const humanBytes = Math.ceil((human_image.length * 3) / 4);
  if (humanBytes > MAX_IMAGE_BYTES) {
    return 'human_image exceeds 10MB limit';
  }
  const humanMimeError = validateImageMagicBytes(human_image);
  if (humanMimeError) return humanMimeError;
  if (hasB64) {
    const garmentBytes = Math.ceil((garment_image_base64.length * 3) / 4);
    if (garmentBytes > MAX_IMAGE_BYTES) {
      return 'garment_image_base64 exceeds 10MB limit';
    }
    const garmentMimeError = validateImageMagicBytes(garment_image_base64);
    if (garmentMimeError) return '의류 이미지: ' + garmentMimeError;
  }
  return null;
}

// ── 재호스팅 에러 ──
class RehostError extends Error {
  constructor(status, userMessage) {
    super(userMessage);
    this.name = 'RehostError';
    this.status = status;
    this.userMessage = userMessage;
  }
}

/**
 * 의류 이미지를 TryOnCloud가 수락할 "등록 도메인 URL"로 변환.
 *  - URL 입력  → HMAC 서명+만료 토큰 프록시 URL (/g/<b64>.<exp>.<sig>), 저장 없음.
 *  - base64 입력 → R2 재호스팅 (/garment/<hash>), R2 미연결 시 안내(501).
 */
async function buildProductImageUrl(body, request, env) {
  const reqUrl = new URL(request.url);
  const origin = reqUrl.origin;
  const selfHost = reqUrl.host;

  if (typeof body.garment_image_url === 'string' && body.garment_image_url.length > 0) {
    const url = body.garment_image_url;
    if (!isSafeGarmentUrl(url, selfHost)) {
      throw new RehostError(400, '허용되지 않는 의류 이미지 URL입니다 (https 공개 주소만, 내부/자기주소 불가).');
    }
    const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC;
    const sig = await hmacHex(env.TRYONCLOUD_API_KEY, `${SIGN_PREFIX}${exp}:${url}`);
    return `${origin}/g/${b64urlEncode(url)}.${exp}.${sig}`;
  }

  // base64 (의류 직접 촬영) → R2 필요
  if (!env.GARMENT_BUCKET) {
    throw new RehostError(
      501,
      '의류 사진 직접 업로드는 현재 준비 중입니다. 쇼핑몰 상품 이미지 URL로 시도해 주세요.'
    );
  }
  const bytes = base64ToBytes(body.garment_image_base64);
  if (bytes.length > MAX_IMAGE_BYTES) throw new RehostError(413, '의류 이미지가 10MB를 초과합니다.');
  const type = detectImageType(bytes);
  if (!type) throw new RehostError(415, '의류 이미지 형식이 올바르지 않습니다 (JPEG/PNG/WebP만 가능).');
  const hash = await sha256Hex(bytes);
  const objectKey = `${hash}.${type.ext}`;
  await env.GARMENT_BUCKET.put(objectKey, bytes, {
    httpMetadata: { contentType: type.contentType, cacheControl: 'public, max-age=604800' },
  });
  return `${origin}/garment/${objectKey}`;
}

// ── /g/<b64>.<exp>.<sig> : stateless 서명 프록시 (TryOnCloud가 fetch) ──
async function serveSignedProxy(pathname, env, request) {
  if (!env.TRYONCLOUD_API_KEY) return new Response('Not configured', { status: 500 });
  const token = pathname.slice('/g/'.length);
  const parts = token.split('.');
  if (parts.length !== 3) return new Response('Bad token', { status: 400 });
  const [b64, expStr, sig] = parts;
  if (!/^\d+$/.test(expStr)) return new Response('Bad token', { status: 400 });
  const exp = parseInt(expStr, 10);
  if (Math.floor(Date.now() / 1000) > exp) return new Response('Expired', { status: 410 });

  let url;
  try {
    url = b64urlDecode(b64);
  } catch {
    return new Response('Bad token', { status: 400 });
  }
  const expected = await hmacHex(env.TRYONCLOUD_API_KEY, `${SIGN_PREFIX}${exp}:${url}`);
  if (!timingSafeEqual(sig, expected)) {
    return new Response('Forbidden', { status: 403 });
  }
  const selfHost = new URL(request.url).host;
  if (!isSafeGarmentUrl(url, selfHost)) {
    return new Response('Forbidden', { status: 403 });
  }
  let img;
  try {
    img = await fetchImageBytes(url, selfHost);
  } catch (err) {
    const status = err instanceof RehostError ? err.status : 502;
    return new Response('Upstream fetch failed', { status });
  }
  const headers = new Headers();
  headers.set('Content-Type', img.type.contentType);
  headers.set('Cache-Control', 'public, max-age=604800, immutable');
  headers.set('Access-Control-Allow-Origin', '*');
  return new Response(img.bytes, { status: 200, headers });
}

// ── /garment/<hash> : R2 재호스팅 의류 서빙 (base64 경로) ──
async function serveR2Garment(pathname, env) {
  if (!env.GARMENT_BUCKET) return new Response('Storage not configured', { status: 500 });
  const key = pathname.slice('/garment/'.length);
  if (!/^[a-f0-9]{64}\.(jpg|png|webp)$/.test(key)) {
    return new Response('Not Found', { status: 404 });
  }
  const obj = await env.GARMENT_BUCKET.get(key);
  if (!obj) return new Response('Not Found', { status: 404 });
  const headers = new Headers();
  headers.set('Content-Type', obj.httpMetadata?.contentType || 'image/jpeg');
  headers.set('Cache-Control', 'public, max-age=604800, immutable');
  headers.set('Access-Control-Allow-Origin', '*');
  if (obj.httpEtag) headers.set('ETag', obj.httpEtag);
  return new Response(obj.body, { status: 200, headers });
}

// ── TryOnCloud API 호출 ──
async function callTryOnCloudApi(apiKey, humanImageBase64, productImageUrl) {
  const formData = new FormData();
  const personBlob = base64ToBlob(humanImageBase64);
  // TryOnCloud 현행 API 필드명: user_image(파일) / product_image_url(URL).
  // 구 person/product → 정정 (라이브 API 'MISSING_USER_IMAGE'·'MISSING_PRODUCT_URL' 실측, 2026-06-21)
  formData.append('user_image', personBlob, 'person.jpg');
  formData.append('product_image_url', productImageUrl);

  const response = await fetch('https://www.tryoncloud.com/api/tryon', {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new TryOnCloudError(response.status, errText);
  }

  const data = await response.json();
  // TryOnCloud 성공 응답: {success:true, resultUrl:"https://www.tryoncloud.com/api/result/<uuid>"} (실측 2026-06-22)
  if (data && data.success === false) {
    throw new TryOnCloudError(502, data.error || data.message || 'TryOnCloud 처리에 실패했습니다.');
  }
  const resultUrl = data.resultUrl || data.result || data.result_url || data.output_url || data.image_url;
  if (!resultUrl) {
    throw new TryOnCloudError(502, 'TryOnCloud 응답에 결과 URL이 없습니다.');
  }
  return { output_image_url: resultUrl };
}

// ── 커스텀 에러 클래스 ──
class TryOnCloudError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'TryOnCloudError';
    this.status = status;
  }
}

// ── 메인 핸들러 ──
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = buildCorsHeaders(origin, env);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (url.pathname === '/try-on' && request.method === 'POST') {
      return handleTryOn(request, env, corsHeaders);
    }
    if (url.pathname.startsWith('/g/') && request.method === 'GET') {
      return serveSignedProxy(url.pathname, env, request);
    }
    if (url.pathname.startsWith('/garment/') && request.method === 'GET') {
      return serveR2Garment(url.pathname, env);
    }
    if (url.pathname === '/health' && request.method === 'GET') {
      return jsonResponse({ status: 'ok' }, 200, corsHeaders);
    }
    return jsonResponse({ error: 'Not Found' }, 404, corsHeaders);
  },
};

// ── /try-on 핸들러 ──
async function handleTryOn(request, env, corsHeaders) {
  if (!env.TRYONCLOUD_API_KEY) {
    return jsonResponse({ error: 'Server configuration error' }, 500, corsHeaders);
  }

  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateCheck = await checkRateLimit(env.RATE_LIMIT_KV, clientIp);
  if (!rateCheck.allowed) {
    return jsonResponse(
      { error: 'Too many requests', retryAfter: rateCheck.retryAfter },
      429,
      { ...corsHeaders, 'Retry-After': String(rateCheck.retryAfter) }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400, corsHeaders);
  }

  const validationError = validateBody(body);
  if (validationError) {
    return jsonResponse({ error: validationError }, 400, corsHeaders);
  }

  // 의류 이미지를 TryOnCloud 수락 가능한 등록 도메인 URL로 변환
  let productImageUrl;
  try {
    productImageUrl = await buildProductImageUrl(body, request, env);
  } catch (err) {
    if (err instanceof RehostError) {
      return jsonResponse({ error: err.userMessage }, err.status, corsHeaders);
    }
    console.error('[MyFit Worker] product url build error:', err);
    return jsonResponse({ error: '의류 이미지 처리 중 오류가 발생했습니다.' }, 500, corsHeaders);
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
          { error: 'AI 피팅 크레딧이 소진되었습니다. 잠시 후 다시 시도해 주세요.', code: 'CREDITS_EXHAUSTED' },
          402,
          corsHeaders
        );
      }
      if (err.status === 429) {
        return jsonResponse(
          { error: '월간 무료 한도가 소진되었습니다. 잠시 후 다시 시도해 주세요.' },
          429,
          corsHeaders
        );
      }
      if (err.status === 403) {
        return jsonResponse(
          { error: '의류 이미지 도메인이 TryOnCloud에 등록되지 않았습니다.' },
          403,
          corsHeaders
        );
      }
      return jsonResponse(
        { error: `AI 피팅 오류: ${err.message}` },
        err.status >= 400 && err.status < 600 ? err.status : 502,
        corsHeaders
      );
    }
    console.error('[MyFit Worker] Unexpected error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500, corsHeaders);
  }
}
