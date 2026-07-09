'use client';

/**
 * /fit/result — FitEngine 핏 예측 결과 화면 (MyFit P3 → P7/P8/P9 개편)
 *
 * P7: 데이터 소스 = storage 활성 사이즈표(getActiveFitInput) 우선.
 *     없으면 데모 빌드는 데모 사이즈표(getDemoFitInput), 스토어 빌드는 빈 상태 카드.
 * P8: 좌 아바타(BodyAvatar, 치수 기반 실루엣+핏 오버레이) / 우 사이즈 토글+게이지.
 *     사이즈 토글 → 오버레이·게이지 즉시 갱신.
 * P9: "내 사진과 비교" 토글(온디바이스 표시만, 네트워크 전송 0).
 *
 * FitEngine 밴드·판정 로직 불변(회장 확정). globals.css 토큰/클래스만 사용.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fitEngine, type FitResult, type SizeFit, type PartFit } from '@/lib/fitEngine';
import { loadMeasurements, getActiveFitInput, loadLastPersonImage, type Measurements } from '@/lib/storage';
import { getDemoFitInput } from '@/demo/demoChart';
import BodyAvatar, { type AvatarFitInfo } from '@/components/BodyAvatar';
import type { AvatarInput } from '@/lib/avatarModel';

// 회장 케이스 fallback (치수 미입력 시 — P2 검증 케이스 재현용)
const FALLBACK_BODY = { height: 176, chestHalf: 58, shoulder: 56 };

// ─────────────────────────────────────────────────────────────
// 아이콘 (SVG, Lucide 스타일 — 이모지 금지)
// ─────────────────────────────────────────────────────────────
const IconArrowLeft = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);
const IconRuler = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21.3 8.7 8.7 21.3a2.4 2.4 0 0 1-3.4 0l-2.6-2.6a2.4 2.4 0 0 1 0-3.4L15.3 2.7a2.4 2.4 0 0 1 3.4 0l2.6 2.6a2.4 2.4 0 0 1 0 3.4Z" />
    <path d="m7.5 10.5 2 2M11 7l2 2M14.5 3.5l2 2" />
  </svg>
);
const IconInfo = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
  </svg>
);
const IconStar = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
const IconExternal = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);
const IconCamera = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);
const IconUserSilhouette = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

// ─────────────────────────────────────────────────────────────
// 게이지 퍼센트 / 색상
// ─────────────────────────────────────────────────────────────
function levelToPercent(level: string): number {
  const map: Record<string, number> = { impossible: 5, tight: 18, bodyfit: 38, standard: 58, semiover: 78, oversized: 95 };
  return map[level] ?? 50;
}
function gaugeColor(tone: string): string {
  if (tone === 'tight') return 'var(--myfit-fit-tight)';
  if (tone === 'oversized') return 'var(--myfit-fit-oversized)';
  return 'var(--myfit-fit-standard)';
}

const PART_LABEL: Record<string, string> = { 가슴단면: '가슴', 어깨너비: '어깨', 총장: '총장' };

// ─────────────────────────────────────────────────────────────
// 부위별 게이지
// ─────────────────────────────────────────────────────────────
function PartGauge({ part }: { part: PartFit }) {
  const pct = levelToPercent(part.level);
  const color = gaugeColor(part.tone);
  const label = PART_LABEL[part.measureKey] || part.measureKey;

  if (part.measureKey === '총장') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--myfit-text-sub)', minWidth: 28 }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--myfit-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {part.garment !== null ? `${part.garment}cm` : '-'}
        </span>
      </div>
    );
  }

  const isSleevelessShoulder = part.ease === null && part.label === '민소매 — 어깨 비교 제외';

  return (
    <div className="fit-gauge" role="group" aria-label={`${label} 핏 게이지`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--myfit-text-sub)', minWidth: 28 }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {!isSleevelessShoulder && part.ease !== null && (
            <span style={{ fontSize: 11, color: 'var(--myfit-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
              {part.ease >= 0 ? '+' : ''}{part.ease}cm
            </span>
          )}
          {isSleevelessShoulder ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--myfit-text-muted)' }}>
              <span aria-hidden="true">{IconInfo}</span>
              <span>나시 제외</span>
            </span>
          ) : (
            <span className={`fit-tag fit-tag--${part.tone}`} aria-label={`핏 판정: ${part.label}`}>
              {part.label}
            </span>
          )}
        </div>
      </div>
      {!isSleevelessShoulder && (
        <div className="fit-gauge-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} 핏 위치`}>
          <div className="fit-gauge-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 사이즈 카드
// ─────────────────────────────────────────────────────────────
function SizeCard({ sizeFit, isRecommended }: { sizeFit: SizeFit; isRecommended: boolean }) {
  const primaryTone = sizeFit.primary.tone;
  const borderColor = isRecommended
    ? 'var(--myfit-primary)'
    : primaryTone === 'tight' ? 'var(--myfit-fit-tight)'
      : primaryTone === 'oversized' ? 'var(--myfit-fit-oversized)'
        : 'var(--myfit-border)';
  const bgColor = isRecommended ? 'var(--myfit-primary-soft)' : 'var(--myfit-surface)';

  return (
    <article className="card" style={{ background: bgColor, border: `1.5px solid ${borderColor}`, padding: '16px', position: 'relative', transition: 'border-color 0.2s' }} aria-label={`사이즈 ${sizeFit.size}${isRecommended ? ' (추천)' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: isRecommended ? 'var(--myfit-primary)' : 'var(--myfit-text)', letterSpacing: '-0.5px' }}>{sizeFit.size}</span>
          <span className={`fit-tag fit-tag--${sizeFit.primary.tone}`} aria-label={`대표 핏: ${sizeFit.primary.label}`}>{sizeFit.primary.label}</span>
        </div>
        {isRecommended && (
          <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} aria-label="추천 사이즈">
            <span aria-hidden="true">{IconStar}</span>추천
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sizeFit.parts.map((part) => (
          <PartGauge key={part.measureKey} part={part} />
        ))}
      </div>

      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--myfit-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: 'var(--myfit-text-muted)' }}>핏 적합도</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 80, height: 4, borderRadius: 2, background: 'var(--myfit-border)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${sizeFit.score}%`, background: isRecommended ? 'var(--myfit-primary)' : 'var(--myfit-fit-standard)', borderRadius: 2, transition: 'width 0.6s ease' }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: isRecommended ? 'var(--myfit-primary)' : 'var(--myfit-text-sub)', fontVariantNumeric: 'tabular-nums' }}>{sizeFit.score}</span>
        </div>
      </div>
    </article>
  );
}

function isHttpUrl(u?: string): boolean {
  return !!u && /^https?:\/\//i.test(u.trim());
}

// ─────────────────────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────────────────────
export default function FitResultPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [source, setSource] = useState<'active' | 'demo' | 'none'>('none');
  const [fitResult, setFitResult] = useState<FitResult | null>(null);
  const [bodyUsed, setBodyUsed] = useState<{ height: number; chestHalf: number; shoulder: number } | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [productName, setProductName] = useState<string>('');
  const [productUrl, setProductUrl] = useState<string>('');
  const [stretchLabel, setStretchLabel] = useState<string | null>(null);
  const [avatarMeasure, setAvatarMeasure] = useState<AvatarInput>({});
  const [photoB64, setPhotoB64] = useState<string>('');
  const [showPhoto, setShowPhoto] = useState(false);

  useEffect(() => {
    setMounted(true);

    // 1) 데이터 소스 결정: 활성 사이즈표 → 데모(데모 빌드) → 없음
    const active = getActiveFitInput();
    let chart = active?.chart ?? null;
    if (chart) {
      setSource('active');
      setProductName(active?.productName || '');
      setProductUrl(active?.productUrl || '');
      setStretchLabel(active?.stretch ?? null);
    } else {
      const demo = getDemoFitInput();
      if (demo) {
        chart = demo.chart;
        setSource('demo');
        setProductName(demo.productName);
        setStretchLabel(demo.chart.stretch ?? null);
      } else {
        setSource('none');
        return; // 빈 상태
      }
    }

    // 2) 사용자 치수 → body (chest는 둘레, FitEngine은 단면=절반)
    const m: Measurements | null = loadMeasurements();
    let body: typeof FALLBACK_BODY;
    if (m && m.chest && m.shoulder && m.height) {
      body = { height: m.height, chestHalf: m.chest / 2, shoulder: m.shoulder };
      setIsFallback(false);
      setAvatarMeasure({ height: m.height, shoulder: m.shoulder, chest: m.chest, waist: m.waist, hip: m.hip });
    } else {
      body = FALLBACK_BODY;
      setIsFallback(true);
      // 아바타는 fallback 단면(58)을 둘레(116)로 환산해 근사
      setAvatarMeasure({ height: FALLBACK_BODY.height, shoulder: FALLBACK_BODY.shoulder, chest: FALLBACK_BODY.chestHalf * 2 });
    }
    setBodyUsed(body);

    // 3) 핏 예측 (신축 보정 미적용 — 회장 검증 케이스 판정 유지: stretchFromChart 없음)
    const result = fitEngine.predict(chart, body);
    setFitResult(result);
    setSelectedSize(result.recommended || result.sizes[0]?.size || '');

    // 4) 신체 사진(있을 때만 — 온디바이스, 만료 자동폐기 정책)
    const photo = loadLastPersonImage();
    if (photo) setPhotoB64(photo);
  }, []);

  // 로딩
  if (!mounted) {
    return (
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--myfit-bg)', minHeight: '100dvh' }} aria-busy="true" aria-label="핏 예측 결과 로딩 중">
        <div className="spinner" />
      </main>
    );
  }

  // 빈 상태 (활성 사이즈표 없음 + 데모 아님)
  if (source === 'none' || !fitResult) {
    return (
      <main className="mf-page-enter" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--myfit-bg)', minHeight: '100dvh', color: 'var(--myfit-text)' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(16px + var(--safe-top)) 20px 8px' }}>
          <button onClick={() => router.push('/')} aria-label="홈으로 돌아가기" style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--myfit-surface2)', border: '1px solid var(--myfit-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--myfit-text-sub)' }}>
            {IconArrowLeft}
          </button>
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--myfit-text)' }}>핏 예측 결과</span>
        </header>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 32px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--myfit-primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--myfit-primary)' }}>
            {IconRuler}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--myfit-text)', marginBottom: 6 }}>사이즈표를 입력하면 핏을 예측해드려요</div>
            <div style={{ fontSize: 13, color: 'var(--myfit-text-sub)', lineHeight: 1.6 }}>상품의 실측 사이즈표를 붙여넣으면<br />이 옷이 나에게 어떤 핏인지 사이즈별로 확인할 수 있어요</div>
          </div>
          <button className="btn-primary" onClick={() => router.push('/fit/check')} style={{ maxWidth: 280 }}>사이즈표 입력하러 가기</button>
        </div>
      </main>
    );
  }

  const recommendedSize = fitResult.recommended;
  const selectedFit =
    fitResult.sizes.find((s) => s.size === selectedSize) ||
    fitResult.sizes.find((s) => s.size === recommendedSize) ||
    fitResult.sizes[0];

  const chestPart = selectedFit.parts.find((p) => p.measureKey === '가슴단면');
  const shoulderPart = selectedFit.parts.find((p) => p.measureKey === '어깨너비');
  const shoulderExcluded = shoulderPart?.ease === null && shoulderPart?.label === '민소매 — 어깨 비교 제외';
  const chestInfo: AvatarFitInfo | undefined = chestPart ? { tone: chestPart.tone, level: chestPart.level, label: chestPart.label } : undefined;
  const shoulderInfo: AvatarFitInfo | undefined = shoulderPart ? { tone: shoulderPart.tone, level: shoulderPart.level, label: shoulderPart.label } : undefined;

  const headerSub = [
    productName || (source === 'demo' ? '데모 사이즈표' : '내 사이즈표'),
    fitResult.category,
    stretchLabel ? `신축 ${stretchLabel}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <main className="mf-page-enter" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--myfit-bg)', minHeight: '100dvh', color: 'var(--myfit-text)' }}>
      {/* 헤더 */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(16px + var(--safe-top)) 20px 8px' }}>
        <button onClick={() => router.push('/')} aria-label="홈으로 돌아가기" style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--myfit-surface2)', border: '1px solid var(--myfit-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--myfit-text-sub)' }}>
          {IconArrowLeft}
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--myfit-text)' }}>핏 예측 결과</span>
          <div style={{ fontSize: 11, color: 'var(--myfit-text-muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{headerSub}</div>
        </div>
      </header>

      <div className="scroll-area" style={{ flex: 1, padding: '8px 20px calc(32px + var(--safe-bottom))', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* 내 치수 */}
        {bodyUsed && (
          <section style={{ background: isFallback ? 'var(--myfit-surface2)' : 'var(--myfit-primary-soft)', border: `1px solid ${isFallback ? 'var(--myfit-border)' : '#a5f0fc'}`, borderRadius: 'var(--myfit-radius)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }} aria-label="사용된 신체 치수">
            <span style={{ color: isFallback ? 'var(--myfit-text-muted)' : 'var(--myfit-primary)', flexShrink: 0 }}>{IconRuler}</span>
            <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '4px 16px', alignItems: 'center' }}>
              {[
                { label: '키', value: `${bodyUsed.height}cm` },
                { label: '가슴단면', value: `${bodyUsed.chestHalf}cm` },
                { label: '어깨', value: `${bodyUsed.shoulder}cm` },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 11, color: 'var(--myfit-text-sub)' }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: isFallback ? 'var(--myfit-text)' : 'var(--myfit-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
                </div>
              ))}
            </div>
            {isFallback && <span style={{ fontSize: 11, color: 'var(--myfit-text-muted)', whiteSpace: 'nowrap' }}>데모 치수</span>}
          </section>
        )}

        {/* 추천 요약 */}
        {recommendedSize && (
          <section style={{ background: 'var(--myfit-ink)', borderRadius: 'var(--myfit-radius)', padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} aria-label={`추천 사이즈: ${recommendedSize}`}>
            <div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>이 옷, 나에게 딱 맞는 사이즈</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: '-1px', lineHeight: 1 }}>{recommendedSize}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>가슴 여유분 기준 최적 사이즈</div>
            </div>
            <span className="badge" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 13, padding: '6px 14px' }}>추천</span>
          </section>
        )}

        {/* 신체 시각화 (아바타 / 내 사진) */}
        <section className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }} aria-label="신체 시각화">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--myfit-text-sub)' }}>
              {showPhoto ? '내 사진' : '내 몸 · 선택 사이즈 핏'}
            </span>
            {photoB64 && (
              <button
                onClick={() => setShowPhoto((v) => !v)}
                aria-pressed={showPhoto}
                aria-label={showPhoto ? '실루엣으로 보기' : '내 사진과 비교'}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 34, height: 34, padding: '0 12px', borderRadius: 999, background: showPhoto ? 'var(--myfit-primary-soft)' : 'var(--myfit-surface2)', border: `1px solid ${showPhoto ? 'var(--myfit-primary)' : 'var(--myfit-border)'}`, color: showPhoto ? 'var(--myfit-primary)' : 'var(--myfit-text-sub)', fontSize: 12, fontWeight: 600 }}
              >
                <span>{showPhoto ? IconUserSilhouette : IconCamera}</span>
                {showPhoto ? '실루엣 보기' : '내 사진과 비교'}
              </button>
            )}
          </div>

          {showPhoto && photoB64 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <img
                src={`data:image/jpeg;base64,${photoB64}`}
                alt="내 신체 사진 (이 기기에만 저장, 온디바이스 표시)"
                style={{ maxWidth: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 12, border: '1px solid var(--myfit-border)' }}
              />
              <div style={{ fontSize: 11, color: 'var(--myfit-text-muted)', textAlign: 'center' }}>
                사진은 이 기기에만 저장됩니다 · 서버 전송 없음 · 7일 후 자동 삭제
              </div>
            </div>
          ) : (
            <div key={selectedFit.size}>
              <BodyAvatar
                measurements={avatarMeasure}
                chest={chestInfo}
                shoulder={shoulderInfo}
                shoulderExcluded={shoulderExcluded}
                sizeName={selectedFit.size}
                width={180}
              />
            </div>
          )}
        </section>

        {/* 게이지 범례 */}
        <section aria-label="핏 범례" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--myfit-text-muted)', marginRight: 2 }}>핏 기준:</span>
          {[
            { tone: 'tight' as const, label: '타이트' },
            { tone: 'standard' as const, label: '스탠다드' },
            { tone: 'oversized' as const, label: '오버' },
          ].map(({ tone, label }) => (
            <span key={tone} className={`fit-tag fit-tag--${tone}`}>{label}</span>
          ))}
        </section>

        {/* 사이즈 비교 (사이즈 탭 → 아바타 오버레이 + 게이지 즉시 갱신) */}
        <section aria-label="사이즈별 핏 비교">
          <div style={{ fontSize: 12, color: 'var(--myfit-text-muted)', marginBottom: 10, fontWeight: 600 }}>사이즈를 눌러 부위별 핏을 비교하세요</div>
          <div role="tablist" aria-label="사이즈 선택" style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {fitResult.sizes.map((sf) => {
              const isSel = sf.size === selectedFit.size;
              const isRec = sf.size === recommendedSize;
              return (
                <button
                  key={sf.size}
                  role="tab"
                  aria-selected={isSel}
                  onClick={() => setSelectedSize(sf.size)}
                  aria-label={`사이즈 ${sf.size}${isRec ? ' (추천)' : ''} 핏 보기`}
                  style={{ flex: '1 1 0', minWidth: 56, height: 52, borderRadius: 10, background: isSel ? 'var(--myfit-ink)' : 'var(--myfit-surface2)', border: `1.5px solid ${isSel ? 'var(--myfit-ink)' : isRec ? 'var(--myfit-primary)' : 'var(--myfit-border)'}`, color: isSel ? '#fff' : 'var(--myfit-text)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, transition: 'background 0.2s, border-color 0.2s, color 0.2s' }}
                >
                  <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.5px' }}>{sf.size}</span>
                  {isRec && <span style={{ fontSize: 9, fontWeight: 700, color: isSel ? 'rgba(255,255,255,0.85)' : 'var(--myfit-primary)' }}>추천</span>}
                </button>
              );
            })}
          </div>
          <div key={selectedFit.size} className="mf-step">
            <SizeCard sizeFit={selectedFit} isRecommended={selectedFit.size === recommendedSize} />
          </div>
        </section>

        {/* 신축 안내 (참고 표기 — 판정 미반영) */}
        {stretchLabel && stretchLabel !== '없음' && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', background: 'var(--myfit-surface2)', border: '1px solid var(--myfit-border)', borderRadius: 'var(--myfit-radius-sm)', fontSize: 12, color: 'var(--myfit-text-sub)' }} role="note" aria-label="신축성 참고">
            <span style={{ color: 'var(--myfit-text-muted)', flexShrink: 0, marginTop: 1 }}>{IconInfo}</span>
            <span>원단 신축성({stretchLabel}) 참고. 판정은 실측 기준이며, 실제 핏은 착용 후 다를 수 있습니다.</span>
          </div>
        )}

        {/* 상품 아웃링크 (URL 입력 시) */}
        {isHttpUrl(productUrl) && (
          <a
            href={productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-cta"
            style={{ textDecoration: 'none', gap: 8 }}
            aria-label="이 상품 페이지 새 탭으로 보러 가기"
          >
            <span>{IconExternal}</span> 이 상품 보러 가기
          </a>
        )}

        {/* 하단 액션 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
          <button className="btn-primary" onClick={() => router.push('/fit/check')}>다른 옷 핏 예측하기</button>
          <button className="btn-secondary" onClick={() => router.push('/profile')}>내 치수 수정하기</button>
        </div>

        {/* 쿠팡파트너스 고지 (제휴 링크 고지 유지) */}
        {isHttpUrl(productUrl) && (
          <div style={{ fontSize: 11, color: 'var(--myfit-text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
            제휴 링크가 포함될 수 있으며, 구매 시 수수료가 발생할 수 있습니다. 사용자 추가 비용 없음.
          </div>
        )}
      </div>
    </main>
  );
}
