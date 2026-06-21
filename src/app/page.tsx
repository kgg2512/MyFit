'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadMeasurements, loadFitHistory, seedDemoData, type FitHistoryItem } from '@/lib/storage';
import { DEMO_MODE } from '@/lib/tryon';

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

  const goToFit = () => {
    router.push('/fit');
  };

  const goToProfile = () => {
    router.push('/profile');
  };

  if (!mounted) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <main
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: '#0a0a0a',
        minHeight: '100dvh',
      }}
    >
      {/* 헤더 */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 20px 8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28 }}>👗</span>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#00e5ff', letterSpacing: '-0.5px' }}>
              MyFit
            </div>
            <div style={{ fontSize: 11, color: '#666', marginTop: -2 }}>AI 가상 피팅</div>
          </div>
        </div>
        <button
          onClick={goToProfile}
          aria-label="내 프로필"
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: '#1e1e1e',
            border: '1px solid #2a2a2a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
          }}
        >
          👤
        </button>
      </header>

      {/* 메인 콘텐츠 */}
      <div style={{ flex: 1, padding: '8px 20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* 히어로 카드 */}
        <div
          style={{
            background: 'linear-gradient(135deg, #141414 0%, #1a1a2e 100%)',
            border: '1px solid #2a2a2a',
            borderRadius: 20,
            padding: '28px 24px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* 배경 glow */}
          <div
            style={{
              position: 'absolute',
              top: -40,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 200,
              height: 200,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(0,229,255,0.08) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ fontSize: 52, marginBottom: 12 }}>👗</div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: '#f0f0f0',
              margin: '0 0 8px',
              lineHeight: 1.3,
            }}
          >
            AI가 옷을 직접 입혀드립니다
          </h1>
          <p
            style={{
              fontSize: 14,
              color: '#888',
              margin: '0 0 24px',
              lineHeight: 1.6,
            }}
          >
            사진 한 장으로<br />구매 전에 미리 확인하세요
          </p>

          <button className="btn-primary" onClick={goToFit}>
            AI 피팅 시작 →
          </button>
        </div>

        {/* 치수 미입력 배너 */}
        {!hasMeasurements && (
          <div
            style={{
              background: '#1a1500',
              border: '1px solid #3a2e00',
              borderRadius: 12,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span style={{ fontSize: 20, flexShrink: 0 }}>📏</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#ffab40' }}>
                치수를 먼저 입력하면
              </div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                사이즈 추천과 핏 분석을 받을 수 있어요
              </div>
            </div>
            <button
              onClick={goToProfile}
              style={{
                padding: '8px 14px',
                background: '#2a2000',
                border: '1px solid #3a2e00',
                borderRadius: 8,
                fontSize: 12,
                color: '#ffab40',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                minHeight: 36,
              }}
            >
              입력하기
            </button>
          </div>
        )}

        {/* 기능 소개 */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#888', marginBottom: 12, letterSpacing: '0.05em' }}>
            주요 기능
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: '📸', title: 'AI 가상 피팅', desc: '내 사진에 옷을 실제로 입혀봐요', color: '#00e5ff' },
              { icon: '📏', title: '사이즈 추천', desc: '체형 기반 정확한 사이즈 안내', color: '#7c4dff' },
              { icon: '🔒', title: '개인정보 보호', desc: '사진은 처리 후 즉시 삭제됩니다', color: '#00c853' },
            ].map((feat) => (
              <div
                key={feat.title}
                className="card"
                style={{ display: 'flex', alignItems: 'center', gap: 14 }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: `${feat.color}18`,
                    border: `1px solid ${feat.color}30`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    flexShrink: 0,
                  }}
                >
                  {feat.icon}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f0f0' }}>{feat.title}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{feat.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 최근 피팅 히스토리 */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#888', marginBottom: 12, letterSpacing: '0.05em' }}>
            최근 피팅
          </div>
          {history.length > 0 ? (
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
              {history.map((item) => (
                <div
                  key={item.id}
                  style={{
                    flexShrink: 0,
                    width: 120,
                    borderRadius: 12,
                    overflow: 'hidden',
                    border: '1px solid #2a2a2a',
                    background: '#141414',
                  }}
                >
                  <img
                    src={item.resultImageUrl}
                    alt={`${new Date(item.timestamp).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} 피팅 결과`}
                    loading="lazy"
                    style={{ width: '100%', height: 160, objectFit: 'cover' }}
                  />
                  <div style={{ padding: '8px', fontSize: 11, color: '#888', textAlign: 'center' }}>
                    {item.garmentName || new Date(item.timestamp).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={goToFit}
              style={{
                width: '100%',
                padding: '24px 16px',
                background: '#141414',
                border: '1px dashed #2a2a2a',
                borderRadius: 12,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 28 }} aria-hidden="true">🪄</span>
              <span style={{ fontSize: 13, color: '#888', fontWeight: 600 }}>아직 피팅 기록이 없어요</span>
              <span style={{ fontSize: 12, color: '#00e5ff' }}>첫 AI 피팅을 시작해 보세요 →</span>
            </button>
          )}
        </div>

        {/* 쿠팡파트너스 고지 */}
        <div
          style={{
            fontSize: 11,
            color: '#555',
            textAlign: 'center',
            padding: '8px 0',
            borderTop: '1px solid #1e1e1e',
          }}
        >
          이 서비스는 쿠팡파트너스 활동의 일환으로 수수료를 받을 수 있습니다.
        </div>
      </div>
    </main>
  );
}
