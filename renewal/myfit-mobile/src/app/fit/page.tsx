'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  requestTryOnFit,
  validateImageFile,
  validateImageUrl,
  fileToBase64,
  blobUrlToBase64,
  type FitCategory,
} from '@/lib/tryon';
import { captureImage } from '@/lib/camera';
import {
  loadMeasurements,
  loadLastPersonImage,
  saveLastPersonImage,
  saveFitHistory,
  isConsented,
  setConsented,
  isAgeConfirmed,
  setAgeConfirmed,
  calcRecommendedSize,
  type Measurements,
} from '@/lib/storage';
import LoadingSteps from '@/components/LoadingSteps';
import DemoBanner from '@/demo/DemoBanner';

// ── 피팅 단계 ──
type FitStep = 'person' | 'garment' | 'result';

// ── 옷 카테고리 ──
const CATEGORY_OPTIONS: { value: FitCategory; label: string }[] = [
  { value: 'tops', label: '상의 (티셔츠, 셔츠, 재킷...)' },
  { value: 'bottoms', label: '하의 (바지, 스커트...)' },
];

/* ── 아이콘 (SVG, Lucide 스타일 — 이모지 금지) ── */
const IconArrowLeft = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5M12 19l-7-7 7-7"/>
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
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
);
const IconFile = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);
const IconRefresh = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="1 4 1 10 7 10"/>
    <path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
  </svg>
);
const IconLink = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
);
const IconUser = (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconShirt = (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/>
  </svg>
);
const IconRuler = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21.3 8.7 8.7 21.3a2.4 2.4 0 0 1-3.4 0l-2.6-2.6a2.4 2.4 0 0 1 0-3.4L15.3 2.7a2.4 2.4 0 0 1 3.4 0l2.6 2.6a2.4 2.4 0 0 1 0 3.4Z"/>
    <path d="m7.5 10.5 2 2M11 7l2 2M14.5 3.5l2 2"/>
  </svg>
);
const IconDownload = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const IconThumbUp = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
    <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
  </svg>
);
const IconThumbDown = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/>
    <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
  </svg>
);
const IconX = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
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
const IconRocket = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
  </svg>
);
const IconAlertCircle = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

