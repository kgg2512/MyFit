'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  saveMeasurements,
  loadMeasurements,
  setConsented,
  isConsented,
  isAgeConfirmed,
  setAgeConfirmed,
  type Measurements,
} from '@/lib/storage';
import { setOnboarded, isOnboarded } from '@/lib/onboarding';
// 모듈 로컬 process.env 직접 참조 — appMode.DEMO_MODE import는 'use client' 모듈 경계로
// 리터럴 치환이 안정적으로 전파되지 않아 스토어 빌드(false)에서 데모 전용 문구가
// 확실히 dead-code 제거되도록 DemoBanner.tsx와 동일한 방식으로 로컬 상수화한다.
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

/* ── 아이콘 (SVG, Lucide 스타일 — 이모지 금지) ── */
const IconMeasure = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21.3 8.7 8.7 21.3a2.4 2.4 0 0 1-3.4 0l-2.6-2.6a2.4 2.4 0 0 1 0-3.4L15.3 2.7a2.4 2.4 0 0 1 3.4 0l2.6 2.6a2.4 2.4 0 0 1 0 3.4Z"/>
    <path d="m7.5 10.5 2 2M11 7l2 2M14.5 3.5l2 2"/>
  </svg>
);
const IconGauge = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
  </svg>
);
const IconShoppingBag = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
    <path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>
  </svg>
);
const IconArrowRight = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);
const IconArrowLeft = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5M12 19l-7-7 7-7"/>
  </svg>
);
const IconCheck = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconShield = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const IconCamera = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);
const IconStar = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

const QUICK_SIZE_MAP: Record<string, Measurements> = {
  XS: { height: 163, weight: 50, shoulder: 37, chest: 82, waist: 62, hip: 86 },
  S:  { height: 167, weight: 57, shoulder: 39, chest: 88, waist: 67, hip: 90 },
  M:  { height: 171, weight: 65, shoulder: 41, chest: 94, waist: 74, hip: 96 },
  L:  { height: 174, weight: 72, shoulder: 43, chest: 100, waist: 80, hip: 102 },
  XL: { height: 177, weight: 80, shoulder: 45, chest: 106, waist: 87, hip: 108 },
};

