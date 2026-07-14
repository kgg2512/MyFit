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
  saveLastPersonImage,
  loadLastPersonImage,
  clearLastPersonImage,
  type Measurements,
} from '@/lib/storage';
import { captureImage } from '@/lib/camera';
import { useAuth } from '@/lib/auth/useAuth';

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
const IconCamera = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);
const IconImage = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
  </svg>
);
const IconX = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconGoogle = (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
    <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
    <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"/>
    <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/>
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
  const [photoPreview, setPhotoPreview] = useState<string>(''); // 내 몸 기록 미리보기 (dataUrl)
  const [photoError, setPhotoError] = useState<string>('');

  // 로그인(선택) + 클라우드 동기화. 로그인 시 병합된 치수로 폼을 갱신한다.
  const auth = useAuth((merged) => {
    if (merged) setForm(merged);
  });
  const [cloudConsentDismissed, setCloudConsentDismissed] = useState(false); // "동의 안 함" 시 옵트인 블록 접기(1회성)

  useEffect(() => {
    setMounted(true);
    const existing = loadMeasurements();
    if (existing) setForm(existing);
    const c = isConsented();
    setConsentedState(c);
    setAgeConfirmedState(isAgeConfirmed());
    if (!c) setShowConsent(true);
    // 저장된 신체 사진(미만료)이 있으면 미리보기 (온디바이스, 만료 자동폐기 정책)
    const photo = loadLastPersonImage();
    if (photo) setPhotoPreview(`data:image/jpeg;base64,${photo}`);
  }, []);

  // ── 내 몸 기록 (선택, P9) — 기존 camera.ts + storage 사진 인프라 재사용, 신규 수집항목 0 ──
  const handleCapturePhoto = async (mode: 'camera' | 'gallery') => {
    if (!consented) { setShowConsent(true); return; }
    setPhotoError('');
    try {
      const result = await captureImage(mode);
      saveLastPersonImage(result.base64); // localStorage만 (서버 전송 없음)
      setPhotoPreview(result.dataUrl);
    } catch (e) {
      const err = e as Error;
      if (!err.message.includes('취소')) setPhotoError('사진을 불러오지 못했습니다: ' + err.message);
    }
  };

  const handleDeletePhoto = () => {
    clearLastPersonImage();
    setPhotoPreview('');
    setPhotoError('');
  };

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
    void auth.pushMeasurements({ ...form, savedAt: Date.now() }); // 로그인 시에만 클라우드 반영(비로그인 no-op)
    setSaved(true);
    setTimeout(() => {
      router.push('/fit/check');
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
    void auth.pushMeasurements({ ...form, savedAt: Date.now() }); // 로그인 시에만 클라우드 반영
    setSaved(true);
    setTimeout(() => {
      router.push('/fit/check');
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
    <main className="mf-page-enter" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--myfit-bg)', minHeight: '100dvh', color: 'var(--myfit-text)' }}>
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
                desc: '신체 치수는 이 기기에만 저장됩니다.',
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

        {/* 계정 로그인 + 클라우드 동기화 (선택) — 로그인과 클라우드 저장 동의는 분리. firebase 비활성 빌드에서는 렌더 안 함(dead-code). */}
        {auth.available && (
          <section aria-label="계정 동기화" className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!auth.user ? (
              /* ── 상태 1: 비로그인 ── */
              <>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--myfit-text)', marginBottom: 4 }}>기기 간 치수 동기화 (선택)</div>
                  <div style={{ fontSize: 12, color: 'var(--myfit-text-sub)', lineHeight: 1.5 }}>
                    로그인하면 별도 동의 후 내 치수를 계정에 저장해 다른 기기에서도 이어갈 수 있어요. 로그인 없이도 그대로 사용할 수 있어요.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void auth.signInGoogle()}
                  disabled={auth.loading}
                  style={{ width: '100%', minHeight: 48, borderRadius: 10, background: '#fff', border: '1px solid var(--myfit-border-strong)', color: 'var(--myfit-text)', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: auth.loading ? 0.6 : 1 }}
                >
                  {IconGoogle}
                  Google로 로그인
                </button>
                {auth.error && (
                  <div role="alert" style={{ fontSize: 12, color: 'var(--myfit-error)' }}>{auth.error}</div>
                )}
              </>
            ) : (
              /* ── 로그인됨 (공통 헤더) ── */
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flexShrink: 0, color: auth.cloudConsent ? 'var(--myfit-success)' : 'var(--myfit-text-sub)', display: 'flex' }}>{IconCheck}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--myfit-text)' }}>
                      {auth.cloudConsent ? (auth.syncing ? '치수 동기화 중…' : '기기 간 동기화 켜짐') : '로그인됨'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--myfit-text-sub)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {auth.user.email ?? auth.user.displayName ?? '로그인됨'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void auth.signOut()}
                    style={{ flexShrink: 0, padding: '8px 12px', minHeight: 36, borderRadius: 8, background: '#fff', border: '1px solid var(--myfit-border-strong)', color: 'var(--myfit-text-sub)', fontSize: 12, fontWeight: 600 }}
                  >
                    로그아웃
                  </button>
                </div>

                {auth.cloudConsent ? (
                  /* ── 상태 3: 로그인 + 동의 → 켜짐 + 끄기(철회) ── */
                  <>
                    <div style={{ fontSize: 11, color: 'var(--myfit-text-muted)', lineHeight: 1.5 }}>
                      치수(숫자)만 계정에 저장돼 다른 기기에서도 이어집니다. 사진은 이 기기에만 남습니다.
                    </div>
                    <button
                      type="button"
                      onClick={() => void auth.revokeCloudConsent()}
                      style={{ alignSelf: 'flex-start', padding: '8px 12px', minHeight: 36, borderRadius: 8, background: '#fff', border: '1px solid var(--myfit-border-strong)', color: 'var(--myfit-text-sub)', fontSize: 12, fontWeight: 600 }}
                    >
                      동기화 끄기
                    </button>
                  </>
                ) : !cloudConsentDismissed ? (
                  /* ── 상태 2: 로그인 + 미동의 → 명시적 옵트인 (로그인과 분리된 별도 확인) ── */
                  <div style={{ borderTop: '1px solid var(--myfit-border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--myfit-text)' }}>클라우드 동기화 동의 (선택)</div>
                    <div style={{ fontSize: 12, color: 'var(--myfit-text-sub)', lineHeight: 1.6 }}>
                      치수 6종(키·몸무게·어깨·가슴·허리·엉덩이)을 Google 클라우드(서울 리전)에 저장해 기기 간 동기화합니다. 처리위탁: Google LLC. 로그아웃·탈퇴 시 삭제됩니다. 동의하지 않아도 로그인은 가능하며, 이 경우 치수는 이 기기에만 저장됩니다.
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => void auth.giveCloudConsent()}
                        style={{ flex: 1, minHeight: 44 }}
                      >
                        동의하고 동기화
                      </button>
                      <button
                        type="button"
                        onClick={() => setCloudConsentDismissed(true)}
                        style={{ flex: 1, minHeight: 44, borderRadius: 10, background: '#fff', border: '1px solid var(--myfit-border-strong)', color: 'var(--myfit-text-sub)', fontSize: 14, fontWeight: 600 }}
                      >
                        동의 안 함
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── 상태 2': 미동의 + 접음 → 로컬 저장 안내 + 다시 켜기 ── */
                  <div style={{ borderTop: '1px solid var(--myfit-border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--myfit-text-muted)', lineHeight: 1.5 }}>
                      치수는 이 기기에만 저장 중입니다. (클라우드 동기화 미동의)
                    </div>
                    <button
                      type="button"
                      onClick={() => setCloudConsentDismissed(false)}
                      style={{ alignSelf: 'flex-start', padding: '8px 12px', minHeight: 36, borderRadius: 8, background: '#fff', border: '1px solid var(--myfit-border-strong)', color: 'var(--myfit-primary)', fontSize: 12, fontWeight: 600 }}
                    >
                      기기 간 동기화 켜기
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* 내 몸 기록 (선택) — P9. 결과 화면에서 실루엣 대신 내 사진으로 확인 */}
        <section aria-label="내 몸 기록">
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--myfit-text-sub)', marginBottom: 8, letterSpacing: '0.04em' }}>
            내 몸 기록 <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--myfit-text-muted)' }}>(선택)</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--myfit-text-sub)', marginBottom: 12, lineHeight: 1.5 }}>
            사진을 더하면 핏 결과 화면에서 실루엣 대신 내 사진으로 비교할 수 있어요.
          </div>

          {photoPreview ? (
            <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--myfit-border)', position: 'relative' }}>
              <img src={photoPreview} alt="내 몸 기록 사진 미리보기" style={{ width: '100%', maxHeight: 300, objectFit: 'cover', display: 'block' }} />
              <button
                onClick={handleDeletePhoto}
                aria-label="내 몸 기록 사진 삭제"
                style={{ position: 'absolute', top: 8, right: 8, width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', border: '1px solid var(--myfit-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--myfit-text)' }}
              >
                {IconX}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-secondary" onClick={() => handleCapturePhoto('camera')} style={{ flex: 1, gap: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span>{IconCamera}</span> 촬영
              </button>
              <button className="btn-secondary" onClick={() => handleCapturePhoto('gallery')} style={{ flex: 1, gap: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span>{IconImage}</span> 사진 선택
              </button>
            </div>
          )}

          {photoError && (
            <div role="alert" style={{ marginTop: 10, fontSize: 12, color: 'var(--myfit-error)' }}>{photoError}</div>
          )}

          <div style={{ fontSize: 11, color: 'var(--myfit-text-muted)', textAlign: 'center', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, lineHeight: 1.5 }}>
            <span style={{ color: 'var(--myfit-text-muted)' }}>{IconShield}</span>
            사진은 이 기기에만 저장됩니다 · 서버 전송 없음 · 7일 후 자동 삭제
          </div>
        </section>

        {/* 내 데이터 · 프라이버시 진입 */}
        <button
          type="button"
          onClick={() => router.push('/privacy')}
          aria-label="내 데이터 · 프라이버시 — 저장된 데이터 확인 및 삭제"
          style={{ width: '100%', textAlign: 'left', background: 'var(--myfit-surface2)', border: '1px solid var(--myfit-border)', borderRadius: 'var(--myfit-radius)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, minHeight: 0 }}
        >
          <span style={{ flexShrink: 0, display: 'flex', color: 'var(--myfit-primary)' }}>{IconShield}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--myfit-text)' }}>내 데이터 · 프라이버시</div>
            <div style={{ fontSize: 12, color: 'var(--myfit-text-sub)', marginTop: 2 }}>저장된 데이터 확인 · 삭제 · 사진 만료 관리</div>
          </div>
          <span style={{ flexShrink: 0, display: 'flex', color: 'var(--myfit-text-muted)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </span>
        </button>
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
