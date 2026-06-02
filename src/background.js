/**
 * MyFit Chrome Extension — Background Service Worker
 * Manifest V3 / ES Module
 *
 * 책임:
 *  - content script → side panel 메시지 릴레이
 *  - chrome.action 클릭 → side panel 토글
 *  - storage 암호화 키 초기화 (AES-256-GCM)
 */

// ──────────────────────────────────────────────
// Side Panel 설정 (Chrome 114+)
// ──────────────────────────────────────────────
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// ──────────────────────────────────────────────
// 암호화 키 초기화 (최초 설치 시)
// ──────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get('__mf_enc_key_ref');
  if (!existing.__mf_enc_key_ref) {
    // AES-256-GCM 키 생성 후 extractable=false 로 저장
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,   // extractable: false — 키 원문 외부 노출 불가
      ['encrypt', 'decrypt']
    );
    // 키 자체는 메모리에만, storage에는 "초기화 완료" 플래그만
    _sessionKey = key;
    await chrome.storage.local.set({ __mf_enc_key_ref: true });
    console.log('[MyFit] Encryption key initialized.');
  }
});

// 세션 키 (service worker 생존 동안 메모리 유지)
let _sessionKey = null;

async function getSessionKey() {
  if (_sessionKey) return _sessionKey;
  // Service worker 재시작 후 키 재생성 (storage 데이터도 재암호화 필요)
  _sessionKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  return _sessionKey;
}

// ──────────────────────────────────────────────
// 메시지 허브 (content ↔ sidepanel)
// ──────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {

    // content script가 상품 정보 감지 → side panel에 전달
    case 'PRODUCT_DETECTED': {
      // 주의: 상품 데이터는 G2 서버로 전송 금지 (CLO 제약)
      // side panel로만 전달 (로컬 내부 메시지)
      chrome.runtime.sendMessage({
        type: 'PRODUCT_DATA',
        payload: message.payload
      }).catch(() => {
        // side panel 미열림 상태면 무시
      });
      sendResponse({ ok: true });
      break;
    }

    // side panel이 암호화 저장 요청
    case 'STORE_MEASUREMENTS': {
      (async () => {
        try {
          const key = await getSessionKey();
          const encrypted = await encryptMeasurements(key, message.payload);
          await chrome.storage.local.set({ mf_measurements: encrypted });
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: e.message });
        }
      })();
      return true; // async response
    }

    // side panel이 측정값 로드 요청
    case 'LOAD_MEASUREMENTS': {
      (async () => {
        try {
          const key = await getSessionKey();
          const stored = await chrome.storage.local.get('mf_measurements');
          if (!stored.mf_measurements) {
            sendResponse({ ok: true, data: null });
            return;
          }
          const data = await decryptMeasurements(key, stored.mf_measurements);
          sendResponse({ ok: true, data });
        } catch (e) {
          sendResponse({ ok: false, error: e.message });
        }
      })();
      return true;
    }

    default:
      sendResponse({ ok: false, error: 'Unknown message type' });
  }
});

// ──────────────────────────────────────────────
// AES-256-GCM 암호화/복호화 유틸
// ──────────────────────────────────────────────

/**
 * 측정 수치 객체를 AES-256-GCM으로 암호화
 * @param {CryptoKey} key
 * @param {Object} measurements - { height, weight, shoulder, chest, waist, ... }
 * @returns {{ iv: string, data: string }} base64 인코딩된 iv + ciphertext
 */
async function encryptMeasurements(key, measurements) {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
  const encoded = new TextEncoder().encode(JSON.stringify(measurements));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  return {
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(ciphertext)))
  };
}

/**
 * AES-256-GCM 복호화
 */
async function decryptMeasurements(key, encrypted) {
  const iv = Uint8Array.from(atob(encrypted.iv), c => c.charCodeAt(0));
  const data = Uint8Array.from(atob(encrypted.data), c => c.charCodeAt(0));
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}
