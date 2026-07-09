'use client';

/**
 * /fit/check — 핏 체크 시작 화면 (MyFit P7 ★keystone)
 *
 * 회장 비전: "브랜드가 제공하는 의류 수치 사이즈를 토대로 그 사이즈가 나에게 어떤 핏인지."
 *   ① 내 치수 요약(없으면 profile 유도)
 *   ② 사이즈표 입력 — 붙여넣기 자동 파싱 / 직접 입력 그리드
 *   ③ 카테고리·신축성 선택  ④ 상품 URL/상품명(선택)
 *   → 활성 사이즈표 저장 → /fit/result
 *
 * 기존 페이지 패턴 준수: 인라인 style + --myfit-* 토큰, mounted 가드, SVG 아이콘(이모지 금지), aria.
 */

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { loadMeasurements, saveActiveFitInput, type Measurements } from '@/lib/storage';
import { parseSizeChart } from '@/lib/sizeChartParser';
import type { GarmentSizeChart, GarmentSizeRow } from '@/lib/fitEngine';

/* ── 아이콘 (SVG, Lucide 스타일 — 이모지 금지) ── */
const IconArrowLeft = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);
const IconRuler = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21.3 8.7 8.7 21.3a2.4 2.4 0 0 1-3.4 0l-2.6-2.6a2.4 2.4 0 0 1 0-3.4L15.3 2.7a2.4 2.4 0 0 1 3.4 0l2.6 2.6a2.4 2.4 0 0 1 0 3.4Z" />
    <path d="m7.5 10.5 2 2M11 7l2 2M14.5 3.5l2 2" />
  </svg>
);
const IconClipboard = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>
);
const IconGrid = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
  </svg>
);
const IconPlus = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconX = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const IconAlert = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);
const IconCheck2 = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'tops', label: '반팔·긴팔 티셔츠' },
  { value: 'shirt', label: '셔츠·블라우스' },
  { value: 'knit', label: '니트·스웨터' },
  { value: 'outer', label: '아우터·재킷' },
  { value: 'sleeveless', label: '민소매·나시' },
];
const STRETCH_OPTS = ['없음', '거의 없음', '보통', '약간 있음', '있음'];

const PASTE_EXAMPLE = `총장\t가슴단면\t어깨너비
M\t70.5\t53.5\t43.5
L\t72\t56\t45
XL\t73.5\t58.5\t46.5`;

interface ManualGrid {
  sizes: string[];
  measures: string[];
  cells: string[][]; // cells[measureIdx][sizeIdx]
}

const DEFAULT_GRID: ManualGrid = {
  sizes: ['M', 'L', 'XL'],
  measures: ['총장', '가슴단면', '어깨너비'],
  cells: [
    ['', '', ''],
    ['', '', ''],
    ['', '', ''],
  ],
};

