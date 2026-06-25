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
  AGE_CONFIRMED: 'myfit_age_confirmed',          // 만 14세 이상 확인 (PIPA §22)
  LAST_PERSON_IMAGE: 'myfit_last_person_b64',    // 마지막 신체 사진 base64 (재사용용)
  LAST_PERSON_TS: 'myfit_last_person_ts',        // 신체 사진 저장 시각 (만료 자동폐기용)
  DEMO_SEEDED: 'myfit_demo_seeded',              // 데모 seed 1회 주입 마커
  ONBOARDED: 'myfit_onboarded',                  // 온보딩 완료 (onboarding.ts와 동일 키 — clearAllData용)
};

/**
 * 신체 사진 보관 기간 (처리후삭제 원칙 — TrueToForm 벤치마크).
 * 이 기간이 지나면 load 시점에 자동 폐기된다.
 */
export const PHOTO_RETENTION_DAYS = 7;
const PHOTO_RETENTION_MS = PHOTO_RETENTION_DAYS * 24 * 60 * 60 * 1000;

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

/** 측정값 완전 삭제 (localStorage에서 키 제거 — 숨김 아님) */
export function clearMeasurements(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(KEYS.MEASUREMENTS);
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

// ── 만 14세 이상 확인 (PIPA §22 + Google Play 정책) ──

export function setAgeConfirmed(): void {
  if (!isBrowser()) return;
  localStorage.setItem(KEYS.AGE_CONFIRMED, '1');
}

export function isAgeConfirmed(): boolean {
  if (!isBrowser()) return false;
  return localStorage.getItem(KEYS.AGE_CONFIRMED) === '1';
}

// ── 마지막 신체 사진 재사용 (만료 자동폐기 — 처리후삭제 원칙) ──

export function saveLastPersonImage(base64: string): void {
  if (!isBrowser()) return;
  try {
    // 5MB 초과 시 저장하지 않음
    if (base64.length > 5 * 1024 * 1024 * 1.37) return; // base64 overhead ~1.37x
    localStorage.setItem(KEYS.LAST_PERSON_IMAGE, base64);
    // 저장 시각 기록 (만료 자동폐기 기준)
    localStorage.setItem(KEYS.LAST_PERSON_TS, String(Date.now()));
  } catch {
    // storage quota 초과 시 무시
  }
}

/**
 * 신체 사진 로드. 보관 기간(PHOTO_RETENTION_DAYS) 경과 시
 * load 시점에 자동 폐기(이미지+타임스탬프 키 제거)하고 null 반환.
 * 타임스탬프가 없는 레거시 사진은 즉시 만료 처리(안전 측 — 무기한 보관 방지).
 */
export function loadLastPersonImage(): string | null {
  if (!isBrowser()) return null;
  const img = localStorage.getItem(KEYS.LAST_PERSON_IMAGE);
  if (!img) return null;

  const tsRaw = localStorage.getItem(KEYS.LAST_PERSON_TS);
  const ts = tsRaw ? parseInt(tsRaw, 10) : NaN;
  // 타임스탬프 없음/손상 = 만료로 간주, 또는 보관 기간 경과 → 자동 폐기
  if (isNaN(ts) || Date.now() - ts > PHOTO_RETENTION_MS) {
    clearLastPersonImage();
    return null;
  }
  return img;
}

export function clearLastPersonImage(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(KEYS.LAST_PERSON_IMAGE);
  localStorage.removeItem(KEYS.LAST_PERSON_TS);
}

export interface PhotoStatus {
  /** 유효한(미만료) 신체 사진이 저장돼 있는지 */
  stored: boolean;
  /** 만료까지 남은 일수 (올림, 0 이상). stored=false면 null */
  daysLeft: number | null;
  /** 만료 예정 시각(ms). stored=false면 null */
  expiresAt: number | null;
}

/**
 * 신체 사진 상태 조회 (프라이버시 대시보드용).
 * 만료된 사진은 자동 폐기 후 없음으로 보고(load와 동일 정책).
 */
export function getPhotoStatus(): PhotoStatus {
  const empty: PhotoStatus = { stored: false, daysLeft: null, expiresAt: null };
  if (!isBrowser()) return empty;

  const img = localStorage.getItem(KEYS.LAST_PERSON_IMAGE);
  if (!img) return empty;

  const tsRaw = localStorage.getItem(KEYS.LAST_PERSON_TS);
  const ts = tsRaw ? parseInt(tsRaw, 10) : NaN;
  if (isNaN(ts)) {
    // 타임스탬프 손상 → 만료로 간주, 폐기
    clearLastPersonImage();
    return empty;
  }
  const expiresAt = ts + PHOTO_RETENTION_MS;
  const remainingMs = expiresAt - Date.now();
  if (remainingMs <= 0) {
    clearLastPersonImage();
    return empty;
  }
  return {
    stored: true,
    daysLeft: Math.ceil(remainingMs / (24 * 60 * 60 * 1000)),
    expiresAt,
  };
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

/** 핏 히스토리 전체 삭제 (localStorage에서 키 제거) */
export function clearFitHistory(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(KEYS.HISTORY);
}

/**
 * 핏 히스토리 항목 1개 삭제.
 * 마지막 1개를 지우면 빈 배열이 되며, 빈 배열이면 키 자체를 제거(완전 삭제).
 * @returns 삭제 후 남은 항목 배열
 */
export function deleteFitHistoryItem(id: string): FitHistoryItem[] {
  if (!isBrowser()) return [];
  const remaining = loadFitHistory().filter(item => item.id !== id);
  if (remaining.length === 0) {
    localStorage.removeItem(KEYS.HISTORY);
  } else {
    localStorage.setItem(KEYS.HISTORY, JSON.stringify(remaining));
  }
  return remaining;
}

// ── 전체 삭제 (내 데이터 전부 삭제 — PIPA 삭제권 보장) ──

/**
 * MyFit이 이 기기에 저장한 모든 데이터를 완전 제거한다.
 * 측정값·핏 히스토리·신체 사진(+타임스탬프)·동의·연령 확인·온보딩·데모 마커 전부.
 * 각 항목을 localStorage.removeItem으로 실제 삭제(숨김 아님).
 */
export function clearAllData(): void {
  if (!isBrowser()) return;
  for (const key of Object.values(KEYS)) {
    localStorage.removeItem(key);
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

  // seed 동의 + 연령 확인 (데모는 동의 모달 없이 바로 풍성하게 — 시연 흐름 보호)
  localStorage.setItem(KEYS.CONSENTED, '1');
  localStorage.setItem(KEYS.AGE_CONFIRMED, '1');

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
