/**
 * 로그인 상태 + 자동 동기화 React 훅 (페이지가 쓰는 유일한 인증 진입점).
 * 페이지는 이 훅과 authProvider/cloudStore 인터페이스만 참조한다 → firebase 직접 import 0.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { authProvider, type AuthUser } from './index';
import { cloudStore } from '../cloud';
import { syncMeasurementsOnLogin } from '../cloud/sync';
import { isCloudConsented, setCloudConsent, clearCloudConsent, type Measurements } from '../storage';

export interface AuthState {
  /** 현재 로그인 사용자(없으면 null). */
  user: AuthUser | null;
  /** 초기 인증 상태 확인 중. */
  loading: boolean;
  /** 이 빌드에서 로그인 기능 사용 가능 여부(firebase 비활성 빌드 = false). */
  available: boolean;
  /** 로그인 직후 로컬↔클라우드 동기화 진행 중. */
  syncing: boolean;
  /** 마지막 로그인 시도 에러 메시지(사용자 취소는 null). */
  error: string | null;
  /** 클라우드 저장 별도 동의 여부(로그인과 분리된 옵트인). */
  cloudConsent: boolean;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  /** 클라우드 저장 동의 부여 → 로그인 상태면 즉시 로컬↔클라우드 동기화. */
  giveCloudConsent: () => Promise<void>;
  /** 클라우드 저장 동의 철회 → 이후 업로드 중단 + 이미 올라간 클라우드 문서 삭제(로컬은 유지). */
  revokeCloudConsent: () => Promise<void>;
  /** 동의+로그인 상태면 치수를 클라우드에 즉시 업로드(미동의/비로그인 시 no-op). */
  pushMeasurements: (m: Measurements) => Promise<void>;
  /** 클라우드 데이터+계정 삭제(PIPA). 'deleted'=계정삭제, 'signedout'=재로그인필요로 로그아웃 대체, 'none'=비로그인. */
  purgeCloud: () => Promise<'deleted' | 'signedout' | 'none'>;
}

/**
 * @param onSynced 로그인 후 동기화가 끝나면 최종 치수로 콜백(페이지가 폼을 갱신하도록).
 */
export function useAuth(onSynced?: (m: Measurements | null) => void): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(authProvider.available);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cloudConsent, setCloudConsentState] = useState(false);

  // 클라우드 동의 플래그 초기 로드(localStorage → SSR 후 클라이언트에서).
  useEffect(() => {
    setCloudConsentState(isCloudConsented());
  }, []);

  useEffect(() => {
    if (!authProvider.available) {
      setLoading(false);
      return;
    }
    const unsub = authProvider.onAuthChange(async u => {
      setUser(u);
      setLoading(false);
      if (u) {
        setSyncing(true);
        try {
          const merged = await syncMeasurementsOnLogin(u.uid);
          onSynced?.(merged);
        } catch {
          // 오프라인·규칙거부 등 → 로컬 데이터 유지(서비스 지속).
        } finally {
          setSyncing(false);
        }
      }
    });
    return unsub;
    // onSynced는 페이지에서 안정적으로 넘긴다고 가정(deps 고정 — 구독 재생성 방지).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signInGoogle = useCallback(async () => {
    setError(null);
    try {
      await authProvider.signInWithGoogle();
    } catch (e) {
      const code = (e as { code?: string }).code;
      // 사용자가 팝업을 닫음 = 취소 → 에러 아님.
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
      setError('로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authProvider.signOut();
    } catch {
      // 무시
    }
  }, []);

  const pushMeasurements = useCallback(async (m: Measurements) => {
    if (!isCloudConsented()) return; // 클라우드 저장 미동의 → 위탁 write 0(로컬만)
    const u = authProvider.currentUser();
    if (!u) return;
    try {
      await cloudStore.saveMeasurements(u.uid, m);
    } catch {
      // 업로드 실패는 로컬 저장을 막지 않는다(다음 동기화 때 재시도).
    }
  }, []);

  const giveCloudConsent = useCallback(async () => {
    setCloudConsent();               // 동의 플래그 먼저 set → 이후 sync가 통과
    setCloudConsentState(true);
    const u = authProvider.currentUser();
    if (!u) return;
    setSyncing(true);
    try {
      const merged = await syncMeasurementsOnLogin(u.uid); // 동의 직후 1회 동기화
      onSynced?.(merged);
    } catch {
      // 오프라인 등 → 로컬 유지
    } finally {
      setSyncing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const revokeCloudConsent = useCallback(async () => {
    clearCloudConsent();             // 이후 업로드 중단
    setCloudConsentState(false);
    const u = authProvider.currentUser();
    if (!u) return;
    try {
      await cloudStore.deleteAll(u.uid); // 이미 올라간 클라우드 문서 삭제(로컬은 유지)
    } catch {
      // 삭제 실패해도 동의는 철회됨(이후 업로드 안 함)
    }
  }, []);

  const purgeCloud = useCallback(async (): Promise<'deleted' | 'signedout' | 'none'> => {
    const u = authProvider.currentUser();
    if (!u) return 'none';
    try {
      await cloudStore.deleteAll(u.uid);
    } catch {
      // 문서 삭제 실패해도 계정 삭제 시도.
    }
    try {
      await authProvider.deleteAccount();
      return 'deleted';
    } catch {
      // 최근 로그인 필요 등 → 계정 삭제 불가 → 로그아웃으로 대체.
      try {
        await authProvider.signOut();
      } catch {
        // 무시
      }
      return 'signedout';
    }
  }, []);

  return { user, loading, available: authProvider.available, syncing, error, cloudConsent, signInGoogle, signOut, giveCloudConsent, revokeCloudConsent, pushMeasurements, purgeCloud };
}
