/**
 * 데모 seed (투자/사용자 시연용) — 데모 빌드 전용.
 * 저장은 storage.ts 공개 API로만 위임하고, 여기서는 "무엇을 넣을지"만 정의한다.
 * storage.ts 에는 데모 개념이 남지 않는다(순수 저장 API).
 */

'use client';

import {
  loadMeasurements,
  saveMeasurements,
  loadFitHistory,
  saveFitHistory,
  setConsented,
  setAgeConfirmed,
  isDemoSeeded,
  markDemoSeeded,
  type Measurements,
  type FitHistoryItem,
} from '@/lib/storage';

/**
 * 데모 빌드 한정 초기 데이터 주입.
 * - 실제 사용자 데이터가 하나라도 있으면 절대 덮어쓰지 않는다(가드).
 * - 1회만 주입(DEMO_SEEDED 마커). 사용자가 seed를 지워도 다시 채우지 않음.
 * - basePath는 데모 이미지 경로 보정용(GitHub Pages /MyFit/v2 등).
 * @returns 이번 호출에서 실제로 seed를 주입했는지 여부
 */
export function seedDemoData(basePath = ''): boolean {
  if (typeof window === 'undefined') return false;

  // 이미 1회 주입했으면 재주입 금지
  if (isDemoSeeded()) return false;

  // 실제 사용자 데이터가 있으면 손대지 않는다(덮어쓰기 방지)
  if (loadMeasurements() || loadFitHistory().length > 0) {
    markDemoSeeded();
    return false;
  }

  // seed 치수 (M 사이즈 표준 체형 — 사이즈 추천 배지가 즉시 보이도록)
  const seedMeasurements: Measurements = {
    height: 171, weight: 65, shoulder: 41, chest: 94, waist: 74, hip: 96,
  };
  saveMeasurements(seedMeasurements);

  // seed 동의 + 연령 확인 (데모는 동의 모달 없이 바로 풍성하게 — 시연 흐름 보호)
  setConsented();
  setAgeConfirmed();

  // seed 피팅 히스토리 (데모 이미지 사용)
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const seedHistory: FitHistoryItem[] = [
    { id: 'demo-1', timestamp: now - 2 * 60 * 60 * 1000, resultImageUrl: `${basePath}/demo/tops_female.png`,  garmentImageUrl: `${basePath}/demo/tops_female.png`,  garmentName: '오버핏 셔츠',  category: 'tops' },
    { id: 'demo-2', timestamp: now - 1 * DAY,            resultImageUrl: `${basePath}/demo/bottoms_male.png`,  garmentImageUrl: `${basePath}/demo/bottoms_male.png`,  garmentName: '와이드 데님',  category: 'bottoms' },
    { id: 'demo-3', timestamp: now - 3 * DAY,            resultImageUrl: `${basePath}/demo/tops_male.png`,     garmentImageUrl: `${basePath}/demo/tops_male.png`,     garmentName: '니트 스웨터',  category: 'tops' },
  ];
  // 오래된 것부터 저장 → saveFitHistory가 [최신, ...기존] 구조라 결과는 최신순 유지
  [...seedHistory]
    .sort((a, b) => a.timestamp - b.timestamp)
    .forEach(saveFitHistory);

  markDemoSeeded();
  return true;
}