/* ─── Step 1: 가치 제안 ─── */
function StepValue({ onNext }: { onNext: () => void }) {
  const benefits = [
    {
      icon: IconMeasure,
      title: '내 치수 한 번만',
      desc: '무신사·나이키·자라 어디서든 자동 적용',
    },
    {
      icon: IconGauge,
      title: '부위별 핏 예측',
      desc: '어깨·가슴·허리 — 오버핏인지 타이트한지 미리 확인',
    },
    {
      icon: IconShoppingBag,
      title: '반품 없이 딱 맞게',
      desc: '옷의 실측 사이즈 × 내 치수 = 구매 전 핏 확신',
    },
  ];

  return (
    <section aria-labelledby="step-value-title" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* 히어로 */}
      <div style={{ textAlign: 'center', padding: '40px 24px 32px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--myfit-primary-soft)', border: '1px solid #a5f0fc', borderRadius: 999, padding: '6px 14px', marginBottom: 20 }}>
          <span style={{ color: 'var(--myfit-primary)', display: 'flex' }}>{IconStar}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--myfit-primary)' }}>반품 없는 쇼핑 · 사이즈 확신</span>
        </div>
        <h1 id="step-value-title" style={{ fontSize: 30, fontWeight: 800, color: 'var(--myfit-text)', margin: '0 0 12px', lineHeight: 1.25, letterSpacing: '-0.02em' }}>
          사기 전에,<br />내 핏을 봅니다
        </h1>
        <p style={{ fontSize: 14, color: 'var(--myfit-text-sub)', margin: 0, lineHeight: 1.7 }}>
          옷의 실측 사이즈와 내 신체 치수를 비교해<br />이 옷이 나에게 어떤 핏인지 미리 확인하세요
        </p>
      </div>

      {/* 혜택 카드 3종 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, padding: '0 20px' }}>
        {benefits.map((b) => (
          <div key={b.title} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--myfit-primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--myfit-primary)' }}>
              {b.icon}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--myfit-text)', marginBottom: 3 }}>{b.title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--myfit-text-sub)', lineHeight: 1.5 }}>{b.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{ padding: '24px 20px' }}>
        <button
          className="btn-primary"
          onClick={onNext}
          aria-label="다음 단계: 내 치수 입력"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <span>내 치수 입력하기</span>
          <span style={{ display: 'flex' }}>{IconArrowRight}</span>
        </button>
        <p style={{ fontSize: 11, color: 'var(--myfit-text-muted)', textAlign: 'center', marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <span style={{ display: 'flex', color: 'var(--myfit-text-muted)' }}>{IconShield}</span>
          치수는 이 기기에만 저장 · 서버 전송 없음
        </p>
      </div>
    </section>
  );
}

/* ─── Step 2: 치수 입력 ─── */
function StepMeasure({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [form, setForm] = useState<Measurements>({
    height: 171, weight: 65, shoulder: 41, chest: 94, waist: 74, hip: 96,
  });
  const [ageConfirmed, setAgeConfirmedState] = useState(false);
  const [consented, setConsentedState] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);

  useEffect(() => {
    const existing = loadMeasurements();
    if (existing) setForm(existing);
    setConsentedState(isConsented());
    setAgeConfirmedState(isAgeConfirmed());
  }, []);

  const handleQuickSize = (size: string) => {
    const preset = QUICK_SIZE_MAP[size];
    if (preset) setForm(preset);
  };

  const handleChange = (field: keyof Measurements, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num)) setForm(prev => ({ ...prev, [field]: num }));
  };

  const handleContinue = () => {
    if (!consented) {
      setShowConsentModal(true);
    } else {
      saveMeasurements(form);
      onNext();
    }
  };

  const handleConsent = () => {
    if (!ageConfirmed) return;
    setConsented();
    setConsentedState(true);
    setAgeConfirmed();
    setShowConsentModal(false);
    saveMeasurements(form);
    onNext();
  };

  const allValid = form.height >= 140 && form.height <= 220
    && form.weight >= 30 && form.weight <= 200
    && form.shoulder >= 30 && form.shoulder <= 70
    && form.chest >= 60 && form.chest <= 140
    && form.waist >= 50 && form.waist <= 130
    && form.hip >= 60 && form.hip <= 150;

  return (
    <section aria-labelledby="step-measure-title" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* 동의 모달 */}
      {showConsentModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="consent-title"
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setShowConsentModal(false)}
        >
          <div
            style={{ width: '100%', background: 'var(--myfit-surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px calc(24px + env(safe-area-inset-bottom, 0px))', boxShadow: '0 -4px 24px rgba(0,0,0,0.10)' }}
            onClick={e => e.stopPropagation()}
          >
            <h2 id="consent-title" style={{ fontSize: 18, fontWeight: 800, color: 'var(--myfit-text)', marginBottom: 8 }}>
              MyFit 시작 전 동의
            </h2>
            <p style={{ fontSize: 13, color: 'var(--myfit-text-sub)', marginBottom: 20 }}>
              서비스 이용을 위해 아래 항목에 동의해 주세요.
            </p>
            {(DEMO_MODE ? [
              { label: '[필수] 개인정보 처리방침 동의', desc: '신체 치수는 이 기기에만 저장됩니다.' },
              { label: '[안내] 현재 샘플 이미지 시연 중입니다', desc: '지금은 실제 AI 피팅이 아닌 샘플 이미지 시연 버전입니다. 업로드하신 신체 사진은 서버로 전송·저장되지 않으며, 이 기기에서만 사용됩니다.' },
              { label: '[필수] 제휴 마케팅 링크 고지 동의', desc: '쿠팡파트너스 활동의 일환으로 구매 시 수수료를 받을 수 있습니다.' },
            ] : [
              { label: '[필수] 개인정보 처리방침 동의', desc: '신체 치수는 이 기기에만 저장됩니다. AI 피팅 이용 시 신체 사진이 외부 서버로 전송됩니다.' },
              { label: '[필수] AI 피팅 국외이전 동의 (신체 사진 — PIPA 제28조의8)', desc: '신체 사진은 AI 피팅 처리를 위해 외부 서버로 전송됩니다. 처리 후 즉시 삭제됩니다.' },
              { label: '[필수] 제휴 마케팅 링크 고지 동의', desc: '쿠팡파트너스 활동의 일환으로 구매 시 수수료를 받을 수 있습니다.' },
            ]).map(item => (
              <div key={item.label} style={{ padding: '12px 0', borderBottom: '1px solid var(--myfit-border)', display: 'flex', gap: 12 }}>
                <div style={{ width: 20, height: 20, borderRadius: 4, background: 'var(--myfit-primary-soft)', border: '1px solid var(--myfit-primary)', flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--myfit-primary)' }}>
                  {IconCheck}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--myfit-text)', marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--myfit-text-sub)', lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              </div>
            ))}
            <label htmlFor="onb-age-confirm" style={{ padding: '12px 0', display: 'flex', gap: 12, cursor: 'pointer', alignItems: 'flex-start' }}>
              <input
                id="onb-age-confirm"
                type="checkbox"
                checked={ageConfirmed}
                onChange={e => setAgeConfirmedState(e.target.checked)}
                style={{ width: 20, height: 20, flexShrink: 0, marginTop: 2, accentColor: 'var(--myfit-primary)' }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--myfit-text)', marginBottom: 3 }}>[필수] 본인은 만 14세 이상입니다</div>
                <div style={{ fontSize: 12, color: 'var(--myfit-text-sub)' }}>만 14세 미만은 본 서비스를 이용할 수 없습니다.</div>
              </div>
            </label>
            <button
              className="btn-primary"
              onClick={handleConsent}
              disabled={!ageConfirmed}
              style={{ marginTop: 16, opacity: ageConfirmed ? 1 : 0.45 }}
              aria-disabled={!ageConfirmed}
            >
              전체 동의하고 시작하기
            </button>
          </div>
        </div>
      )}

      {/* 콘텐츠 */}
      <div className="scroll-area" style={{ flex: 1, padding: '4px 20px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ background: 'var(--myfit-primary-soft)', border: '1px solid #a5f0fc', borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--myfit-primary)', display: 'flex', flexShrink: 0, marginTop: 1 }}>{IconShield}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--myfit-primary)' }}>치수는 이 기기에만 저장됩니다</div>
            <div style={{ fontSize: 12, color: 'var(--myfit-text-sub)', marginTop: 3 }}>한 번 입력하면 모든 쇼핑몰에서 자동 적용</div>
          </div>
        </div>

        {/* 빠른 사이즈 */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--myfit-text-sub)', marginBottom: 8 }}>쇼핑몰 사이즈 기준으로 자동 입력</div>
          <div role="group" aria-label="빠른 사이즈 선택" style={{ display: 'flex', gap: 8 }}>
            {(['XS', 'S', 'M', 'L', 'XL'] as const).map(size => (
              <button
                key={size}
                onClick={() => handleQuickSize(size)}
                aria-label={`${size} 사이즈로 자동 입력`}
                style={{ flex: 1, height: 44, borderRadius: 8, background: 'var(--myfit-surface2)', border: '1px solid var(--myfit-border)', fontSize: 13, fontWeight: 600, color: 'var(--myfit-text)' }}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* 기본 정보 */}
        <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
          <legend style={{ fontSize: 13, fontWeight: 700, color: 'var(--myfit-text-sub)', marginBottom: 10, display: 'block', letterSpacing: '0.04em' }}>기본 정보</legend>
          <div style={{ display: 'flex', gap: 12 }}>
            <OnbFieldInput label="키 (cm)" value={form.height} min={140} max={220} onChange={v => handleChange('height', v)} />
            <OnbFieldInput label="몸무게 (kg)" value={form.weight} min={30} max={200} onChange={v => handleChange('weight', v)} />
          </div>
        </fieldset>

        {/* 신체 둘레 */}
        <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
          <legend style={{ fontSize: 13, fontWeight: 700, color: 'var(--myfit-text-sub)', marginBottom: 10, display: 'block', letterSpacing: '0.04em' }}>신체 둘레</legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <OnbFieldInput label="어깨 너비 (cm)" value={form.shoulder} min={30} max={70} onChange={v => handleChange('shoulder', v)} />
              <OnbFieldInput label="가슴 둘레 (cm)" value={form.chest} min={60} max={140} onChange={v => handleChange('chest', v)} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <OnbFieldInput label="허리 둘레 (cm)" value={form.waist} min={50} max={130} onChange={v => handleChange('waist', v)} />
              <OnbFieldInput label="엉덩이 둘레 (cm)" value={form.hip} min={60} max={150} onChange={v => handleChange('hip', v)} />
            </div>
          </div>
        </fieldset>

        {/* 향후 사진 스캔 안내 (placeholder) */}
        <div style={{ border: '1px dashed var(--myfit-border-strong)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'flex', color: 'var(--myfit-text-muted)', flexShrink: 0 }}>{IconCamera}</span>
          <div style={{ fontSize: 12, color: 'var(--myfit-text-muted)', lineHeight: 1.5 }}>
            <span style={{ fontWeight: 600 }}>사진 스캔 자동 측정</span> — 곧 출시 예정. 사진 한 장으로 치수를 자동 측정합니다.
          </div>
        </div>

        <div style={{ height: 8 }} />
      </div>

      {/* 버튼 */}
      <div style={{ padding: '12px 20px calc(16px + var(--safe-bottom))' }}>
        <button
          className="btn-primary"
          onClick={handleContinue}
          disabled={!allValid}
          aria-disabled={!allValid}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <span>저장하고 첫 핏 체험하기</span>
          <span style={{ display: 'flex' }}>{IconArrowRight}</span>
        </button>
      </div>
    </section>
  );
}

/* ─── Step 3: 첫 핏 체험 / 완료 ─── */
function StepComplete({ onFinish }: { onFinish: () => void }) {
  const router = useRouter();

  const handleGoFit = () => {
    setOnboarded();
    router.push('/fit/check');
  };

  const handleGoHome = () => {
    setOnboarded();
    onFinish();
  };

  return (
    <section aria-labelledby="step-complete-title" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      {/* 완료 표시 */}
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--myfit-primary-soft)', border: '2px solid var(--myfit-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, color: 'var(--myfit-primary)' }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>

      <h1 id="step-complete-title" style={{ fontSize: 26, fontWeight: 800, color: 'var(--myfit-text)', textAlign: 'center', margin: '0 0 12px', lineHeight: 1.3, letterSpacing: '-0.02em' }}>
        준비 완료!
      </h1>
      <p style={{ fontSize: 14, color: 'var(--myfit-text-sub)', textAlign: 'center', margin: '0 0 32px', lineHeight: 1.7 }}>
        이제 어느 쇼핑몰에서든<br />핏 예측이 자동 적용됩니다
      </p>

      {/* 적용 예시 카드 */}
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
        {[
          { store: '무신사', tag: 'S 추천', color: 'var(--myfit-fit-standard)' },
          { store: '나이키', tag: 'M 타이트', color: 'var(--myfit-fit-tight)' },
          { store: '자라', tag: 'M 오버핏', color: 'var(--myfit-fit-oversized)' },
        ].map(item => (
          <div key={item.store} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--myfit-text)' }}>{item.store}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: item.color, background: item.color + '1a', padding: '4px 10px', borderRadius: 999 }}>{item.tag}</span>
          </div>
        ))}
      </div>

      {/* CTA 2종 */}
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          className="btn-primary"
          onClick={handleGoFit}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <span>첫 핏 예측 체험하기</span>
          <span style={{ display: 'flex' }}>{IconArrowRight}</span>
        </button>
        <button
          className="btn-secondary"
          onClick={handleGoHome}
          aria-label="홈 화면으로 이동"
        >
          홈으로 이동
        </button>
      </div>
    </section>
  );
}

/* ─── 입력 필드 컴포넌트 ─── */
function OnbFieldInput({
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
  const inputId = `onb-field-${label.replace(/[\s()]/g, '-')}`;
  const errorId = `${inputId}-error`;

  return (
    <div style={{ flex: 1 }}>
      <label htmlFor={inputId} style={{ fontSize: 11, color: 'var(--myfit-text-sub)', display: 'block', marginBottom: 6, fontWeight: 600 }}>
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
          width: '100%', height: 48,
          background: 'var(--myfit-surface2)',
          border: `1px solid ${isOutOfRange ? 'var(--myfit-error)' : 'var(--myfit-border)'}`,
          borderRadius: 10, padding: '0 14px',
          fontSize: 16, color: 'var(--myfit-text)', textAlign: 'center',
        }}
      />
      {isOutOfRange && (
        <div id={errorId} role="alert" style={{ color: 'var(--myfit-error)', fontSize: 11, marginTop: 4 }}>
          {min}~{max} 범위로 입력해 주세요
        </div>
      )}
    </div>
  );
}

/* ─── 스텝 인디케이터 ─── */
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <nav aria-label="온보딩 진행 단계" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          aria-current={i === current ? 'step' : undefined}
          style={{
            height: 4,
            borderRadius: 2,
            background: i === current ? 'var(--myfit-ink)' : i < current ? 'var(--myfit-primary)' : 'var(--myfit-border)',
            transition: 'all 0.3s ease',
            width: i === current ? 28 : 14,
          }}
        />
      ))}
      <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>
        {current + 1} / {total} 단계
      </span>
    </nav>
  );
}

