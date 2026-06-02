/**
 * MyFit Extension — Crypto Utilities (ES Module)
 * AES-256-GCM 암호화/복호화
 * CISO 요구사항: 측정 수치만 저장 시 Web Crypto API 필수
 */

/**
 * 신체 측정 수치 암호화
 * @param {Object} measurements
 * @returns {Promise<{iv: string, data: string, version: number}>}
 */
export async function encryptMeasurements(measurements) {
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(measurements));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  return {
    iv: arrayToBase64(iv),
    data: arrayToBase64(new Uint8Array(ciphertext)),
    version: 1
  };
}

/**
 * 복호화
 * @param {{iv: string, data: string}} encrypted
 * @returns {Promise<Object>}
 */
export async function decryptMeasurements(encrypted) {
  const key = await getOrCreateKey();
  const iv = base64ToArray(encrypted.iv);
  const data = base64ToArray(encrypted.data);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  return JSON.parse(new TextDecoder().decode(plaintext));
}

// ── 내부 유틸 ──

let _cachedKey = null;

async function getOrCreateKey() {
  if (_cachedKey) return _cachedKey;

  // IndexedDB에서 키 복구 시도 (extractable=false이므로 원문 저장 불가)
  // → 세션마다 새 키 생성 (service worker 수명과 동기화)
  _cachedKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable
    ['encrypt', 'decrypt']
  );
  return _cachedKey;
}

function arrayToBase64(arr) {
  return btoa(String.fromCharCode(...arr));
}

function base64ToArray(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}