export default function FitCheckPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [measurements, setMeasurements] = useState<Measurements | null>(null);

  const [mode, setMode] = useState<'paste' | 'manual'>('paste');
  const [pasteText, setPasteText] = useState('');
  const [category, setCategory] = useState('tops');
  const [stretch, setStretch] = useState('없음');
  const [productName, setProductName] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [grid, setGrid] = useState<ManualGrid>(DEFAULT_GRID);

  useEffect(() => {
    setMounted(true);
    setMeasurements(loadMeasurements());
  }, []);

  const stretchVal = stretch === '없음' ? '없음' : stretch;

  // ── 붙여넣기 파싱 (실시간 미리보기) ──
  const parsed = useMemo(
    () => parseSizeChart(pasteText, category, stretchVal),
    [pasteText, category, stretchVal],
  );

  // ── 직접 입력 그리드 → 차트 ──
  const buildManualChart = (): GarmentSizeChart => {
    const measureKeys = grid.measures.map((m) => m.trim()).filter(Boolean);
    const seen = new Set<string>();
    const uniqueKeys = measureKeys.filter((k) => (seen.has(k) ? false : (seen.add(k), true)));
    const sizes: GarmentSizeRow[] = grid.sizes
      .map((s, si) => {
        const size = s.trim();
        if (!size) return null;
        const row: GarmentSizeRow = { size };
        grid.measures.forEach((m, mi) => {
          const key = m.trim();
          if (!key) return;
          const v = parseFloat((grid.cells[mi]?.[si] ?? '').replace(',', '.'));
          row[key] = Number.isFinite(v) ? v : null;
        });
        return row;
      })
      .filter((r): r is GarmentSizeRow => r !== null);
    return { category, unit: 'cm', measureKeys: uniqueKeys, sizes, stretch: stretchVal };
  };

  const manualHasData =
    grid.sizes.some((s) => s.trim()) &&
    grid.measures.some((m) => m.trim()) &&
    grid.cells.some((row) => row.some((c) => c.trim() && Number.isFinite(parseFloat(c))));

  const canSubmit = !!measurements && (mode === 'paste' ? parsed.ok : manualHasData);

  const handleSubmit = () => {
    if (!canSubmit) return;
    const chart = mode === 'paste' ? parsed.chart : buildManualChart();
    if (!chart) return;
    saveActiveFitInput(chart, {
      category,
      stretch: stretchVal,
      productUrl,
      productName,
    });
    router.push('/fit/result');
  };

  // ── 그리드 편집 헬퍼 ──
  const addSize = () =>
    setGrid((g) => ({ ...g, sizes: [...g.sizes, ''], cells: g.cells.map((r) => [...r, '']) }));
  const removeSize = (si: number) =>
    setGrid((g) => ({
      ...g,
      sizes: g.sizes.filter((_, i) => i !== si),
      cells: g.cells.map((r) => r.filter((_, i) => i !== si)),
    }));
  const addMeasure = () =>
    setGrid((g) => ({ ...g, measures: [...g.measures, ''], cells: [...g.cells, g.sizes.map(() => '')] }));
  const removeMeasure = (mi: number) =>
    setGrid((g) => ({
      ...g,
      measures: g.measures.filter((_, i) => i !== mi),
      cells: g.cells.filter((_, i) => i !== mi),
    }));
  const setSizeName = (si: number, val: string) =>
    setGrid((g) => ({ ...g, sizes: g.sizes.map((s, i) => (i === si ? val : s)) }));
  const setMeasureName = (mi: number, val: string) =>
    setGrid((g) => ({ ...g, measures: g.measures.map((m, i) => (i === mi ? val : m)) }));
  const setCell = (mi: number, si: number, val: string) =>
    setGrid((g) => ({
      ...g,
      cells: g.cells.map((r, i) => (i === mi ? r.map((c, j) => (j === si ? val : c)) : r)),
    }));

  if (!mounted) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--myfit-bg)', minHeight: '100dvh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <main className="mf-page-enter" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--myfit-bg)', minHeight: '100dvh', color: 'var(--myfit-text)' }}>
      {/* 헤더 */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(16px + var(--safe-top)) 20px 8px' }}>
        <button
          onClick={() => router.push('/')}
          aria-label="홈으로 돌아가기"
          style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--myfit-surface2)', border: '1px solid var(--myfit-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--myfit-text-sub)' }}
        >
          {IconArrowLeft}
        </button>
        <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--myfit-text)' }}>핏 확인하기</span>
      </header>

      <div className="scroll-area" style={{ flex: 1, padding: '8px 20px calc(24px + var(--safe-bottom))', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ① 내 치수 요약 */}
        {measurements ? (
          <section style={{ background: 'var(--myfit-primary-soft)', border: '1px solid #a5f0fc', borderRadius: 'var(--myfit-radius)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }} aria-label="내 치수 요약">
            <span style={{ color: 'var(--myfit-primary)', flexShrink: 0 }}>{IconRuler}</span>
            <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
              {[
                { label: '키', value: `${measurements.height}cm` },
                { label: '가슴둘레', value: `${measurements.chest}cm` },
                { label: '어깨', value: `${measurements.shoulder}cm` },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 11, color: 'var(--myfit-text-sub)' }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--myfit-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
                </div>
              ))}
            </div>
            <button onClick={() => router.push('/profile')} style={{ flexShrink: 0, fontSize: 12, color: 'var(--myfit-primary)', fontWeight: 700, minHeight: 0, whiteSpace: 'nowrap' }} aria-label="치수 수정">
              수정
            </button>
          </section>
        ) : (
          <button
            onClick={() => router.push('/profile')}
            aria-label="치수 입력하러 가기"
            style={{ width: '100%', textAlign: 'left', background: 'var(--myfit-surface2)', border: '1px dashed var(--myfit-border-strong)', borderRadius: 'var(--myfit-radius)', padding: '16px', display: 'flex', alignItems: 'center', gap: 12, minHeight: 0 }}
          >
            <span style={{ flexShrink: 0, color: 'var(--myfit-primary)' }}>{IconRuler}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--myfit-text)' }}>먼저 내 치수를 입력하세요</div>
              <div style={{ fontSize: 12, color: 'var(--myfit-text-sub)', marginTop: 2 }}>핏 예측에는 내 신체 치수가 필요해요</div>
            </div>
            <span style={{ fontSize: 13, color: 'var(--myfit-primary)', fontWeight: 700 }}>입력 →</span>
          </button>
        )}

        {/* ② 사이즈표 입력 */}
        <section>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--myfit-text)', marginBottom: 4 }}>이 옷의 실측 사이즈표</div>
          <div style={{ fontSize: 12, color: 'var(--myfit-text-sub)', marginBottom: 12, lineHeight: 1.5 }}>
            상품 페이지의 실측 사이즈표를 복사해 붙여넣거나 직접 입력하세요.
          </div>

          {/* 입력 모드 탭 */}
          <div role="tablist" aria-label="사이즈표 입력 방식" style={{ display: 'flex', background: 'var(--myfit-surface2)', borderRadius: 10, padding: 4, gap: 4, border: '1px solid var(--myfit-border)', marginBottom: 14 }}>
            {([
              { key: 'paste' as const, label: '붙여넣기', icon: IconClipboard },
              { key: 'manual' as const, label: '직접 입력', icon: IconGrid },
            ]).map((t) => {
              const active = mode === t.key;
              return (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMode(t.key)}
                  style={{
                    flex: 1, height: 40, borderRadius: 8,
                    background: active ? 'var(--myfit-surface)' : 'transparent',
                    border: active ? '1px solid var(--myfit-border-strong)' : '1px solid transparent',
                    fontSize: 14, fontWeight: active ? 700 : 400,
                    color: active ? 'var(--myfit-text)' : 'var(--myfit-text-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <span>{t.icon}</span> {t.label}
                </button>
              );
            })}
          </div>

          {/* 붙여넣기 모드 */}
          {mode === 'paste' && (
            <div>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={`실측 사이즈표를 붙여넣으세요.\n예)\n${PASTE_EXAMPLE}`}
                aria-label="사이즈표 붙여넣기"
                rows={6}
                style={{
                  width: '100%', minHeight: 130, resize: 'vertical',
                  background: 'var(--myfit-surface2)', border: '1px solid var(--myfit-border)',
                  borderRadius: 10, padding: '12px 14px', fontSize: 14, lineHeight: 1.6,
                  color: 'var(--myfit-text)', fontFamily: 'inherit',
                }}
              />

              {/* 파싱 미리보기 / 안내 */}
              {pasteText.trim() && (
                parsed.ok && parsed.chart ? (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--myfit-success)', marginBottom: 8 }}>
                      <span>{IconCheck2}</span> 사이즈 {parsed.chart.sizes.length}개 · 측정항목 {parsed.chart.measureKeys.length}개 인식됨
                    </div>
                    <ParsedPreview chart={parsed.chart} />
                  </div>
                ) : (
                  <div role="alert" style={{ marginTop: 12, display: 'flex', alignItems: 'flex-start', gap: 8, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: 'var(--myfit-warn)', lineHeight: 1.5 }}>
                    <span style={{ flexShrink: 0, marginTop: 1 }}>{IconAlert}</span>
                    <span>{parsed.error || '표를 인식하지 못했습니다.'} 사이즈(S·M·L)와 측정항목(총장·가슴단면·어깨너비)이 함께 있는지 확인하거나, 직접 입력을 이용하세요.</span>
                  </div>
                )
              )}
            </div>
          )}

          {/* 직접 입력 모드 */}
          {mode === 'manual' && (
            <div>
              <div style={{ overflowX: 'auto', border: '1px solid var(--myfit-border)', borderRadius: 10, background: 'var(--myfit-surface)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: `104px repeat(${grid.sizes.length}, 68px) 36px`, minWidth: 'min-content' }}>
                  {/* 헤더 행: 코너 + 사이즈명 입력 + 여백 */}
                  <div style={{ padding: 8, fontSize: 11, color: 'var(--myfit-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--myfit-border)', display: 'flex', alignItems: 'center' }}>측정 \ 사이즈</div>
                  {grid.sizes.map((s, si) => (
                    <div key={si} style={{ padding: 4, borderBottom: '1px solid var(--myfit-border)', borderLeft: '1px solid var(--myfit-border)', position: 'relative' }}>
                      <input
                        value={s}
                        onChange={(e) => setSizeName(si, e.target.value)}
                        aria-label={`${si + 1}번째 사이즈명`}
                        style={{ width: '100%', height: 34, textAlign: 'center', fontSize: 13, fontWeight: 700, padding: '0 2px', border: '1px solid transparent', background: 'transparent', color: 'var(--myfit-text)' }}
                      />
                      {grid.sizes.length > 1 && (
                        <button onClick={() => removeSize(si)} aria-label={`${s || si + 1} 사이즈 열 삭제`} style={{ position: 'absolute', top: -2, right: -2, width: 18, height: 18, minWidth: 0, minHeight: 0, borderRadius: '50%', background: 'var(--myfit-surface2)', border: '1px solid var(--myfit-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--myfit-text-muted)' }}>
                          <span style={{ transform: 'scale(0.7)' }}>{IconX}</span>
                        </button>
                      )}
                    </div>
                  ))}
                  <div style={{ borderBottom: '1px solid var(--myfit-border)', borderLeft: '1px solid var(--myfit-border)' }} />

                  {/* 측정 행들 */}
                  {grid.measures.map((m, mi) => (
                    <MeasureRow
                      key={mi}
                      measureName={m}
                      values={grid.cells[mi] ?? []}
                      onName={(v) => setMeasureName(mi, v)}
                      onCell={(si, v) => setCell(mi, si, v)}
                      onRemove={grid.measures.length > 1 ? () => removeMeasure(mi) : undefined}
                    />
                  ))}
                </div>
              </div>

              {/* 행/열 추가 */}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={addMeasure} style={{ flex: 1, height: 40, borderRadius: 8, background: 'var(--myfit-surface2)', border: '1px solid var(--myfit-border)', fontSize: 13, fontWeight: 600, color: 'var(--myfit-text-sub)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <span>{IconPlus}</span> 측정항목 추가
                </button>
                <button onClick={addSize} style={{ flex: 1, height: 40, borderRadius: 8, background: 'var(--myfit-surface2)', border: '1px solid var(--myfit-border)', fontSize: 13, fontWeight: 600, color: 'var(--myfit-text-sub)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <span>{IconPlus}</span> 사이즈 추가
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--myfit-text-muted)', marginTop: 8, lineHeight: 1.5 }}>
                핏 예측은 가슴단면·어깨너비를 사용합니다. 정확한 판정을 위해 최소 가슴단면을 입력하세요.
              </div>
            </div>
          )}
        </section>

        {/* ③ 카테고리 */}
        <section>
          <div style={{ fontSize: 12, color: 'var(--myfit-text-sub)', fontWeight: 600, marginBottom: 8 }}>카테고리</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CATEGORIES.map((c) => {
              const active = category === c.value;
              return (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  aria-pressed={active}
                  style={{
                    height: 40, padding: '0 14px', borderRadius: 999, fontSize: 13, fontWeight: active ? 700 : 500,
                    background: active ? 'var(--myfit-primary-soft)' : 'var(--myfit-surface2)',
                    border: `1px solid ${active ? 'var(--myfit-primary)' : 'var(--myfit-border)'}`,
                    color: active ? 'var(--myfit-primary)' : 'var(--myfit-text-sub)', minHeight: 40,
                  }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          {category === 'sleeveless' && (
            <div style={{ fontSize: 11, color: 'var(--myfit-text-muted)', marginTop: 8 }}>
              민소매·나시는 어깨너비 비교를 제외합니다(측정 기준이 달라 오판정 방지).
            </div>
          )}
        </section>

        {/* ③ 신축성 */}
        <section>
          <div style={{ fontSize: 12, color: 'var(--myfit-text-sub)', fontWeight: 600, marginBottom: 8 }}>원단 신축성 (참고)</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STRETCH_OPTS.map((s) => {
              const active = stretch === s;
              return (
                <button
                  key={s}
                  onClick={() => setStretch(s)}
                  aria-pressed={active}
                  style={{
                    height: 38, padding: '0 12px', borderRadius: 999, fontSize: 12.5, fontWeight: active ? 700 : 500,
                    background: active ? 'var(--myfit-ink)' : 'var(--myfit-surface2)',
                    border: `1px solid ${active ? 'var(--myfit-ink)' : 'var(--myfit-border)'}`,
                    color: active ? '#fff' : 'var(--myfit-text-sub)', minHeight: 38,
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </section>

        {/* ④ 상품 정보 (선택) */}
        <section>
          <div style={{ fontSize: 12, color: 'var(--myfit-text-sub)', fontWeight: 600, marginBottom: 8 }}>상품 정보 (선택)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="상품명 (예: 오버핏 반팔티)"
              aria-label="상품명"
              style={{ height: 48 }}
            />
            <input
              type="url"
              inputMode="url"
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              placeholder="상품 URL (https://...)"
              aria-label="상품 URL"
              style={{ height: 48 }}
            />
          </div>
        </section>

        {/* 제출 */}
        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={!canSubmit}
          aria-disabled={!canSubmit}
        >
          핏 확인하기
        </button>
        {!measurements && (
          <div style={{ fontSize: 12, color: 'var(--myfit-text-muted)', textAlign: 'center' }}>
            내 치수를 입력해야 핏을 예측할 수 있어요.
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--myfit-text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
          붙여넣은 사이즈표는 이 기기에서 핏 계산에만 쓰이며 서버로 전송·저장하지 않습니다.
        </div>
      </div>
    </main>
  );
}

/* ── 파싱 미리보기 표 ── */
function ParsedPreview({ chart }: { chart: GarmentSizeChart }) {
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--myfit-border)', borderRadius: 10 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--myfit-surface2)' }}>
            <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--myfit-text-sub)', whiteSpace: 'nowrap' }}>사이즈</th>
            {chart.measureKeys.map((mk) => (
              <th key={mk} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--myfit-text-sub)', whiteSpace: 'nowrap' }}>{mk}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chart.sizes.map((row) => (
            <tr key={row.size} style={{ borderTop: '1px solid var(--myfit-border)' }}>
              <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--myfit-text)' }}>{row.size}</td>
              {chart.measureKeys.map((mk) => {
                const v = row[mk];
                return (
                  <td key={mk} style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--myfit-text-sub)', fontVariantNumeric: 'tabular-nums' }}>
                    {typeof v === 'number' ? v : '-'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── 직접 입력: 측정 행 ── */
function MeasureRow({
  measureName,
  values,
  onName,
  onCell,
  onRemove,
}: {
  measureName: string;
  values: string[];
  onName: (v: string) => void;
  onCell: (si: number, v: string) => void;
  onRemove?: () => void;
}) {
  return (
    <>
      <div style={{ padding: 4, borderTop: '1px solid var(--myfit-border)', display: 'flex', alignItems: 'center' }}>
        <input
          value={measureName}
          onChange={(e) => onName(e.target.value)}
          placeholder="측정항목"
          aria-label="측정항목명"
          style={{ width: '100%', height: 34, fontSize: 12.5, padding: '0 6px', border: '1px solid transparent', background: 'transparent', color: 'var(--myfit-text)' }}
        />
      </div>
      {values.map((c, si) => (
        <div key={si} style={{ padding: 4, borderTop: '1px solid var(--myfit-border)', borderLeft: '1px solid var(--myfit-border)' }}>
          <input
            value={c}
            onChange={(e) => onCell(si, e.target.value)}
            inputMode="decimal"
            placeholder="cm"
            aria-label={`${measureName || '측정'} ${si + 1}번째 값`}
            style={{ width: '100%', height: 34, textAlign: 'center', fontSize: 13, padding: '0 2px', border: '1px solid transparent', background: 'transparent', color: 'var(--myfit-text)', fontVariantNumeric: 'tabular-nums' }}
          />
        </div>
      ))}
      <div style={{ borderTop: '1px solid var(--myfit-border)', borderLeft: '1px solid var(--myfit-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {onRemove && (
          <button onClick={onRemove} aria-label={`${measureName || '측정항목'} 행 삭제`} style={{ width: 26, height: 26, minWidth: 0, minHeight: 0, borderRadius: 6, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--myfit-text-muted)' }}>
            {IconX}
          </button>
        )}
      </div>
    </>
  );
}