/* ─── 메인 온보딩 페이지 ─── */
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd'); // 전환 방향 (연속감)
  const [mounted, setMounted] = useState(false);

  const TOTAL_STEPS = 3;

  useEffect(() => {
    setMounted(true);
    // 이미 온보딩 완료한 사용자 → 홈으로
    if (isOnboarded()) {
      router.replace('/');
    }
  }, [router]);

  const handleNext = useCallback(() => {
    setDir('fwd');
    setStep(s => Math.min(s + 1, TOTAL_STEPS - 1));
  }, []);

  const handleBack = useCallback(() => {
    if (step === 0) {
      router.push('/');
    } else {
      setDir('back');
      setStep(s => s - 1);
    }
  }, [step, router]);

  const handleFinish = useCallback(() => {
    setOnboarded();
    router.push('/');
  }, [router]);

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
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'calc(16px + var(--safe-top)) 20px 12px' }}>
        <button
          onClick={handleBack}
          aria-label={step === 0 ? '홈으로 돌아가기' : '이전 단계로 이동'}
          style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--myfit-surface2)', border: '1px solid var(--myfit-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--myfit-text-sub)' }}
        >
          {IconArrowLeft}
        </button>

        <StepIndicator current={step} total={TOTAL_STEPS} />

        {/* 건너뛰기 — Step 0에서만 */}
        {step === 0 ? (
          <button
            onClick={handleFinish}
            aria-label="온보딩 건너뛰고 홈으로 이동"
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--myfit-text-muted)', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center' }}
          >
            건너뛰기
          </button>
        ) : (
          <div style={{ width: 44 }} aria-hidden="true" />
        )}
      </header>

      {/* 스텝 콘텐츠 — 단일 컨테이너 내부 크로스페이드(라우팅 없이 연속 전환) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div key={step} className={`mf-step${dir === 'back' ? ' mf-step--back' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {step === 0 && <StepValue onNext={handleNext} />}
          {step === 1 && <StepMeasure onNext={handleNext} onBack={handleBack} />}
          {step === 2 && <StepComplete onFinish={handleFinish} />}
        </div>
      </div>
    </main>
  );
}
