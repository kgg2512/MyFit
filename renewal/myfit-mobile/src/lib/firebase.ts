/**
 * Firebase 초기화 단일 소스 (P10-1).
 *
 * - config = 공개 클라이언트 키. 노출 자체는 안전하다(보안은 Firestore Security Rules가 담당).
 *   값 교체는 이 파일 한 곳만 고치면 된다.
 * - analytics(measurementId)는 의도적으로 초기화하지 않는다(설계 §E/§9 — 최소수집·프라이버시).
 * - 로그인/클라우드 기능 게이트 = NEXT_PUBLIC_FIREBASE_ENABLED (DEMO_MODE와 **독립**).
 *   build-all.ps1이 주입한다. 이 플래그가 'true'가 아닌 빌드(예: 현 안드로이드 빌드)는
 *   firebase를 초기화하지 않으며, dead-code 제거로 auth UI가 사라진다.
 *   → 데모/스토어(DEMO_MODE)와 로그인 기능의 관심사를 완전히 분리한다.
 * - SSR-safe: 모든 초기화는 typeof window 가드 뒤에서만 일어난다(정적 export 프리렌더 안전).
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

// 회장 Firebase 콘솔 웹앱 config (2026-07-14 전달). 공개 클라이언트 키.
const firebaseConfig = {
  apiKey: 'AIzaSyAVpaG2iTNUAf61V5GbTxL8EpV4dOhkPiQ',
  authDomain: 'myfit-9d169.firebaseapp.com',
  projectId: 'myfit-9d169',
  storageBucket: 'myfit-9d169.firebasestorage.app',
  messagingSenderId: '1020355041851',
  appId: '1:1020355041851:web:18718d10bee150867f5a1e',
  // measurementId 의도적 제외 → getAnalytics 미호출 (프라이버시)
};

/** 로그인·클라우드 동기화 활성 빌드인지 (빌드타임 리터럴). DEMO_MODE와 무관. */
export const FIREBASE_ENABLED = process.env.NEXT_PUBLIC_FIREBASE_ENABLED === 'true';

let _app: FirebaseApp | null = null;

/** Firebase 앱 싱글톤. 비활성 빌드/SSR에서는 null. */
export function getFirebaseApp(): FirebaseApp | null {
  // 모듈-로컬 리터럴 참조 → 비활성 빌드에서 초기화 경로가 dead-code로 제거됨.
  if (process.env.NEXT_PUBLIC_FIREBASE_ENABLED !== 'true') return null;
  if (typeof window === 'undefined') return null;
  if (_app) return _app;
  _app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return _app;
}

/** Firebase Auth 인스턴스. 웹 기본 지속성 = IndexedDB(별도 setPersistence 불필요). */
export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp();
  return app ? getAuth(app) : null;
}

/** Cloud Firestore 인스턴스. */
export function getFirebaseDb(): Firestore | null {
  const app = getFirebaseApp();
  return app ? getFirestore(app) : null;
}
