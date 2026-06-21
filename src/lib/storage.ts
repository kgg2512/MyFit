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
  DEMO_SEEDED: 'myfit_demo_seeded',           // 데모 seed 1회 주입 마커
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

// ── 데모 seed (투자 시연용 — 데모 빌드에서 첫 진입을 풍성하게) ──

/**
 * 데모 빌드 한정 초기 데이터 주입.
 * - 실제 사용자 데이터가 하나라도 있으면 절대 덮어쓰지 않는다(가드).
 * - 1회만 주입(DEMO_SEEDED 마커). 사용자가 seed를 지워도 다시 채우지 않음.
 * - basePath는 데모 이미지 경로 보정용(GitHub Pages /MyFit/app-demo).
 * @returns 이번 호출에서 실제로 seed를 주입했는지 여부
 */
export function seedDemoData(basePath = ''): boolean {
  if (!isBrowser()) return false;

  // 이미 1회 주입했으면 재주입 금지
  if (localStorage.getItem(KEYS.DEMO_SEEDED) === '1') return false;

  const hasMeasurements = !!localStorage.getItem(KEYS.MEASUREMENTS);
  const hasHistory = loadFitHistory().length > 0;

  // 실제 사용자 데이터가 있으면 손대지 않는다(덮어쓰기 방지)
  if (hasMeasurements || hasHistory) {
    localStorage.setItem(KEYS.DEMO_SEEDED, '1');
    return false;
  }

  // seed 치수 (M 사이즈 표준 체형 — 사이즈 추천 배지가 즉시 보이도록)
  const seedMeasurements: Measurements = {
    height: 171, weight: 65, shoulder: 41, chest: 94, waist: 74, hip: 96,
  };
  saveMeasurements(seedMeasurements);

  // seed 동의 (데모는 동의 모달 없이 바로 풍성하게 — 시연 흐름 보호)
  localStorage.setItem(KEYS.CONSENTED, '1');

  // seed 피팅 히스토리 (데모 이미지 사용, 최근→과거 순)
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const seedHistory: FitHistoryItem[] = [
    {
      id: 'demo-1',
      timestamp: now - 2 * 60 * 60 * 1000, // 2시간 전
      resultImageUrl: `${basePath}/demo/tops_female.png`,
      garmentImageUrl: `${basePath}/demo/tops_female.png`,
      garmentName: '오버핏 셔츠',
      category: 'tops',
    },
    {
      id: 'demo-2',
      timestamp: now - 1 * DAY, // 어제
      resultImageUrl: `${basePath}/demo/bottoms_male.png`,
      garmentImageUrl: `${basePath}/demo/bottoms_male.png`,
      garmentName: '와이드 데님',
      category: 'bottoms',
    },
    {
      id: 'demo-3',
      timestamp: now - 3 * DAY, // 3일 전
      resultImageUrl: `${basePath}/demo/tops_male.png`,
      garmentImageUrl: `${basePath}/demo/tops_male.png`,
      garmentName: '니트 스웨터',
      category: 'tops',
    },
  ];
  // 최신순 정렬 보장 (timestamp 내림차순)
  seedHistory.sort((a, b) => b.timestamp - a.timestamp);
  localStorage.setItem(KEYS.HISTORY, JSON.stringify(seedHistory));

  localStorage.setItem(KEYS.DEMO_SEEDED, '1');
  return true;
}
