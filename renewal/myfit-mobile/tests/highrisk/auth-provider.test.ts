/**
 * 고위험 경로 — 인증 축: `FirebaseAuthProvider` (로그인·로그아웃·계정삭제).
 *
 * 왜 이 파일인가: 이 클래스가 MyFit 의 **유일한** 인증 경계다. 여기서
 *   ① 비활성 빌드(FIREBASE_ENABLED != 'true')에 로그인 UI/호출이 새면 → 스토어 심사·프라이버시 리스크
 *   ② `toAuthUser` 가 필요 이상의 사용자 필드를 흘리면 → 개인정보 최소수집 위반
 *   ③ 팝업 폴백 조건이 넓어지면 → 사용자가 의도치 않게 외부 리다이렉트로 튕김
 *   ④ `deleteAccount` 가 조용히 no-op 이 되면 → PIPA 삭제권 미이행
 * 이 넷을 잡는 장치가 지금까지 0개였다.
 *
 * 범위: G2 `eval/highrisk_paths.json` 에 동결된 `myfit-mobile/src/lib/auth/FirebaseAuthProvider.ts`.
 * 전면 커버리지 아님. 실제 Firebase 에는 접속하지 않는다(전 모듈 모킹).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const fb = vi.hoisted(() => ({
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  getRedirectResult: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
  deleteUser: vi.fn(),
}));

const env = vi.hoisted(() => ({
  auth: null as unknown,
  enabled: false,
}));

vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class GoogleAuthProvider {},
  signInWithPopup: fb.signInWithPopup,
  signInWithRedirect: fb.signInWithRedirect,
  getRedirectResult: fb.getRedirectResult,
  signOut: fb.signOut,
  onAuthStateChanged: fb.onAuthStateChanged,
  deleteUser: fb.deleteUser,
}));

// 소스는 `../firebase` 로 import 하지만 alias 로 같은 모듈 id 에 해석된다.
vi.mock("@/lib/firebase", () => ({
  getFirebaseAuth: () => env.auth,
  get FIREBASE_ENABLED() {
    return env.enabled;
  },
}));

import { FirebaseAuthProvider } from "@/lib/auth/FirebaseAuthProvider";

/** firebase User 흉내 — 인증 백엔드는 이보다 훨씬 많은 필드를 준다. */
function fakeUser(extra: Record<string, unknown> = {}) {
  return {
    uid: "u-1",
    email: "a@example.test",
    displayName: "Alex",
    phoneNumber: "+821000000000",
    photoURL: "https://example.test/p.png",
    providerData: [{ providerId: "google.com" }],
    ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  env.auth = null;
  env.enabled = false;
  fb.getRedirectResult.mockResolvedValue(null);
});

describe("비활성 빌드 — 로그인 기능이 새지 않는다", () => {
  it("available=false 이고 signInWithGoogle 은 거부된다", async () => {
    const p = new FirebaseAuthProvider();
    expect(p.available).toBe(false);
    await expect(p.signInWithGoogle()).rejects.toThrow(/비활성화/);
    expect(fb.signInWithPopup).not.toHaveBeenCalled();
    expect(fb.signInWithRedirect).not.toHaveBeenCalled();
  });

  it("onAuthChange 는 즉시 null 로 1회 통지하고 해제 함수를 준다", () => {
    const cb = vi.fn();
    const unsub = new FirebaseAuthProvider().onAuthChange(cb);
    expect(cb).toHaveBeenCalledExactlyOnceWith(null);
    expect(fb.onAuthStateChanged).not.toHaveBeenCalled();
    expect(() => unsub()).not.toThrow();
  });

  it("currentUser 는 null, signOut·deleteAccount 는 백엔드를 건드리지 않는다", async () => {
    const p = new FirebaseAuthProvider();
    expect(p.currentUser()).toBeNull();
    await p.signOut();
    await p.deleteAccount();
    expect(fb.signOut).not.toHaveBeenCalled();
    expect(fb.deleteUser).not.toHaveBeenCalled();
  });
});

