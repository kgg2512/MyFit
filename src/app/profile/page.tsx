'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  saveMeasurements,
  loadMeasurements,
  setConsented,
  isConsented,
  type Measurements,
} from '@/lib/storage';

const QUICK_SIZE_MAP: Record<string, Measurements> = {
  XS: { height: 163, weight: 50, shoulder: 37, chest: 82, waist: 62, hip: 86 },
  S:  { height: 167, weight: 57, shoulder: 39, chest: 88, waist: 67, hip: 90 },
  M:  { height: 171, weight: 65, shoulder: 41, chest: 94, waist: 74, hip: 96 },
  L:  { height: 174, weight: 72, shoulder: 43, chest: 100, waist: 80, hip: 102 },
  XL: { height: 177, weight: 80, shoulder: 45, chest: 106, waist: 87, hip: 108 },
};

export default function ProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState<Measurements>({
    height: 175, weight: 70, shoulder: 43, chest: 94, waist: 78, hip: 90,
  });
  const [saved, setSaved] = useState(false);
  const [consented, setConsentedState] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const existing = loadMeasurements();
    if (existing) setForm(existing);
    const c = isConsented();
    setConsentedState(c);
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
    setConsented();
    setConsentedState(true);
    setShowConsent(false);
    saveMeasurements(form);
    setSaved(true);
    setTimeout(() => {
      router.push('/fit');
    }, 800);
  };

  if (!mounted) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0a0a0a', minHeight: '100dvh' }}>
      {/* 동의 모달 */}
      {showConsent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-consent-title"
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'flex-end',
          }}
          onClick={() => setShowConsent(false)}
        >
          <div
            style={{
              width: '100%',
              background: '#141414',
              borderRadius: '20px 20px 0 0',
              padding: '24px 20px calc(24px + env(safe-area-inset-bottom, 0px))',
              border: '1px solid #2a2a2a',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div id="profile-consent-title" style={{ fontSize: 18, fontWeight: 800, color: '#f0f0f0', marginBottom: 8 }}>
              MyFit 시작 전 동의
            </div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
              서비스 이용을 위해 아래 항목에 동의해 주세요.
            </div>

            {[
              {
                label: '[필수] 개인정보 처리방침 동의',
                desc: '신체 치수는 이 기기에만 저장됩니다. AI 피팅 이용 시 사진이 외부 서버로 전송됩니다.',
              },
              {
                label: '[필수] AI 피팅 서비스 이용 동의',
                desc: 'AI 피팅 기능 사용 시 사진이 미국 소재 TryOnCloud 서버로 전송되며, 피팅 완료 후 즉시 삭제됩니다. (개인정보보호법 제28조의8 국외이전 고지)',
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
                  borderBottom: '1px solid #2a2a2a',
                  display: 'flex',
                  gap: 12,
                }}
              >
                <div style={{ width: 20, height: 20, borderRadius: 4, background: '#00e5ff20', border: '1px solid #00e5ff40', flexShrink: 0, marginTop: 2 }}>
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00e5ff', fontSize: 12 }}>✓</div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f0f0', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              </div>
            ))}

            <button className="btn-primary" style={{ marginTop: 20 }} onClick={handleConsent}>
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
            background: '#1e1e1e', border: '1px solid #2a2a2a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: '#f0f0f0',
          }}
          aria-label="뒤로가기"
        >
          ←
        </button>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#f0f0f0' }}>내 치수 입력</span>
      </header>

      <div className="scroll-area" style={{ flex: 1, padding: '8px 20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* 안내 */}
        <div style={{ background: '#0d1f0d', border: '1px solid #1a3a1a', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#00c853' }}>한 번만 입력하면 저장됩니다</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>신체 치수는 이 기기에만 저장됩니다</div>
        </div>

        {/* 빠른 사이즈 입력 */}
        <div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 10, fontWeight: 600 }}>쇼핑몰 사이즈 기준 자동 입력</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['XS', 'S', 'M', 'L', 'XL'] as const).map(size => (
              <button
                key={size}
                onClick={() => handleQuickSize(size)}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 8,
                  background: '#1e1e1e',
                  border: '1px solid #2a2a2a',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#f0f0f0',
                }}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* 기본 정보 */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#888', marginBottom: 12, letterSpacing: '0.05em' }}>기본 정보</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <FieldInput label="키 (cm)" value={form.height} min={140} max={220} onChange={v => handleChange('height', v)} />
            <FieldInput label="몸무게 (kg)" value={form.weight} min={30} max={200} onChange={v => handleChange('weight', v)} />
          </div>
        </div>

        {/* 신체 둘레 */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#888', marginBottom: 12, letterSpacing: '0.05em' }}>신체 둘레</div>
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
          {saved ? '저장됨 ✓' : '저장하고 피팅 시작 →'}
        </button>

        <div style={{ fontSize: 11, color: '#555', textAlign: 'center' }}>
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
        style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 6, fontWeight: 600 }}
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
          background: '#1e1e1e',
          border: `1px solid ${isOutOfRange ? '#ff5252' : '#2a2a2a'}`,
          borderRadius: 10,
          padding: '0 14px',
          fontSize: 16,
          color: '#f0f0f0',
          textAlign: 'center',
        }}
      />
      {isOutOfRange && (
        <div
          id={errorId}
          role="alert"
          style={{ color: '#ff5252', fontSize: 11, marginTop: 4 }}
        >
          {min}~{max} 범위로 입력해 주세요
        </div>
      )}
    </div>
  );
}
