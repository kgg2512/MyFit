'use client';

/**
 * BodyAvatar — 치수 기반 신체 실루엣 + 사이즈 핏 오버레이 (MyFit P8)
 *
 * - 지오메트리는 avatarModel.computeAvatarParams(순수 함수)에서만 온다("정확한 방향" 원칙).
 * - 선택 사이즈의 부위별 핏(타이트/적정/오버)을 실루엣 위 의류 오버레이 색으로 표시.
 *   사이즈 토글 시 부모가 chest/shoulder를 갱신 → 오버레이·색 즉시 갱신(TTF 패턴).
 * - 얼굴 특징 없는 익명 실루엣. 인라인 style + globals.css 핏 토큰 재사용. 이모지 금지.
 */

import { computeAvatarParams, type AvatarInput } from '@/lib/avatarModel';
import type { FitTone, FitLevel } from '@/lib/fitEngine';

export interface AvatarFitInfo {
  tone: FitTone;
  level: FitLevel;
  label: string;
}

interface BodyAvatarProps {
  measurements: AvatarInput;
  chest?: AvatarFitInfo;
  shoulder?: AvatarFitInfo;
  shoulderExcluded?: boolean;
  sizeName?: string;
  width?: number; // 렌더 폭(px)
}

const TONE_COLOR: Record<FitTone, string> = {
  tight: 'var(--myfit-fit-tight)',
  standard: 'var(--myfit-fit-standard)',
  oversized: 'var(--myfit-fit-oversized)',
};

// 핏 레벨 → 의류가 몸에서 바깥으로 벌어지는 정도(SVG unit). 타이트=몸에 붙음, 오버=여유.
const LEVEL_OFFSET: Record<FitLevel, number> = {
  impossible: -4,
  tight: 0,
  bodyfit: 4,
  standard: 8,
  semiover: 13,
  oversized: 19,
};

function pt(x: number, y: number): string {
  return `${x.toFixed(1)},${y.toFixed(1)}`;
}

