'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  saveMeasurements,
  loadMeasurements,
  setConsented,
  isConsented,
  isAgeConfirmed,
  setAgeConfirmed,
  seedDemoData,
  type Measurements,
} from '@/lib/storage';
import { DEMO_MODE } from '@/lib/tryon';

const QUICK_SIZE_MAP: Record<string, Measurements> = {
  XS: { height: 163, weight: 50, shoulder: 37, chest: 82, waist: 62, hip: 86 },
  S:  { height: 167, weight: 57, shoulder: 39, chest: 88, waist: 67, hip: 90 },
  M:  { height: 171, weight: 65, shoulder: 41, chest: 94, waist: 74, hip: 96 },
  L:  { height: 174, weight: 72, shoulder: 43, chest: 100, waist: 80, hip: 102 },
  XL: { height: 177, weight: 80, shoulder: 45, chest: 106, waist: 87, hip: 108 },
};

/* ── 아이콘 (SVG, Lucide 스타일) ── */
const IconArrowLeft = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5M12 19l-7-7 7-7"/>
  </svg>
);
const IconCheck = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconShield = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const IconRuler = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21.3 8.7 8.7 21.3a2.4 2.4 0 0 1-3.4 0l-2.6-2.6a2.4 2.4 0 0 1 0-3.4L15.3 2.7a2.4 2.4 0 0 1 3.4 0l2.6 2.6a2.4 2.4 0 0 1 0 3.4Z"/>
    <path d="m7.5 10.5 2 2M11 7l2 2M14.5 3.5l2 2"/>
  </svg>
);

