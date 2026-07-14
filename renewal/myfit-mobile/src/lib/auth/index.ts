/**
 * 인증 싱글톤 — 구현체 선택은 오직 이 파일에서만 한다.
 * 백엔드 교체 시 여기 한 줄(new FirebaseAuthProvider → new SupabaseAuthProvider)만 바꾼다.
 */

import { FirebaseAuthProvider } from './FirebaseAuthProvider';
import type { AuthProvider } from './AuthProvider';

export type { AuthProvider, AuthUser } from './AuthProvider';

export const authProvider: AuthProvider = new FirebaseAuthProvider();
