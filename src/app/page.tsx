'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { loadMeasurements, loadFitHistory, seedDemoData, type FitHistoryItem } from '@/lib/storage';
import { DEMO_MODE } from '@/lib/tryon';

/* ── 아이콘 (SVG, Lucide 스타일 — 이모지 금지) ── */
const IconRuler = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21.3 8.7 8.7 21.3a2.4 2.4 0 0 1-3.4 0l-2.6-2.6a2.4 2.4 0 0 1 0-3.4L15.3 2.7a2.4 2.4 0 0 1 3.4 0l2.6 2.6a2.4 2.4 0 0 1 0 3.4Z"/>
    <path d="m7.5 10.5 2 2M11 7l2 2M14.5 3.5l2 2"/>
  </svg>
);
const IconGauge = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
  </svg>
);
const IconCheck = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);
const IconUser = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

const STEPS: { icon: ReactNode; title: string; desc: string }[] = [
  { icon: IconRuler, title: '내 치수 한 번 입력', desc: '무신사·나이키·자라 어디서든 자동 적용' },
  { icon: IconGauge, title: '사이즈별 핏 예측', desc: '이 옷이 오버핏인지 타이트인지 부위별로' },
  { icon: IconCheck, title: '구매 전 확인', desc: '반품 없이 딱 맞는 사이즈로 바로 구매' },
];

export default function HomePage() {
  const router = useRouter();
  const [hasMeasurements, setHasMeasurements] = useState(false);
  const [history, setHistory] = useState<FitHistoryItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // 데모 빌드: 첫 진입을 풍성하게 (실사용 데이터 있으면 덮어쓰지 않음)
    if (DEMO_MODE) {
      seedDemoData(process.env.NEXT_PUBLIC_BASE_PATH || '');
    }
    const m = loadMeasurements();
    setHasMeasurements(!!m);
    setHistory(loadFitHistory().slice(0, 3));
  }, []);

  const goToFit = () => router.push('/fit');
  const goToProfile = () => router.push('/profile');

  if (!mounted) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--myfit-bg)', minHeight: '100dvh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--myfit-bg)', minHeight: '100dvh', color: 'var(--myfit-text)' }}>
      {/* 헤더 */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'calc(16px + var(--safe-top)) 20px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--myfit-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 17, letterSpacing: '-0.5px' }}>M</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--myfit-text)', letterSpacing: '-0.5px' }}>MyFit</div>
            <div style={{ fontSize: 11, color: 'var(--myfit-text-muted)', marginTop: -2 }}>사기 전에 핏을 본다</div>
          </div>
        </div>
        <button onClick={goToProfile} aria-label="내 치수" style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--myfit-surface2)', border: '1px solid var(--myfit-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--myfit-text-sub)' }}>
          {IconUser}
        </button>
      </header>

      <div className="scroll-area" style={{ flex: 1, padding: '8px 20px calc(24px + var(--safe-bottom))', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* 히어로 */}
        <section style={{ background: 'var(--myfit-surface2)', border: '1px solid var(--myfit-border)', borderRadius: 'var(--myfit-radius-lg)', padding: '32px 24px', textAlign: 'center' }}>
          <span className="badge" style={{ marginBottom: 16 }}>반품 없는 쇼핑 · 사이즈 확신</span>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--myfit-text)', margin: '0 0 10px', lineHeight: 1.3, letterSpacing: '-0.02em' }}>
            사기 전에,<br />내 핏을 봅니다
          </h1>
          <p style={{ fontSize: 14, color: 'var(--myfit-text-sub)', margin: '0 0 24px', lineHeight: 1.6 }}>
            옷의 실측 사이즈 × 내 신체 치수로<br />이 옷이 나에게 어떤 핏인지 미리 확인하세요
          </p>
          <button className="btn-primary" onClick={goToFit}>내 핏 예측하기</button>
        </section>

        {/* 치수 미입력 배너 */}
        {!hasMeasurements && (
          <button onClick={goToProfile} style={{ width: '100%', textAlign: 'left', background: 'var(--myfit-primary-soft)', border: '1px solid #a5f0fc', borderRadius: 'var(--myfit-radius)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, minHeight: 0 }}>
            <span style={{ flexShrink: 0, display: 'flex', color: 'var(--myfit-primary)' }}>{IconRuler}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--myfit-primary)' }}>내 치수 한 번만 입력하면</div>
              <div style={{ fontSize: 12, color: 'var(--myfit-text-sub)', marginTop: 2 }}>모든 쇼핑몰에서 핏 예측이 자동 적용돼요</div>
            </div>
            <span style={{ fontSize: 13, color: 'var(--myfit-primary)', fontWeight: 700, whiteSpace: 'nowrap' }}>입력 →</span>
          </button>
        )}

        {/* 작동 방식 */}
        <section>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--myfit-text-sub)', marginBottom: 12 }}>이렇게 작동해요</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {STEPS.map((s, i) => (
              <div key={s.title} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--myfit-primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--myfit-primary)' }}>{s.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--myfit-text)' }}>{s.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--myfit-text-sub)', marginTop: 2 }}>{s.desc}</div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--myfit-text-muted)' }}>{i + 1}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 최근 핏 */}
        <section>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--myfit-text-sub)', marginBottom: 12 }}>최근 핏 예측</div>
          {history.length > 0 ? (
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
              {history.map((item) => (
                <div key={item.id} style={{ flexShrink: 0, width: 120, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--myfit-border)', background: 'var(--myfit-surface)', boxShadow: 'var(--myfit-shadow-sm)' }}>
                  <img
                    src={item.resultImageUrl}
                    alt={`${new Date(item.timestamp).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} 핏 결과`}
                    loading="lazy"
                    style={{ width: '100%', height: 160, objectFit: 'cover' }}
                  />
                  <div style={{ padding: '8px', fontSize: 11, color: 'var(--myfit-text-sub)', textAlign: 'center' }}>
                    {item.garmentName || new Date(item.timestamp).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <button type="button" onClick={goToFit} style={{ width: '100%', padding: '28px 16px', background: 'var(--myfit-surface2)', border: '1px dashed var(--myfit-border-strong)', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--myfit-text-muted)' }}>{IconGauge}</span>
              <span style={{ fontSize: 13, color: 'var(--myfit-text-sub)', fontWeight: 600 }}>아직 핏 예측 기록이 없어요</span>
              <span style={{ fontSize: 12, color: 'var(--myfit-primary)', fontWeight: 700 }}>첫 핏 예측 시작하기 →</span>
            </button>
          )}
        </section>

        {/* 쿠팡파트너스 고지 */}
        <div style={{ fontSize: 11, color: 'var(--myfit-text-muted)', textAlign: 'center', padding: '8px 0', borderTop: '1px solid var(--myfit-border)' }}>
          이 서비스는 쿠팡파트너스 활동의 일환으로 수수료를 받을 수 있습니다.
        </div>
      </div>
    </main>
  );
}