describe("활성 빌드 — 개인정보 최소 전달", () => {
  beforeEach(() => {
    env.enabled = true;
    env.auth = { currentUser: null };
  });

  it("로그인 성공 시 uid·email·displayName 세 필드만 넘긴다", async () => {
    fb.signInWithPopup.mockResolvedValue({ user: fakeUser() });
    const user = await new FirebaseAuthProvider().signInWithGoogle();

    expect(user).toEqual({ uid: "u-1", email: "a@example.test", displayName: "Alex" });
    // 필드가 늘어나면 최소수집 원칙이 조용히 깨진 것 → 즉시 빨간불.
    expect(Object.keys(user).sort()).toEqual(["displayName", "email", "uid"]);
  });

  it("currentUser 도 같은 세 필드로 축소된다", () => {
    env.auth = { currentUser: fakeUser({ uid: "u-2" }) };
    expect(new FirebaseAuthProvider().currentUser()).toEqual({
      uid: "u-2",
      email: "a@example.test",
      displayName: "Alex",
    });
  });

  it("로그인 결과에 user 가 없으면 실패로 처리한다", async () => {
    fb.signInWithPopup.mockResolvedValue({ user: null });
    await expect(new FirebaseAuthProvider().signInWithGoogle()).rejects.toThrow(
      /가져오지 못했습니다/,
    );
  });
});

describe("활성 빌드 — 리다이렉트 폴백은 좁게 유지된다", () => {
  beforeEach(() => {
    env.enabled = true;
    env.auth = { currentUser: null };
  });

  it("popup-blocked / operation-not-supported 에서만 리다이렉트한다", async () => {
    for (const code of ["auth/popup-blocked", "auth/operation-not-supported-in-environment"]) {
      vi.clearAllMocks();
      fb.signInWithPopup.mockRejectedValue(Object.assign(new Error(code), { code }));
      // 폴백 경로는 페이지 언로드를 가정해 영구 pending 이다 — resolve 를 기다리지 않는다.
      new FirebaseAuthProvider().signInWithGoogle();
      await vi.waitFor(() => expect(fb.signInWithRedirect).toHaveBeenCalledTimes(1));
    }
  });

  it("사용자 취소·기타 오류는 그대로 던진다 (폴백으로 삼키지 않는다)", async () => {
    for (const code of ["auth/popup-closed-by-user", "auth/network-request-failed"]) {
      vi.clearAllMocks();
      fb.signInWithPopup.mockRejectedValue(Object.assign(new Error(code), { code }));
      await expect(new FirebaseAuthProvider().signInWithGoogle()).rejects.toThrow(code);
      expect(fb.signInWithRedirect, `${code} 에서 리다이렉트하면 안 된다`).not.toHaveBeenCalled();
    }
  });
});

describe("활성 빌드 — 계정 삭제(PIPA 삭제권)", () => {
  beforeEach(() => {
    env.enabled = true;
  });

  it("로그인 상태면 실제 삭제를 호출한다", async () => {
    const u = fakeUser();
    env.auth = { currentUser: u };
    await new FirebaseAuthProvider().deleteAccount();
    expect(fb.deleteUser).toHaveBeenCalledExactlyOnceWith(u);
  });

  it("재인증 필요 오류는 호출부가 폴백하도록 전파된다", async () => {
    env.auth = { currentUser: fakeUser() };
    const err = Object.assign(new Error("requires-recent-login"), {
      code: "auth/requires-recent-login",
    });
    fb.deleteUser.mockRejectedValue(err);
    await expect(new FirebaseAuthProvider().deleteAccount()).rejects.toThrow(
      /requires-recent-login/,
    );
  });

  it("비로그인 상태면 아무것도 삭제하지 않는다", async () => {
    env.auth = { currentUser: null };
    await new FirebaseAuthProvider().deleteAccount();
    expect(fb.deleteUser).not.toHaveBeenCalled();
  });
});

describe("활성 빌드 — 상태 구독", () => {
  it("onAuthStateChanged 를 구독하고 축소된 사용자로 통지한다", () => {
    env.enabled = true;
    env.auth = { currentUser: null };
    const unsubscribe = vi.fn();
    fb.onAuthStateChanged.mockImplementation((_auth: unknown, handler: (u: unknown) => void) => {
      handler(fakeUser());
      return unsubscribe;
    });

    const cb = vi.fn();
    const off = new FirebaseAuthProvider().onAuthChange(cb);
    expect(cb).toHaveBeenCalledExactlyOnceWith({
      uid: "u-1",
      email: "a@example.test",
      displayName: "Alex",
    });
    off();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