export function BodyAvatar({
  measurements,
  chest,
  shoulder,
  shoulderExcluded = false,
  sizeName,
  width = 180,
}: BodyAvatarProps) {
  const p = computeAvatarParams(measurements);
  const { cx, viewW, viewH } = p;

  // ── 신체 실루엣 path ──
  const neckTopY = p.headCy + p.headR - 2;
  const crotchY = p.hipY + (p.legBottomY - p.hipY) * 0.12;
  const legOuter = p.hipHalf * 0.55;
  const legInner = p.hipHalf * 0.1;

  const bodyPath = [
    `M ${pt(cx - p.neckHalf, neckTopY)}`,
    `L ${pt(cx - p.shoulderHalf, p.shoulderY)}`,
    `L ${pt(cx - p.chestHalf, p.chestY)}`,
    `L ${pt(cx - p.waistHalf, p.waistY)}`,
    `L ${pt(cx - p.hipHalf, p.hipY)}`,
    `L ${pt(cx - legOuter, p.legBottomY)}`,
    `L ${pt(cx - legInner, p.legBottomY)}`,
    `L ${pt(cx, crotchY)}`,
    `L ${pt(cx + legInner, p.legBottomY)}`,
    `L ${pt(cx + legOuter, p.legBottomY)}`,
    `L ${pt(cx + p.hipHalf, p.hipY)}`,
    `L ${pt(cx + p.waistHalf, p.waistY)}`,
    `L ${pt(cx + p.chestHalf, p.chestY)}`,
    `L ${pt(cx + p.shoulderHalf, p.shoulderY)}`,
    `L ${pt(cx + p.neckHalf, neckTopY)}`,
    'Z',
  ].join(' ');

  // ── 의류 오버레이 (선택 사이즈 핏) ──
  const chestColor = chest ? TONE_COLOR[chest.tone] : 'var(--myfit-fit-standard)';
  const shoulderColor = shoulder ? TONE_COLOR[shoulder.tone] : 'var(--myfit-fit-standard)';
  const chestOff = chest ? LEVEL_OFFSET[chest.level] : LEVEL_OFFSET.standard;
  const shoulderOff = shoulder ? LEVEL_OFFSET[shoulder.level] : LEVEL_OFFSET.standard;

  const gChestHalf = p.chestHalf + chestOff;
  const gHemHalf = gChestHalf * 0.98;
  const gShoulderHalf = shoulderExcluded
    ? p.neckHalf + 6 // 민소매: 얇은 어깨끈
    : p.shoulderHalf + shoulderOff;
  const gTopY = p.shoulderY - 3;
  const neckDipY = p.shoulderY + 7;

  const garmentPath = [
    `M ${pt(cx - gShoulderHalf, gTopY)}`,
    `L ${pt(cx - gChestHalf, p.chestY)}`,
    `L ${pt(cx - gHemHalf, p.hemY)}`,
    `L ${pt(cx + gHemHalf, p.hemY)}`,
    `L ${pt(cx + gChestHalf, p.chestY)}`,
    `L ${pt(cx + gShoulderHalf, gTopY)}`,
    `L ${pt(cx + p.neckHalf, gTopY)}`,
    `L ${pt(cx, neckDipY)}`,
    `L ${pt(cx - p.neckHalf, gTopY)}`,
    'Z',
  ].join(' ');

  const ariaParts: string[] = [];
  if (chest) ariaParts.push(`가슴 ${chest.label}`);
  if (shoulderExcluded) ariaParts.push('어깨 비교 제외(민소매)');
  else if (shoulder) ariaParts.push(`어깨 ${shoulder.label}`);
  const aria = `내 치수 기반 신체 실루엣${sizeName ? ` · 사이즈 ${sizeName}` : ''} 핏 오버레이. ${ariaParts.join(', ')}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <svg
        width={width}
        height={(width * viewH) / viewW}
        viewBox={`0 0 ${viewW} ${viewH}`}
        role="img"
        aria-label={aria}
        style={{ display: 'block' }}
      >
        {/* 신체 실루엣 */}
        <circle cx={cx} cy={p.headCy} r={p.headR} fill="var(--myfit-surface2)" stroke="var(--myfit-border-strong)" strokeWidth={1.5} />
        <path d={bodyPath} fill="var(--myfit-surface2)" stroke="var(--myfit-border-strong)" strokeWidth={1.5} strokeLinejoin="round" />

        {/* 의류 오버레이 (선택 사이즈 핏 색상) */}
        <path d={garmentPath} fill={chestColor} fillOpacity={0.16} stroke={chestColor} strokeWidth={2} strokeLinejoin="round" />

        {/* 어깨 핏 라인 (민소매 제외 시 숨김) */}
        {!shoulderExcluded && (
          <line
            x1={cx - gShoulderHalf} y1={gTopY}
            x2={cx + gShoulderHalf} y2={gTopY}
            stroke={shoulderColor} strokeWidth={3} strokeLinecap="round"
          />
        )}

        {/* 부위 위치 마커 (어깨·가슴) */}
        {!shoulderExcluded && (
          <circle cx={cx + gShoulderHalf} cy={gTopY} r={3.2} fill={shoulderColor} />
        )}
        <circle cx={cx - gChestHalf} cy={p.chestY} r={3.2} fill={chestColor} />
      </svg>

      {/* 부위별 판정 라벨 (SVG 밖 — 클리핑 방지·접근성) */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <span className="fit-tag" style={{ background: 'var(--myfit-surface2)', color: 'var(--myfit-text-sub)' }}>
          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: chestColor, display: 'inline-block' }} />
          가슴 {chest ? chest.label : '-'}
        </span>
        <span className="fit-tag" style={{ background: 'var(--myfit-surface2)', color: 'var(--myfit-text-sub)' }}>
          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: shoulderExcluded ? 'var(--myfit-text-muted)' : shoulderColor, display: 'inline-block' }} />
          어깨 {shoulderExcluded ? '나시 제외' : shoulder ? shoulder.label : '-'}
        </span>
      </div>
    </div>
  );
}

export default BodyAvatar;
