/**
 * avatarModel — 치수 기반 신체 실루엣 파라미터 (MyFit P8 코어, 순수 함수)
 *
 * 회장 비전: "실제로 내가 어떤 신체 상태인지를 정확한 방향으로 구현."
 *   사용자 실측 치수(키·어깨·가슴·허리·엉덩이) → 정면 파라메트릭 실루엣 지오메트리.
 *
 * 설계 원칙:
 *   - 순수 함수(외부 의존 0) → 오라클 테스트 대상(computeAvatarParams).
 *   - "정확한 방향" 원칙: 실측 치수를 비례로 반영(과장 렌더 금지). 단조성 보장
 *     (가슴둘레↑ → 가슴 폭↑, 어깨↑ → 어깨 폭↑, 키↑ → 다리 길이↑).
 *   - 얼굴 특징 없는 익명 실루엣(TTF 패턴). BodyAvatar.tsx가 이 값으로 SVG를 그린다.
 *   - 결측 필드는 표준 체형 기본값으로 안전 degrade.
 */

/** 신체 치수 입력 (모든 필드 옵션 — 결측 허용) */
export interface AvatarInput {
  height?: number; // cm
  shoulder?: number; // cm (어깨 너비, 견봉간)
  chest?: number; // cm (가슴 둘레)
  waist?: number; // cm (허리 둘레)
  hip?: number; // cm (엉덩이 둘레)
}

/** SVG 실루엣 지오메트리 (viewBox 0 0 160 370 기준, 단위 = SVG user unit) */
export interface AvatarParams {
  viewW: number;
  viewH: number;
  cx: number; // 중심 x
  headR: number;
  headCy: number;
  neckY: number;
  neckHalf: number;
  shoulderY: number;
  shoulderHalf: number;
  chestY: number;
  chestHalf: number;
  waistY: number;
  waistHalf: number;
  hipY: number;
  hipHalf: number;
  hemY: number; // 상의 밑단 기준선 (엉덩이 살짝 아래)
  legBottomY: number;
}

/** 표준 체형 기본값 (결측 보정용 — profile 프리셋 M과 정합) */
const DEFAULTS = { height: 171, shoulder: 41, chest: 94, waist: 78, hip: 96 };

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

/**
 * 치수 → 실루엣 파라미터.
 * 둘레(가슴/허리/엉덩이)는 정면 투영 반폭 = 둘레/(2π)로 환산(원기둥 근사).
 * 어깨는 이미 너비(견봉간)이므로 반폭 = 어깨/2. 공통 스케일 k(SVG unit/cm)를 곱한다.
 */
export function computeAvatarParams(m: AvatarInput = {}): AvatarParams {
  const height = clamp(m.height ?? DEFAULTS.height, 140, 210);
  const shoulder = clamp(m.shoulder ?? DEFAULTS.shoulder, 30, 60);
  const chest = clamp(m.chest ?? DEFAULTS.chest, 60, 140);
  const waist = clamp(m.waist ?? DEFAULTS.waist, 50, 130);
  const hip = clamp(m.hip ?? DEFAULTS.hip, 60, 150);

  const viewW = 160;
  const viewH = 370;
  const cx = 80;
  const k = 2.15; // SVG unit per cm (폭 환산 계수)

  const shoulderHalf = (shoulder / 2) * k;
  const chestHalf = (chest / (2 * Math.PI)) * k;
  const waistHalf = (waist / (2 * Math.PI)) * k;
  const hipHalf = (hip / (2 * Math.PI)) * k;
  const neckHalf = Math.max(6, shoulderHalf * 0.2);

  // 세로 골격 (torso 고정, 다리 길이만 키에 비례 → 키가 실루엣에 드러남)
  const headR = 15;
  const headCy = 26;
  const neckY = 46;
  const shoulderY = 56;
  const chestY = 108;
  const waistY = 168;
  const hipY = 210;
  const hemY = hipY + 8;
  // 입력 도메인(140~210cm) 전 구간에서 클램프 비포화 → 단조성 보장 (viewH 370 내 수렴)
  const legLen = clamp((height - 175) * 0.55 + 138.5, 115, 160);
  const legBottomY = hipY + legLen;

  return {
    viewW, viewH, cx, headR, headCy,
    neckY, neckHalf,
    shoulderY, shoulderHalf,
    chestY, chestHalf,
    waistY, waistHalf,
    hipY, hipHalf,
    hemY, legBottomY,
  };
}
