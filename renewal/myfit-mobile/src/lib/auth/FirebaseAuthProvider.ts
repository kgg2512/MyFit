/**
 * AuthProvider의 Firebase 구현 (현재 백엔드). 이 파일 + firebase.ts만이
 * firebase/auth 를 직접 import 한다(어댑터 격리).
 */

'use client';

import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
  onAuthStateChanged,
  deleteUser,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth, FIREBASE_ENABLED } from '../firebase';
import type { AuthProvider, AuthUser } from './AuthProvider';

function toAuthUser(u: User | null): AuthUser | null {
  if (!u) return null;
  return { uid: u.uid, email: u.email, displayName: u.displayName };
}

export class FirebaseAuthProvider implements AuthProvider {
  readonly available = FIREBASE_ENABLED;

  async signInWithGoogle(): Promise<AuthUser> {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('로그인 기능이 이 빌드에서 비활성화되어 있습니다.');

    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = toAuthUser(result.user);
      if (!user) throw new Error('로그인 정보를 가져오지 못했습니다.');
      return user;
    } catch (e) {
      const code = (e as { code?: string }).code;
      // 팝업 차단·미지원 환경 → 리다이렉트 폴백 (정적 사이트라 서버 불필요).
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-environment') {
        await signInWithRedirect(auth, provider);
        // 브라우저가 구글로 이동한다. 이 Promise는 resolve되지 않으며(페이지 언로드),
        // 복귀 시 onAuthChange가 로그인 상태를 통지한다.
        return new Promise<AuthUser>(() => { /* 페이지 리다이렉트로 영구 pending */ });
      }
      throw e;
    }
  }

  async signOut(): Promise<void> {
    const auth = getFirebaseAuth();
    if (auth) await fbSignOut(auth);
  }

  onAuthChange(cb: (user: AuthUser | null) => void): () => void {
    const auth = getFirebaseAuth();
    if (!auth) {
      cb(null);
      return () => {};
    }
    // 리다이렉트 복귀 처리(에러는 무시 — 실제 상태는 onAuthStateChanged가 통지).
    getRedirectResult(auth).catch(() => {});
    return onAuthStateChanged(auth, u => cb(toAuthUser(u)));
  }

  currentUser(): AuthUser | null {
    const auth = getFirebaseAuth();
    return auth ? toAuthUser(auth.currentUser) : null;
  }

  async deleteAccount(): Promise<void> {
    const auth = getFirebaseAuth();
    const u = auth?.currentUser;
    if (!u) return;
    // 최근 로그인 필요 시 auth/requires-recent-login throw → 호출부에서 폴백.
    await deleteUser(u);
  }
}