export default function ProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState<Measurements>({
    height: 175, weight: 70, shoulder: 43, chest: 94, waist: 78, hip: 90,
  });
  const [saved, setSaved] = useState(false);
  const [consented, setConsentedState] = useState(false);
  const [ageConfirmed, setAgeConfirmedState] = useState(false); // 만 14세 이상 확인 (PIPA §22)
  const [showConsent, setShowConsent] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // 데모 빌드: seed 치수·동의 주입 (실사용 데이터 있으면 덮어쓰지 않음)
    if (DEMO_MODE) {
      seedDemoData(process.env.NEXT_PUBLIC_BASE_PATH || '');
    }
    const existing = loadMeasurements();
    if (existing) setForm(existing);
    const c = isConsented();
    setConsentedState(c);
    setAgeConfirmedState(isAgeConfirmed());
    if (!c) setShowConsent(true);
  }, []);

  const handleQuickSize = (size: string) => {
    const preset = QUICK_SIZE_MAP[size];
    if (preset) setForm(preset);
  };

  const handleChange = (field: keyof Measurements, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      setForm(prev => ({ ...prev, [field]: num }));
    }
  };

  const handleSave = () => {
    if (!consented) {
      setShowConsent(true);
      return;
    }
    saveMeasurements(form);
    setSaved(true);
    setTimeout(() => {
      router.push('/fit');
    }, 800);
  };

  const handleConsent = () => {
    // 만 14세 이상 확인 미체크 시 진행 불가 (PIPA §22)
    if (!ageConfirmed) return;
    setConsented();
    setConsentedState(true);
    setAgeConfirmed();
    setShowConsent(false);
    saveMeasurements(form);
    setSaved(true);
    setTimeout(() => {
      router.push('/fit');
    }, 800);
  };

  if (!mounted) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--myfit-bg)', minHeight: '100dvh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--myfit-bg)', minHeight: '100dvh', color: 'var(--myfit-text)' }}>
      {/* 동의 모달 */}
      {showConsent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-consent-title"
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'flex-end',
          }}
          onClick={() => setShowConsent(false)}
        >
          <div
            style={{
              width: '100%',
              background: 'var(--myfit-surface)',
              borderRadius: '20px 20px 0 0',
              padding: '24px 20px calc(24px + env(safe-area-inset-bottom, 0px))',
              border: '1px solid var(--myfit-border)',
              boxShadow: '0 -4px 24px rgba(0,0,0,0.10)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div id="profile-consent-title" style={{ fontSize: 18, fontWeight: 800, color: 'var(--myfit-text)', marginBottom: 8 }}>
              MyFit 시작 전 동의
            </div>
            <div style={{ fontSize: 13, color: 'var(--myfit-text-sub)', marginBottom: 20 }}>
              서비스 이용을 위해 아래 항목에 동의해 주세요.
            </div>

            {[
              {
                label: '[필수] 개인정보 처리방침 동의',
                desc: '신체 치수는 이 기기에만 저장됩니다. AI 피팅 이용 시 신체 사진이 외부 서버로 전송됩니다.',
              },
              {
                label: '[필수] AI 피팅 국외이전 동의 (신체 사진 — PIPA 제28조의8)',
                desc: '신체 사진은 AI 피팅 처리를 위해 인도 소재 TryOnCloud 서버로 전송됩니다. 원본 사진은 처리 후 즉시 삭제, 피팅 결과 이미지는 최대 7일 후 삭제됩니다. 동의를 철회하려면 AI 피팅 기능을 이용하지 않으시면 됩니다.',
              },
              {
                label: '[필수] 제휴 마케팅 링크 고지 동의',
                desc: '이 서비스는 쿠팡파트너스 활동의 일환으로, 구매 시 수수료를 받을 수 있습니다.',
              },
            ].map(item => (
              <div
                key={item.label}
                style={{
                  padding: '14px 0',
                  borderBottom: '1px solid var(--myfit-border)',
                  display: 'flex',
                  gap: 12,
                }}
              >
                <div style={{ width: 20, height: 20, borderRadius: 4, background: 'var(--myfit-primary-soft)', border: '1px solid var(--myfit-primary)', flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--myfit-primary)' }}>
                  {IconCheck}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--myfit-text)', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--myfit-text-sub)', lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              </div>
            ))}

            {/* [필수] 만 14세 이상 확인 — 사용자가 직접 체크해야 진행 가능 (PIPA §22) */}
            <label
              htmlFor="age-confirm-profile"
              style={{
                padding: '14px 0',
                display: 'flex',
                gap: 12,
                cursor: 'pointer',
                alignItems: 'flex-start',
              }}
            >
              <input
                id="age-confirm-profile"
                type="checkbox"
                checked={ageConfirmed}
                onChange={e => setAgeConfirmedState(e.target.checked)}
                style={{ width: 20, height: 20, flexShrink: 0, marginTop: 2, accentColor: 'var(--myfit-primary)' }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--myfit-text)', marginBottom: 4 }}>[필수] 본인은 만 14세 이상입니다</div>
                <div style={{ fontSize: 12, color: 'var(--myfit-text-sub)', lineHeight: 1.5 }}>만 14세 미만은 본 서비스를 이용할 수 없습니다.</div>
              </div>
            </label>

            <button
              className="btn-primary"
              style={{ marginTop: 20, opacity: ageConfirmed ? 1 : 0.45 }}
              onClick={handleConsent}
              disabled={!ageConfirmed}
            >
              전체 동의하고 시작하기
            </button>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px 8px' }}>
        <button
          onClick={() => window.history.back()}
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'var(--myfit-surface2)', border: '1px solid var(--myfit-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--myfit-text-sub)',
          }}
          aria-label="뒤로가기"
        >
          {IconArrowLeft}
        </button>
        <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--myfit-text)' }}>내 치수 입력</span>
      </header>

      <div className="scroll-area" style={{ flex: 1, padding: '8px 20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* 안내 */}
        <div style={{ background: 'var(--myfit-primary-soft)', border: '1px solid #a5f0fc', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--myfit-primary)', flexShrink: 0 }}>{IconRuler}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--myfit-primary)' }}>한 번만 입력하면 저장됩니다</div>
            <div style={{ fontSize: 12, color: 'var(--myfit-text-sub)', marginTop: 4 }}>신체 치수는 이 기기에만 저장됩니다</div>
          </div>
        </div>

        {/* 빠른 사이즈 입력 */}
        <div>
          <div style={{ fontSize: 13, color: 'var(--myfit-text-sub)', marginBottom: 10, fontWeight: 600 }}>쇼핑몰 사이즈 기준 자동 입력</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['XS', 'S', 'M', 'L', 'XL'] as const).map(size => (
              <button
                key={size}
                onClick={() => handleQuickSize(size)}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 8,
                  background: 'var(--myfit-surface2)',
                  border: '1px solid var(--myfit-border)',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--myfit-text)',
                }}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* 기본 정보 */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--myfit-text-sub)', marginBottom: 12, letterSpacing: '0.05em' }}>기본 정보</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <FieldInput label="키 (cm)" value={form.height} min={140} max={220} onChange={v => handleChange('height', v)} />
            <FieldInput label="몸무게 (kg)" value={form.weight} min={30} max={200} onChange={v => handleChange('weight', v)} />
          </div>
        </div>

        {/* 신체 둘레 */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--myfit-text-sub)', marginBottom: 12, letterSpacing: '0.05em' }}>신체 둘레</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <FieldInput label="어깨 너비 (cm)" value={form.shoulder} min={30} max={70} onChange={v => handleChange('shoulder', v)} />
              <FieldInput label="가슴 둘레 (cm)" value={form.chest} min={60} max={140} onChange={v => handleChange('chest', v)} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <FieldInput label="허리 둘레 (cm)" value={form.waist} min={50} max={130} onChange={v => handleChange('waist', v)} />
              <FieldInput label="엉덩이 둘레 (cm)" value={form.hip} min={60} max={150} onChange={v => handleChange('hip', v)} />
            </div>
          </div>
        </div>

        {/* 저장 버튼 */}
        <button
          className="btn-primary"
          onClick={handleSave}
          style={{ marginTop: 8 }}
        >
          {saved ? '저장됨 ✓' : '저장하고 핏 예측 시작 →'}
        </button>

        <div style={{ fontSize: 11, color: 'var(--myfit-text-muted)', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <span style={{ color: 'var(--myfit-text-muted)' }}>{IconShield}</span>
          이 기기에만 저장 · 서버 전송 없음
        </div>
      </div>
    </main>
  );
}