export default function FitPage() {
  const router = useRouter();
  const [step, setStep] = useState<FitStep>('person');
  const [measurements, setMeasurements] = useState<Measurements | null>(null);
  const [mounted, setMounted] = useState(false);

  // 신체 사진 상태
  const [personBase64, setPersonBase64] = useState<string>('');
  const [personPreviewUrl, setPersonPreviewUrl] = useState<string>('');
  const [hasLastPerson, setHasLastPerson] = useState(false);

  // 옷 상태
  const [garmentMode, setGarmentMode] = useState<'url' | 'photo'>('url');
  const [garmentUrl, setGarmentUrl] = useState('');
  const [garmentBase64, setGarmentBase64] = useState<string>('');
  const [garmentPreviewUrl, setGarmentPreviewUrl] = useState<string>('');
  const [category, setCategory] = useState<FitCategory>('tops');

  // AI 피팅 상태
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [resultImageUrl, setResultImageUrl] = useState<string>('');
  const [pmfFeedback, setPmfFeedback] = useState<'yes' | 'no' | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const [consented, setConsentedState] = useState(false);
  const [ageConfirmed, setAgeConfirmedState] = useState(false); // 만 14세 이상 확인 (PIPA §22)
  const [sizeRecommendation, setSizeRecommendation] = useState<string>('');

  const resultImgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setMounted(true);
    const m = loadMeasurements();
    setMeasurements(m);
    const last = loadLastPersonImage();
    if (last) setHasLastPerson(true);
    setConsentedState(isConsented());
    setAgeConfirmedState(isAgeConfirmed());
  }, []);

  // ── 신체 사진 촬영/선택 ──
  const handleCaptureCamera = async () => {
    setError('');
    try {
      const result = await captureImage('camera');
      setPersonBase64(result.base64);
      setPersonPreviewUrl(result.dataUrl);
    } catch (e) {
      const err = e as Error;
      if (!err.message.includes('취소')) {
        setError('카메라 오류: ' + err.message);
      }
    }
  };

  const handleCaptureGallery = async () => {
    setError('');
    try {
      const result = await captureImage('gallery');
      setPersonBase64(result.base64);
      setPersonPreviewUrl(result.dataUrl);
    } catch (e) {
      const err = e as Error;
      if (!err.message.includes('취소')) {
        setError('갤러리 오류: ' + err.message);
      }
    }
  };

  const handlePersonFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) { setError(validationError); return; }
    setError('');

    // 안정적인 data URL만 사용 (objectURL revoke 레이스로 인한 ERR_FILE_NOT_FOUND 방지)
    fileToBase64(file).then(b64 => {
      setPersonBase64(b64);
      setPersonPreviewUrl(`data:${file.type};base64,${b64}`);
    }).catch(() => setError('이미지를 읽는 중 오류가 발생했습니다.'));
  };

  const handleUseLastPerson = () => {
    const last = loadLastPersonImage();
    if (!last) return;
    setPersonBase64(last);
    setPersonPreviewUrl(`data:image/jpeg;base64,${last}`);
  };

  // ── 옷 사진 ──
  const handleGarmentFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) { setError(validationError); return; }
    setError('');

    // 안정적인 data URL만 사용 (objectURL revoke 레이스로 인한 ERR_FILE_NOT_FOUND 방지)
    fileToBase64(file).then(b64 => {
      setGarmentBase64(b64);
      setGarmentPreviewUrl(`data:${file.type};base64,${b64}`);
    }).catch(() => setError('이미지를 읽는 중 오류가 발생했습니다.'));
  };

  const handleGarmentCamera = async () => {
    setError('');
    try {
      const result = await captureImage('camera');
      setGarmentBase64(result.base64);
      setGarmentPreviewUrl(result.dataUrl);
    } catch (e) {
      const err = e as Error;
      if (!err.message.includes('취소')) {
        setError('카메라 오류: ' + err.message);
      }
    }
  };

  const handleGarmentGallery = async () => {
    setError('');
    try {
      const result = await captureImage('gallery');
      setGarmentBase64(result.base64);
      setGarmentPreviewUrl(result.dataUrl);
    } catch (e) {
      const err = e as Error;
      if (!err.message.includes('취소')) {
        setError('갤러리 오류: ' + err.message);
      }
    }
  };

  // ── 피팅 실행 ──
  const canStartFit = (): boolean => {
    if (!personBase64) return false;
    if (garmentMode === 'url') {
      return !validateImageUrl(garmentUrl);
    }
    return !!garmentBase64;
  };

  const handleStartFit = () => {
    if (!canStartFit()) return;
    if (!consented) { setShowConsent(true); return; }
    doFit();
  };

  const handleConsentAndFit = () => {
    // 만 14세 이상 확인 미체크 시 진행 불가 (PIPA §22)
    if (!ageConfirmed) return;
    setConsented();
    setConsentedState(true);
    setAgeConfirmed();
    setShowConsent(false);
    doFit();
  };

  const doFit = async () => {
    if (!canStartFit()) return;
    setError('');
    setResultImageUrl('');
    setIsLoading(true);
    setPmfFeedback(null);
    setSizeRecommendation('');

    try {
      saveLastPersonImage(personBase64);

      const isGarmentBase64 = garmentMode === 'photo' && !!garmentBase64;
      const garmentParam = isGarmentBase64 ? garmentBase64 : garmentUrl;

      const result = await requestTryOnFit(personBase64, garmentParam, category, isGarmentBase64);
      setResultImageUrl(result.output_image_url);

      if (measurements) {
        setSizeRecommendation(calcRecommendedSize(measurements, category));
      }

      setStep('result');

      // 히스토리 저장
      saveFitHistory({
        id: Date.now().toString(),
        timestamp: Date.now(),
        resultImageUrl: result.output_image_url,
        garmentImageUrl: garmentParam,
        category,
      });
    } catch (e) {
      const err = e as Error;
      setError(err.message || 'AI 피팅 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── 결과 저장 ──
  const handleSaveResult = async () => {
    if (!resultImageUrl) return;
    try {
      // cross-origin 이미지는 <a download>가 무시되므로 blob으로 받아 저장
      const res = await fetch(resultImageUrl);
      if (!res.ok) throw new Error('이미지를 불러올 수 없습니다.');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `myfit_result_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // 다운로드 실패(CORS 등) 시 새 탭에서 열기
      window.open(resultImageUrl, '_blank');
    }
  };

  const handleRetry = () => {
    setStep('person');
    setResultImageUrl('');
    setError('');
    setPmfFeedback(null);
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

      {/* 동의 모달 (TryOnCloud 국외 이전 동의 — CLO/CISO 필수) */}
      {showConsent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="consent-modal-title"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div style={{ background: 'var(--myfit-surface)', borderRadius: '20px 20px 0 0', padding: '28px 24px 40px', width: '100%', maxWidth: 480, border: '1px solid var(--myfit-border)', boxShadow: '0 -4px 24px rgba(0,0,0,0.10)' }}>
            <div id="consent-modal-title" style={{ fontSize: 18, fontWeight: 800, color: 'var(--myfit-text)', marginBottom: 8 }}>핏 예측 시작 전 동의</div>
            <div style={{ fontSize: 13, color: 'var(--myfit-text-sub)', marginBottom: 20, lineHeight: 1.6 }}>
              서비스 이용을 위해 아래 항목에 동의해 주세요.
            </div>
            {[
              { label: '[필수] 개인정보 처리방침 동의', desc: '신체 치수는 이 기기에만 저장됩니다. 전체 방침: kgg2512.github.io/MyFit/v2/privacy/' },
              { label: '[필수] AI 피팅 국외이전 동의 (신체 사진 — PIPA 제28조의8)', desc: '신체 사진은 AI 피팅 처리를 위해 인도 소재 TryOnCloud 서버로 전송됩니다. 원본 사진은 처리 후 즉시 삭제, 피팅 결과 이미지는 최대 7일 후 삭제됩니다. 동의를 철회하려면 AI 피팅 기능을 이용하지 않으시면 됩니다.' },
              { label: '[필수] 제휴 마케팅 링크 고지 동의', desc: '이 서비스는 쿠팡파트너스 활동의 일환으로 수수료를 받을 수 있습니다.' },
            ].map((item) => (
              <div key={item.label} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <span style={{ color: 'var(--myfit-primary)', marginTop: 2, flexShrink: 0 }}>{IconCheck}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--myfit-text)' }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--myfit-text-sub)', marginTop: 2 }}>{item.desc}</div>
                </div>
              </div>
            ))}

            {/* [필수] 만 14세 이상 확인 — 사용자가 직접 체크해야 진행 가능 (PIPA §22) */}
            <label
              htmlFor="age-confirm-fit"
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%',
                marginBottom: 6, cursor: 'pointer', minHeight: 44,
              }}
            >
              <input
                id="age-confirm-fit"
                type="checkbox"
                checked={ageConfirmed}
                onChange={e => setAgeConfirmedState(e.target.checked)}
                style={{ width: 22, height: 22, flexShrink: 0, marginTop: 1, accentColor: 'var(--myfit-primary)' }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--myfit-text)' }}>[필수] 본인은 만 14세 이상입니다</div>
                <div style={{ fontSize: 11, color: 'var(--myfit-text-sub)', marginTop: 2 }}>만 14세 미만은 본 서비스를 이용할 수 없습니다.</div>
              </div>
            </label>

            <button
              className="btn-primary"
              style={{ marginTop: 8, opacity: ageConfirmed ? 1 : 0.45 }}
              onClick={handleConsentAndFit}
              disabled={!ageConfirmed}
            >
              전체 동의하고 핏 예측 시작
            </button>
            <button
              style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: 'var(--myfit-text-muted)', fontSize: 13, padding: '8px 0', minHeight: 44, cursor: 'pointer' }}
              onClick={() => setShowConsent(false)}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 데모 모드 배너 (데모 빌드에서만, 컴포넌트 내부가 판정) */}
      <DemoBanner />

      {/* 헤더 */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px 8px' }}>
        <button
          onClick={() => {
            if (step === 'result') { setStep('garment'); return; }
            if (step === 'garment') { setStep('person'); return; }
            router.push('/');
          }}
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
        <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--myfit-text)' }}>
          {step === 'person' ? 'STEP 1: 내 사진' : step === 'garment' ? 'STEP 2: 옷 이미지' : '핏 예측 결과'}
        </span>
      </header>

      {/* 단계 인디케이터 */}
      <div style={{ padding: '8px 20px 16px', display: 'flex', gap: 6, alignItems: 'center' }}>
        {(['person', 'garment', 'result'] as FitStep[]).map((s, idx) => (
          <div
            key={s}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: step === s
                ? 'var(--myfit-primary)'
                : idx < (['person', 'garment', 'result'] as FitStep[]).indexOf(step)
                ? 'var(--myfit-cta)'
                : 'var(--myfit-border)',
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>

      <div className="scroll-area" style={{ flex: 1, padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* 에러 메시지 */}
        {error && (
          <div
            role="alert"
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 10,
              padding: '12px 16px',
              fontSize: 13,
              color: '#dc2626',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <span style={{ flexShrink: 0, marginTop: 1 }}>{IconAlertCircle}</span>
            {error}
          </div>
        )}

        {/* 스텝 전환: 단일 컨테이너 내부 크로스페이드 (라우팅 없이 연속 전환) */}
        <div key={step} className="mf-step" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* ─── STEP 1: 신체 사진 ─── */}
        {step === 'person' && (
          <>
            <div style={{ fontSize: 14, color: 'var(--myfit-text-sub)', lineHeight: 1.6 }}>
              전신 또는 상반신 <strong style={{ color: 'var(--myfit-text)' }}>정면 사진</strong>을 선택해 주세요.<br />
              정면 사진일수록 핏 예측 결과가 정확합니다.
            </div>

            {/* 미리보기 */}
            {personPreviewUrl ? (
              <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--myfit-border)', position: 'relative' }}>
                <img
                  src={personPreviewUrl}
                  alt="내 사진 미리보기"
                  loading="lazy"
                  style={{ width: '100%', maxHeight: 320, objectFit: 'cover' }}
                />
                <button
                  onClick={() => { setPersonBase64(''); setPersonPreviewUrl(''); }}
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    width: 44, height: 44, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.9)',
                    border: '1px solid var(--myfit-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--myfit-text)',
                  }}
                  aria-label="사진 제거"
                >
                  {IconX}
                </button>
              </div>
            ) : (
              <div
                style={{
                  height: 200,
                  border: '2px dashed var(--myfit-border-strong)',
                  borderRadius: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: 'var(--myfit-surface2)',
                  color: 'var(--myfit-text-muted)',
                }}
              >
                {IconUser}
                <span style={{ fontSize: 13, color: 'var(--myfit-text-muted)' }}>사진을 선택해 주세요</span>
              </div>
            )}

            {/* 촬영/선택 버튼들 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn-secondary" onClick={handleCaptureCamera} style={{ gap: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span>{IconCamera}</span> 카메라로 촬영
              </button>
              <button className="btn-secondary" onClick={handleCaptureGallery} style={{ gap: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span>{IconImage}</span> 갤러리에서 선택
              </button>

              {/* 파일 입력 (웹 폴백 — 위 버튼이 이미 처리하므로 숨겨진 형태) */}
              <label
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 10, height: 48, borderRadius: 12,
                  background: 'var(--myfit-surface2)', border: '1px solid var(--myfit-border)',
                  fontSize: 15, color: 'var(--myfit-text)', cursor: 'pointer',
                }}
              >
                <span>{IconFile}</span> 파일로 선택
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePersonFileInput}
                  style={{ display: 'none' }}
                  aria-label="신체 사진 파일 선택"
                />
              </label>

              {/* 마지막 사진 재사용 */}
              {hasLastPerson && (
                <button
                  className="btn-secondary"
                  onClick={handleUseLastPerson}
                  style={{ gap: 10, borderColor: 'var(--myfit-primary)', color: 'var(--myfit-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <span>{IconRefresh}</span> 지난번 사진 재사용
                </button>
              )}
            </div>

            {/* 개인정보 안내 */}
            <div style={{ fontSize: 11, color: 'var(--myfit-text-muted)', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <span>{IconShield}</span>
              사진은 TryOnCloud 서버 처리 후 즉시 삭제됩니다. 이 기기에만 임시 보관됩니다.
            </div>

            {/* 다음 단계 버튼 */}
            <button
              className="btn-primary"
              onClick={() => setStep('garment')}
              disabled={!personBase64}
            >
              다음: 옷 이미지 선택 →
            </button>
          </>
        )}

        {/* ─── STEP 2: 옷 이미지 ─── */}
        {step === 'garment' && (
          <>
            <div style={{ fontSize: 14, color: 'var(--myfit-text-sub)', lineHeight: 1.6 }}>
              핏을 확인할 옷 이미지를 선택해 주세요.<br />
              쇼핑몰 상품 이미지 URL을 붙여넣거나 직접 촬영하세요.
            </div>

            {/* URL vs 사진 토글 */}
            <div style={{ display: 'flex', background: 'var(--myfit-surface2)', borderRadius: 10, padding: 4, gap: 4, border: '1px solid var(--myfit-border)' }}>
              {(['url', 'photo'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setGarmentMode(mode)}
                  style={{
                    flex: 1, height: 40, borderRadius: 8,
                    background: garmentMode === mode ? 'var(--myfit-surface)' : 'transparent',
                    border: garmentMode === mode ? '1px solid var(--myfit-border-strong)' : '1px solid transparent',
                    fontSize: 14, fontWeight: garmentMode === mode ? 700 : 400,
                    color: garmentMode === mode ? 'var(--myfit-text)' : 'var(--myfit-text-muted)',
                    transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  {mode === 'url'
                    ? <><span>{IconLink}</span> URL 입력</>
                    : <><span>{IconCamera}</span> 직접 촬영</>
                  }
                </button>
              ))}
            </div>

            {/* URL 입력 모드 */}
            {garmentMode === 'url' && (
              <div>
                <label style={{ fontSize: 12, color: 'var(--myfit-text-sub)', display: 'block', marginBottom: 8, fontWeight: 600 }}>
                  상품 이미지 URL (https://...)
                </label>
                <input
                  type="url"
                  value={garmentUrl}
                  onChange={e => setGarmentUrl(e.target.value)}
                  placeholder="https://image.musinsa.com/..."
                  inputMode="url"
                  style={{ height: 48 }}
                />
                {garmentUrl && !validateImageUrl(garmentUrl) && (
                  <div style={{ marginTop: 12, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--myfit-border)' }}>
                    <img
                      src={garmentUrl}
                      alt="옷 이미지 미리보기"
                      loading="lazy"
                      style={{ width: '100%', maxHeight: 200, objectFit: 'contain', background: 'var(--myfit-surface2)' }}
                      onError={() => setError('이미지를 불러올 수 없습니다. URL을 확인해 주세요.')}
                    />
                  </div>
                )}
              </div>
            )}

            {/* 사진 촬영 모드 */}
            {garmentMode === 'photo' && (
              <>
                {garmentPreviewUrl ? (
                  <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--myfit-border)', position: 'relative' }}>
                    <img
                      src={garmentPreviewUrl}
                      alt="옷 사진 미리보기"
                      loading="lazy"
                      style={{ width: '100%', maxHeight: 280, objectFit: 'contain', background: 'var(--myfit-surface2)' }}
                    />
                    <button
                      onClick={() => { setGarmentBase64(''); setGarmentPreviewUrl(''); }}
                      style={{
                        position: 'absolute', top: 8, right: 8,
                        width: 44, height: 44, borderRadius: '50%',
                        background: 'rgba(255,255,255,0.9)',
                        border: '1px solid var(--myfit-border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--myfit-text)',
                      }}
                      aria-label="사진 제거"
                    >
                      {IconX}
                    </button>
                  </div>
                ) : (
                  <div
                    style={{
                      height: 180,
                      border: '2px dashed var(--myfit-border-strong)',
                      borderRadius: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      background: 'var(--myfit-surface2)',
                      color: 'var(--myfit-text-muted)',
                    }}
                  >
                    {IconShirt}
                    <span style={{ fontSize: 13, color: 'var(--myfit-text-muted)' }}>옷 사진을 선택해 주세요</span>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button className="btn-secondary" onClick={handleGarmentCamera} style={{ gap: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span>{IconCamera}</span> 카메라로 촬영
                  </button>
                  <button className="btn-secondary" onClick={handleGarmentGallery} style={{ gap: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span>{IconImage}</span> 갤러리에서 선택
                  </button>
                  <label
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 10, height: 48, borderRadius: 12,
                      background: 'var(--myfit-surface2)', border: '1px solid var(--myfit-border)',
                      fontSize: 15, color: 'var(--myfit-text)', cursor: 'pointer',
                    }}
                  >
                    <span>{IconFile}</span> 파일로 선택
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleGarmentFileInput}
                      style={{ display: 'none' }}
                      aria-label="옷 사진 파일 선택"
                    />
                  </label>
                </div>
              </>
            )}

            {/* 카테고리 선택 */}
            <div>
              <label style={{ fontSize: 12, color: 'var(--myfit-text-sub)', display: 'block', marginBottom: 8, fontWeight: 600 }}>
                의류 카테고리
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {CATEGORY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setCategory(opt.value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px', borderRadius: 10, height: 'auto',
                      background: category === opt.value ? 'var(--myfit-primary-soft)' : 'var(--myfit-surface2)',
                      border: `1px solid ${category === opt.value ? 'var(--myfit-primary)' : 'var(--myfit-border)'}`,
                      color: category === opt.value ? 'var(--myfit-primary)' : 'var(--myfit-text-sub)',
                      textAlign: 'left', fontSize: 14,
                    }}
                  >
                    <div
                      style={{
                        width: 18, height: 18, borderRadius: '50%',
                        border: `2px solid ${category === opt.value ? 'var(--myfit-primary)' : 'var(--myfit-border-strong)'}`,
                        background: category === opt.value ? 'var(--myfit-primary)' : 'transparent',
                        flexShrink: 0,
                      }}
                    />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 로딩 */}
            {isLoading && <LoadingSteps isActive={isLoading} />}

            {/* 피팅 시작 버튼 */}
            {!isLoading && (
              <button
                className="btn-primary"
                onClick={handleStartFit}
                disabled={!canStartFit()}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <span>{IconRocket}</span> 핏 예측 시작
              </button>
            )}
          </>
        )}

        {/* ─── STEP 3: 결과 ─── */}
        {step === 'result' && (
          <>
            {/* 결과 이미지 */}
            <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--myfit-border)' }}>
              <img
                ref={resultImgRef}
                src={resultImageUrl}
                alt="핏 예측 결과 이미지"
                loading="lazy"
                style={{ width: '100%', objectFit: 'contain', background: 'var(--myfit-surface2)' }}
              />
            </div>

            <div style={{ fontSize: 11, color: 'var(--myfit-text-muted)', textAlign: 'center' }}>
              AI 생성 이미지입니다. 실제 착용과 차이가 있을 수 있습니다.
            </div>

            {/* PMF 피드백 */}
            {!pmfFeedback && (
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--myfit-text)', marginBottom: 14, textAlign: 'center' }}>
                  이 핏 예측 결과, 구매에 도움이 됐나요?
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setPmfFeedback('yes')}
                    style={{
                      flex: 1, height: 48, borderRadius: 10,
                      background: '#f0fdf4', border: '1px solid #bbf7d0',
                      color: '#16a34a', fontSize: 14, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    <span>{IconThumbUp}</span> 도움 됐어요
                  </button>
                  <button
                    onClick={() => setPmfFeedback('no')}
                    style={{
                      flex: 1, height: 48, borderRadius: 10,
                      background: 'var(--myfit-surface2)', border: '1px solid var(--myfit-border)',
                      color: 'var(--myfit-text-sub)', fontSize: 14,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    <span>{IconThumbDown}</span> 별로예요
                  </button>
                </div>
              </div>
            )}

            {pmfFeedback && (
              <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--myfit-text-sub)', padding: '8px 0' }}>
                {pmfFeedback === 'yes' ? '피드백 감사합니다!' : '개선하겠습니다. 감사합니다.'}
              </div>
            )}

            {/* 액션 버튼 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn-primary" onClick={handleSaveResult} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span>{IconDownload}</span> 결과 저장
              </button>
              <button className="btn-secondary" onClick={handleRetry} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span>{IconRefresh}</span> 다시 하기
              </button>
            </div>

            {/* 사이즈 추천 */}
            {sizeRecommendation && (
              <div style={{ background: 'var(--myfit-primary-soft)', border: '1px solid #a5f0fc', borderRadius: 12, padding: '14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color: 'var(--myfit-primary)' }}>{IconRuler}</span>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--myfit-text-sub)' }}>체형 기반 추천 사이즈</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--myfit-primary)', letterSpacing: '-0.5px' }}>{sizeRecommendation}</div>
                </div>
              </div>
            )}

            {/* 치수 정보 (있을 때) */}
            {measurements && (
              <div className="card" style={{ padding: '14px' }}>
                <div style={{ fontSize: 12, color: 'var(--myfit-text-sub)', marginBottom: 10, fontWeight: 600 }}>내 치수</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    { label: '키', value: measurements.height, unit: 'cm' },
                    { label: '몸무게', value: measurements.weight, unit: 'kg' },
                    { label: '가슴', value: measurements.chest, unit: 'cm' },
                    { label: '허리', value: measurements.waist, unit: 'cm' },
                  ].map(item => (
                    <div
                      key={item.label}
                      style={{
                        background: 'var(--myfit-surface2)', borderRadius: 8,
                        padding: '6px 12px', border: '1px solid var(--myfit-border)',
                        display: 'flex', gap: 4, alignItems: 'baseline',
                      }}
                    >
                      <span style={{ fontSize: 11, color: 'var(--myfit-text-sub)' }}>{item.label}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--myfit-primary)' }}>{item.value}</span>
                      <span style={{ fontSize: 10, color: 'var(--myfit-text-muted)' }}>{item.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 쿠팡파트너스 고지 */}
            <div style={{ fontSize: 11, color: 'var(--myfit-text-muted)', textAlign: 'center' }}>
              쿠팡파트너스 제휴 링크 — 구매 시 수수료가 발생할 수 있습니다. 사용자 추가 비용 없음.
            </div>
          </>
        )}
        </div>
      </div>
    </main>
  );
}
