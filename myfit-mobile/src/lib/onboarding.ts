/**
 * 온보딩 완료 플래그 유틸
 * storage.ts와 분리 — SSR-safe
 */

const ONBOARDING_KEY = 'myfit_onboarded';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function setOnboarded(): void {
  if (!isBrowser()) return;
  localStorage.setItem(ONBOARDING_KEY, '1');
}

export function isOnboarded(): boolean {
  if (!isBrowser()) return false;
  return localStorage.getItem(ONBOARDING_KEY) === '1';
}