function FieldInput({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: string) => void;
}) {
  const isOutOfRange = value < min || value > max;
  const inputId = `field-${label.replace(/\s+/g, '-')}`;
  const errorId = `${inputId}-error`;

  return (
    <div style={{ flex: 1 }}>
      <label
        htmlFor={inputId}
        style={{ fontSize: 11, color: 'var(--myfit-text-sub)', display: 'block', marginBottom: 6, fontWeight: 600 }}
      >
        {label}
      </label>
      <input
        id={inputId}
        type="number"
        value={value}
        min={min}
        max={max}
        inputMode="decimal"
        onChange={e => onChange(e.target.value)}
        aria-describedby={isOutOfRange ? errorId : undefined}
        aria-invalid={isOutOfRange || undefined}
        style={{
          width: '100%',
          height: 48,
          background: 'var(--myfit-surface2)',
          border: `1px solid ${isOutOfRange ? '#ef4444' : 'var(--myfit-border)'}`,
          borderRadius: 10,
          padding: '0 14px',
          fontSize: 16,
          color: 'var(--myfit-text)',
          textAlign: 'center',
        }}
      />
      {isOutOfRange && (
        <div
          id={errorId}
          role="alert"
          style={{ color: '#ef4444', fontSize: 11, marginTop: 4 }}
        >
          {min}~{max} 범위로 입력해 주세요
        </div>
      )}
    </div>
  );
}
