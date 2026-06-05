/**
 * localStorage 래퍼 — SSR-safe
 * 측정값 + 피팅 히스토리 관리
 */

'use client';

export interface Measurements {
  height: number;   // cm
  weight: number;   // kg
  shoulder: number; // cm
  chest: number;    // cm
  waist: number;    // cm
  hip: number;      // cm
}

export interface FitHistoryItem {
  id: string;
  timestamp: number;
  resultImageUrl: string;
  garmentImageUrl: string;
  garmentName?: string;
  category: 'tops' | 'bottoms';
}

const KEYS = {
  MEASUREMENTS: 'myfit_measurements',
  HISTORY: 'myfit_fit_history',
  CONSENTED: 'myfit_consented',
  LAST_PERSON_IMAGE: 'myfit_last_person_b64', // 마지막 신체 사진 base64 (재사용용)
};

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

// ── 측정값 ──

export function saveMeasurements(m: Measurements): void {
  if (!isBrowser()) return;
  localStorage.setItem(KEYS.MEASUREMENTS, JSON.stringify(m));
}

export function loadMeasurements(): Measurements | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(KEYS.MEASUREMENTS);
    if (!raw) return null;
    return JSON.parse(raw) as Measurements;
  } catch {
    return null;
  }
}

// ── 동의 여부 ──

export function setConsented(): void {
  if (!isBrowser()) return;
  localStorage.setItem(KEYS.CONSENTED, '1');
}

export function isConsented(): boolean {
  if (!isBrowser()) return false;
  return localStorage.getItem(KEYS.CONSENTED) === '1';
}

// ── 마지막 신체 사진 재사용 ──

export function saveLastPersonImage(base64: string): void {
  if (!isBrowser()) return;
  try {
    // 5MB 초과 시 저장하지 않음
    if (base64.length > 5 * 1024 * 1024 * 1.37) return; // base64 overhead ~1.37x
    localStorage.setItem(KEYS.LAST_PERSON_IMAGE, base64);
  } catch {
    // storage quota 초과 시 무시
  }
}

export function loadLastPersonImage(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(KEYS.LAST_PERSON_IMAGE);
}

export function clearLastPersonImage(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(KEYS.LAST_PERSON_IMAGE);
}

// ── 피팅 히스토리 ──

const MAX_HISTORY = 10;

export function saveFitHistory(item: FitHistoryItem): void {
  if (!isBrowser()) return;
  try {
    const existing = loadFitHistory();
    const updated = [item, ...existing].slice(0, MAX_HISTORY);
    localStorage.setItem(KEYS.HISTORY, JSON.stringify(updated));
  } catch {
    // storage quota 초과 시 무시
  }
}

export function loadFitHistory(): FitHistoryItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(KEYS.HISTORY);
    if (!raw) return [];
    return JSON.parse(raw) as FitHistoryItem[];
  } catch {
    return [];
  }
}

// ── 사이즈 계산 유틸 (panel.js 포팅) ──

export const SIZE_CHART = {
  tops:    { XS: 84, S: 88, M: 92, L: 96, XL: 100, '2XL': 106 },
  bottoms: { '26': 62, '28': 67, '30': 72, '32': 77, '34': 82, '36': 87 },
};

export const SIZES_TOPS    = ['XS', 'S', 'M', 'L', 'XL', '2XL'] as const;
export const SIZES_BOTTOMS = ['26', '28', '30', '32', '34', '36'] as const;

export function calcRecommendedSize(m: Measurements, type: 'tops' | 'bottoms' | 'shoes'): string {
  if (type === 'tops') {
    let best = 'M';
    let minDiff = Infinity;
    for (const [size, ref] of Object.entries(SIZE_CHART.tops)) {
      const diff = Math.abs(m.chest - ref);
      if (diff < minDiff) { minDiff = diff; best = size; }
    }
    return best;
  }
  if (type === 'bottoms') {
    let best = '30';
    let minDiff = Infinity;
    for (const [size, ref] of Object.entries(SIZE_CHART.bottoms)) {
      const diff = Math.abs(m.waist - ref);
      if (diff < minDiff) { minDiff = diff; best = size; }
    }
    return best;
  }
  // 신발
  if (m.height < 160) return '250';
  if (m.height < 165) return '255';
  if (m.height < 170) return '260';
  if (m.height < 175) return '265';
  if (m.height < 180) return '270';
  if (m.height < 185) return '275';
  return '280';
}
