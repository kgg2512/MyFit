/**
 * 인증 추상화 인터페이스 (설계 §B — 교체 가능 레이어).
 * 앱 코드는 이 인터페이스만 참조한다. 백엔드(Firebase→Supabase 등) 교체 시
 * 이 인터페이스의 새 구현체만 작성하면 되고, 페이지 코드는 불변이다.
 */

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface AuthProvider {
  /** 이 빌드에서 로그인 기능이 사용 가능한지(firebase 비활성 빌드 = false). */
  readonly available: boolean;

  /** 구글 로그인. 성공 시 AuthUser 반환. 사용자 취소/실패 시 throw(code 포함). */
  signInWithGoogle(): Promise<AuthUser>;

  /** 로그아웃. */
  signOut(): Promise<void>;

  /**
   * 인증 상태 변경 구독. 즉시 현재 상태로 1회 콜백된다.
   * @returns 구독 해제 함수
   */
  onAuthChange(cb: (user: AuthUser | null) => void): () => void;

  /** 현재 로그인 사용자(동기 조회). 없으면 null. */
  currentUser(): AuthUser | null;

  /**
   * 계정 완전 삭제(PIPA 삭제권). 최근 로그인 필요 시 throw(auth/requires-recent-login)
   * → 호출부에서 폴백(로그아웃) 처리.
   */
  deleteAccount(): Promise<void>;
}
