'use client';

/**
 * /fit/result — FitEngine 핏 예측 결과 화면 (MyFit P3)
 *
 * - FitEngine(P2)을 import해 사이즈별·부위별 핏을 시각화
 * - 데모 상수: 무신사 나시 M/L/XL/XXL (category:'sleeveless', stretch:'약간 있음')
 * - 사용자 치수 없으면 회장 케이스 fallback (height176/chestHalf58/shoulder56)
 * - globals.css 토큰/클래스만 사용 (.fit-gauge, .fit-tag--*, .badge, .card)
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fitEngine, type FitResult, type SizeFit, type PartFit } from '@/lib/fitEngine';
import { loadMeasurements } from '@/lib/storage';

// ─────────────────────────────────────────────────────────────
// 데모 데이터 (무신사 나시 — 작업지시서 상수)
// ─────────────────────────────────────────────────────────────
const DEMO_CHART = {
  category: 'sleeveless',
  unit: 'cm' as const,
  measureKeys: ['총장', '가슴단면', '어깨너비'],
  sizes: [
    { size: 'M',   총장: 70.5, 가슴단면: 53.5, 어깨너비: 43.5 },
    { size: 'L',   총장: 72,   가슴단면: 56,   어깨너비: 45   },
    { size: 'XL',  총장: 73.5, 가슴단면: 58.5, 어깨너비: 46.5 },
    { size: 'XXL', 총장: 75,   가슴단면: 61,   어깨너비: 48   },
  ],
  stretch: '약간 있음',
};

// 회장 케이스 fallback
const FALLBACK_BODY = { height: 176, chestHalf: 58, shoulder: 56 };

// ─────────────────────────────────────────────────────────────
// 아이콘 (SVG, Lucide 스타일 — 이모지 금지)
// ─────────────────────────────────────────────────────────────
const IconArrowLeft = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5M12 19l-7-7 7-7"/>
  </svg>
);

const IconRuler = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21.3 8.7 8.7 21.3a2.4 2.4 0 0 1-3.4 0l-2.6-2.6a2.4 2.4 0 0 1 0-3.4L15.3 2.7a2.4 2.4 0 0 1 3.4 0l2.6 2.6a2.4 2.4 0 0 1 0 3.4Z"/>
    <path d="m7.5 10.5 2 2M11 7l2 2M14.5 3.5l2 2"/>
  </svg>
);

const IconInfo = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 16v-4M12 8h.01"/>
  </svg>
);

const IconStar = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────
// 게이지 퍼센트 계산 (FitLevel → 0~100%)
// ─────────────────────────────────────────────────────────────
function levelToPercent(level: string): number {
  const map: Record<string, number> = {
    impossible: 5,
    tight: 18,
    bodyfit: 38,
    standard: 58,
    semiover: 78,
    oversized: 95,
  };
  return map[level] ?? 50;
}

// 게이지 fill 색상 (tone별)
function gaugeColor(tone: string): string {
  if (tone === 'tight') return 'var(--myfit-fit-tight)';
  if (tone === 'oversized') return 'var(--myfit-fit-oversized)';
  return 'var(--myfit-fit-standard)';
}

// ─────────────────────────────────────────────────────────────
// 부위 라벨 매핑
// ─────────────────────────────────────────────────────────────
const PART_LABEL: Record<string, string> = {
  가슴단면: '가슴',
  어깨너비: '어깨',
  총장: '총장',
};

// ─────────────────────────────────────────────────────────────
// 부위별 게이지 컴포넌트
// ─────────────────────────────────────────────────────────────
function PartGauge({ part }: { part: PartFit }) {
  const pct = levelToPercent(part.level);
  const color = gaugeColor(part.tone);
  const label = PART_LABEL[part.measureKey] || part.measureKey;

  // 총장은 게이지 없이 치수 정보만 표시
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

  // 어깨 — 민소매 제외 표기
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
        <div
          className="fit-gauge-track"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label} 핏 위치`}
        >
          <div
            className="fit-gauge-fill"
            style={{ width: `${pct}%`, background: color }}
          />
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
    : primaryTone === 'tight'
      ? 'var(--myfit-fit-tight)'
      : primaryTone === 'oversized'
        ? 'var(--myfit-fit-oversized)'
        : 'var(--myfit-border)';

  const bgColor = isRecommended ? 'var(--myfit-primary-soft)' : 'var(--myfit-surface)';

  return (
    <article
      className="card"
      style={{
        background: bgColor,
        border: `1.5px solid ${borderColor}`,
        padding: '16px',
        position: 'relative',
        transition: 'border-color 0.2s',
      }}
      aria-label={`사이즈 ${sizeFit.size}${isRecommended ? ' (추천)' : ''}`}
    >
      {/* 사이즈 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 22,
            fontWeight: 800,
            color: isRecommended ? 'var(--myfit-primary)' : 'var(--myfit-text)',
            letterSpacing: '-0.5px',
          }}>
            {sizeFit.size}
          </span>
          <span
            className={`fit-tag fit-tag--${sizeFit.primary.tone}`}
            aria-label={`대표 핏: ${sizeFit.primary.label}`}
          >
            {sizeFit.primary.label}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isRecommended && (
            <span
              className="badge"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              aria-label="추천 사이즈"
            >
              <span aria-hidden="true">{IconStar}</span>
              추천
            </span>
          )}
        </div>
      </div>

      {/* 부위별 게이지 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sizeFit.parts.map((part) => (
          <PartGauge key={part.measureKey} part={part} />
        ))}
      </div>

      {/* 핏 적합도 점수 (보조) */}
      <div style={{
        marginTop: 12,
        paddingTop: 10,
        borderTop: '1px solid var(--myfit-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 11, color: 'var(--myfit-text-muted)' }}>핏 적합도</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 80,
            height: 4,
            borderRadius: 2,
            background: 'var(--myfit-border)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${sizeFit.score}%`,
              background: isRecommended ? 'var(--myfit-primary)' : 'var(--myfit-fit-standard)',
              borderRadius: 2,
              transition: 'width 0.6s ease',
            }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: isRecommended ? 'var(--myfit-primary)' : 'var(--myfit-text-sub)', fontVariantNumeric: 'tabular-nums' }}>
            {sizeFit.score}
          </span>
        </div>
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────────────────────
export default function FitResultPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [fitResult, setFitResult] = useState<FitResult | null>(null);
  const [bodyUsed, setBodyUsed] = useState<{ height: number; chestHalf: number; shoulder: number } | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string>(''); // 인터랙티브 사이즈 비교 선택

  useEffect(() => {
    setMounted(true);

    // 사용자 치수 로드 → FitEngine 실행
    const m = loadMeasurements();
    let body: typeof FALLBACK_BODY;

    if (m && m.chest && m.shoulder && m.height) {
      // chest는 가슴둘레(전체), FitEngine은 단면(절반)을 원함
      body = {
        height: m.height,
        chestHalf: m.chest / 2,
        shoulder: m.shoulder,
      };
      setIsFallback(false);
    } else {
      body = FALLBACK_BODY;
      setIsFallback(true);
    }

    setBodyUsed(body);

    // 회장 P2 검증 케이스 재현: stretchFromChart 없이 판정
    // (XL=바디핏/XXL=스탠다드/추천=XXL 일치 조건)
    const result = fitEngine.predict(DEMO_CHART, body);
    setFitResult(result);
    // 인터랙티브 비교 기본 선택 = 추천 사이즈
    setSelectedSize(result.recommended || result.sizes[0]?.size || '');
  }, []);

  // 로딩 상태
  if (!mounted || !fitResult) {
    return (
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--myfit-bg)',
          minHeight: '100dvh',
        }}
        aria-busy="true"
        aria-label="핏 예측 결과 로딩 중"
      >
        <div className="spinner" />
      </main>
    );
  }

  // 에러 상태 (sizes 없음)
  if (!fitResult.sizes || fitResult.sizes.length === 0) {
    return (
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          background: 'var(--myfit-bg)',
          minHeight: '100dvh',
          padding: '0 24px',
        }}
        role="alert"
      >
        <div style={{ fontSize: 15, color: 'var(--myfit-text-sub)', textAlign: 'center' }}>
          핏 예측 결과를 가져올 수 없습니다.
        </div>
        <button className="btn-secondary" onClick={() => router.push('/fit')} style={{ width: 'auto', padding: '0 24px' }}>
          다시 시도
        </button>
      </main>
    );
  }

  const recommendedSize = fitResult.recommended;
  const selectedFit =
    fitResult.sizes.find((s) => s.size === selectedSize) ||
    fitResult.sizes.find((s) => s.size === recommendedSize) ||
    fitResult.sizes[0];

  return (
    <main
      className="mf-page-enter"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--myfit-bg)',
        minHeight: '100dvh',
        color: 'var(--myfit-text)',
      }}
    >
      {/* 헤더 */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px 8px' }}>
        <button
          onClick={() => router.push('/')}
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'var(--myfit-surface2)', border: '1px solid var(--myfit-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--myfit-text-sub)',
          }}
          aria-label="홈으로 돌아가기"
        >
          {IconArrowLeft}
        </button>
        <div>
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--myfit-text)' }}>핏 예측 결과</span>
          <div style={{ fontSize: 11, color: 'var(--myfit-text-muted)', marginTop: 1 }}>
            무신사 나시 · {DEMO_CHART.category} · 신축 {DEMO_CHART.stretch}
          </div>
        </div>
      </header>

      <div
        className="scroll-area"
        style={{
          flex: 1,
          padding: '8px 20px calc(32px + var(--safe-bottom))',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* 내 치수 (사용한 바디) */}
        {bodyUsed && (
          <section
            style={{
              background: isFallback ? 'var(--myfit-surface2)' : 'var(--myfit-primary-soft)',
              border: `1px solid ${isFallback ? 'var(--myfit-border)' : '#a5f0fc'}`,
              borderRadius: 'var(--myfit-radius)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
            aria-label="사용된 신체 치수"
          >
            <span style={{ color: isFallback ? 'var(--myfit-text-muted)' : 'var(--myfit-primary)', flexShrink: 0 }}>
              {IconRuler}
            </span>
            <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '4px 16px', alignItems: 'center' }}>
              {[
                { label: '키', value: `${bodyUsed.height}cm` },
                { label: '가슴단면', value: `${bodyUsed.chestHalf}cm` },
                { label: '어깨', value: `${bodyUsed.shoulder}cm` },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 11, color: 'var(--myfit-text-sub)' }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: isFallback ? 'var(--myfit-text)' : 'var(--myfit-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
            {isFallback && (
              <span style={{ fontSize: 11, color: 'var(--myfit-text-muted)', whiteSpace: 'nowrap' }}>
                데모 치수
              </span>
            )}
          </section>
        )}

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

        {/* 추천 요약 */}
        {recommendedSize && (
          <section
            style={{
              background: 'var(--myfit-ink)',
              borderRadius: 'var(--myfit-radius)',
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
            aria-label={`추천 사이즈: ${recommendedSize}`}
          >
            <div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>
                이 옷, 나에게 딱 맞는 사이즈
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: '-1px', lineHeight: 1 }}>
                {recommendedSize}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                가슴 여유분 기준 최적 사이즈
              </div>
            </div>
            <span className="badge" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 13, padding: '6px 14px' }}>
              추천
            </span>
          </section>
        )}

        {/* 사이즈 비교 (TrueToForm식 인터랙티브 — 사이즈 탭 → 부위별 핏 즉시 갱신) */}
        <section aria-label="사이즈별 핏 비교">
          <div style={{ fontSize: 12, color: 'var(--myfit-text-muted)', marginBottom: 10, fontWeight: 600 }}>
            사이즈를 눌러 부위별 핏을 비교하세요
          </div>

          {/* 사이즈 트랙 */}
          <div role="tablist" aria-label="사이즈 선택" style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
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
                  style={{
                    flex: 1, minWidth: 0, height: 52, borderRadius: 10,
                    background: isSel ? 'var(--myfit-ink)' : 'var(--myfit-surface2)',
                    border: `1.5px solid ${isSel ? 'var(--myfit-ink)' : isRec ? 'var(--myfit-primary)' : 'var(--myfit-border)'}`,
                    color: isSel ? '#fff' : 'var(--myfit-text)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                    transition: 'background 0.2s, border-color 0.2s, color 0.2s',
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.5px' }}>{sf.size}</span>
                  {isRec && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: isSel ? 'rgba(255,255,255,0.85)' : 'var(--myfit-primary)' }}>추천</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 선택 사이즈 상세 (선택 변경 시 크로스페이드로 즉시 갱신) */}
          <div key={selectedFit.size} className="mf-step">
            <SizeCard sizeFit={selectedFit} isRecommended={selectedFit.size === recommendedSize} />
          </div>
        </section>

        {/* 신축 보정 안내 */}
        {fitResult.stretchApplied && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '10px 14px',
              background: 'var(--myfit-surface2)',
              border: '1px solid var(--myfit-border)',
              borderRadius: 'var(--myfit-radius-sm)',
              fontSize: 12,
              color: 'var(--myfit-text-sub)',
            }}
            role="note"
            aria-label="신축성 보정 안내"
          >
            <span style={{ color: 'var(--myfit-text-muted)', flexShrink: 0, marginTop: 1 }}>{IconInfo}</span>
            <span>
              원단 신축성({DEMO_CHART.stretch})이 적용된 판정입니다.
              실제 핏은 착용 후 다를 수 있습니다.
            </span>
          </div>
        )}

        {/* 빈 상태 방어 (사이즈 0개) — 이미 상단에서 처리되나 방어적으로 유지 */}

        {/* 하단 액션 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
          <button
            className="btn-primary"
            onClick={() => router.push('/fit')}
          >
            다른 옷 핏 예측하기
          </button>
          <button
            className="btn-secondary"
            onClick={() => router.push('/profile')}
          >
            내 치수 수정하기
          </button>
        </div>
      </div>
    </main>
  );
}
