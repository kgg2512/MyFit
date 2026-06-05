'use client';

import { useState, useEffect, useRef } from 'react';
import {
  requestFashnFit,
  validateImageFile,
  validateImageUrl,
  fileToBase64,
  blobUrlToBase64,
  type FitCategory,
} from '@/lib/fashn';
import {
  captureImage,
  dataUrlToBlob,
} from '@/lib/camera';
import {
  loadMeasurements,
  loadLastPersonImage,
  saveLastPersonImage,
  saveFitHistory,
  type Measurements,
} from '@/lib/storage';
import LoadingSteps from '@/components/LoadingSteps';

// ── 피팅 단계 ──
type FitStep = 'person' | 'garment' | 'result';

// ── 옷 카테고리 ──
const CATEGORY_OPTIONS: { value: FitCategory; label: string }[] = [
  { value: 'tops', label: '상의 (티셔츠, 셔츠, 재킷...)' },
  { value: 'bottoms', label: '하의 (바지, 스커트...)' },
];

export default function FitPage() {
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

  const resultImgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setMounted(true);
    const m = loadMeasurements();
    setMeasurements(m);
    const last = loadLastPersonImage();
    if (last) {
      setHasLastPerson(true);
    }
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

    const objectUrl = URL.createObjectURL(file);
    setPersonPreviewUrl(objectUrl);

    fileToBase64(file).then(b64 => {
      setPersonBase64(b64);
      URL.revokeObjectURL(objectUrl);
    });
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

    const objectUrl = URL.createObjectURL(file);
    setGarmentPreviewUrl(objectUrl);

    fileToBase64(file).then(b64 => {
      setGarmentBase64(b64);
      URL.revokeObjectURL(objectUrl);
    });
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

  const handleStartFit = async () => {
    if (!canStartFit()) return;
    setError('');
    setResultImageUrl('');
    setIsLoading(true);
    setPmfFeedback(null);

    try {
      // 신체 사진 재사용을 위해 저장 (CISO: 로컬 기기에만)
      saveLastPersonImage(personBase64);

      let finalGarmentUrl = garmentUrl;

      // 옷 사진 모드: base64를 CF Worker가 처리할 수 있는 URL로 변환
      // 현재 구현: garment_image_url 대신 garment_image_base64 파라미터로 전달
      // CF Worker가 두 파라미터 중 하나를 처리하도록 해야 함
      // 임시: 옷 사진은 data URL로 직접 전달
      if (garmentMode === 'photo' && garmentBase64) {
        // CF Worker /try-on 엔드포인트에 garment_image_base64 파라미터 추가 필요
        // 현재는 garment_image_url 에 data URI를 넣어 처리 시도
        // 실제 운영에서는 CF Worker 수정 필요
        finalGarmentUrl = `data:image/jpeg;base64,${garmentBase64}`;
      }

      const result = await requestFashnFit(personBase64, finalGarmentUrl, category);
      setResultImageUrl(result.output_image_url);
      setStep('result');

      // 히스토리 저장
      saveFitHistory({
        id: Date.now().toString(),
        timestamp: Date.now(),
        resultImageUrl: result.output_image_url,
        garmentImageUrl: finalGarmentUrl,
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
      const link = document.createElement('a');
      link.href = resultImageUrl;
      link.download = `myfit_result_${Date.now()}.jpg`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      // 다운로드 실패 시 새 탭에서 열기
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
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0a0a0a', minHeight: '100dvh' }}>
      {/* 헤더 */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px 8px' }}>
        <button
          onClick={() => {
            if (step === 'result') { setStep('garment'); return; }
            if (step === 'garment') { setStep('person'); return; }
            window.location.href = '/';
          }}
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
        <span style={{ fontSize: 17, fontWeight: 700, color: '#f0f0f0' }}>
          {step === 'person' ? 'STEP 1: 내 사진' : step === 'garment' ? 'STEP 2: 옷 사진' : 'AI 피팅 결과'}
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
                ? 'linear-gradient(90deg, #00e5ff, #7c4dff)'
                : idx < (['person', 'garment', 'result'] as FitStep[]).indexOf(step)
                ? '#00c853'
                : '#2a2a2a',
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
              background: '#1a0000',
              border: '1px solid #3a0000',
              borderRadius: 10,
              padding: '12px 16px',
              fontSize: 13,
              color: '#ff5252',
            }}
          >
            {error}
          </div>
        )}

        {/* ─── STEP 1: 신체 사진 ─── */}
        {step === 'person' && (
          <>
            <div style={{ fontSize: 14, color: '#888', lineHeight: 1.6 }}>
              전신 또는 상반신 <strong style={{ color: '#f0f0f0' }}>정면 사진</strong>을 선택해 주세요.<br />
              정면 사진일수록 결과가 정확합니다.
            </div>

            {/* 미리보기 */}
            {personPreviewUrl ? (
              <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #2a2a2a', position: 'relative' }}>
                <img
                  src={personPreviewUrl}
                  alt="내 사진 미리보기"
                  style={{ width: '100%', maxHeight: 320, objectFit: 'cover' }}
                />
                <button
                  onClick={() => { setPersonBase64(''); setPersonPreviewUrl(''); }}
                  style={{
                    position: 'absolute', top: 10, right: 10,
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, color: '#fff',
                  }}
                  aria-label="사진 제거"
                >
                  ×
                </button>
              </div>
            ) : (
              <div
                style={{
                  height: 200,
                  border: '2px dashed #2a2a2a',
                  borderRadius: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: '#141414',
                }}
              >
                <span style={{ fontSize: 40 }}>👤</span>
                <span style={{ fontSize: 13, color: '#666' }}>사진을 선택해 주세요</span>
              </div>
            )}

            {/* 촬영/선택 버튼들 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn-secondary" onClick={handleCaptureCamera} style={{ gap: 10 }}>
                <span>📷</span> 카메라로 촬영
              </button>
              <button className="btn-secondary" onClick={handleCaptureGallery} style={{ gap: 10 }}>
                <span>🖼</span> 갤러리에서 선택
              </button>

              {/* 파일 입력 (웹 폴백 — 위 버튼이 이미 처리하므로 숨겨진 형태) */}
              <label
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 10, height: 48, borderRadius: 12,
                  background: '#1e1e1e', border: '1px solid #2a2a2a',
                  fontSize: 15, color: '#f0f0f0', cursor: 'pointer',
                }}
              >
                <span>📁</span> 파일로 선택
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
                  style={{ gap: 10, borderColor: '#00e5ff30', color: '#00e5ff' }}
                >
                  <span>♻️</span> 지난번 사진 재사용
                </button>
              )}
            </div>

            {/* 개인정보 안내 */}
            <div style={{ fontSize: 11, color: '#555', textAlign: 'center' }}>
              🔒 사진은 AI 피팅 처리 후 즉시 삭제됩니다. 서버에 저장되지 않습니다.
            </div>

            {/* 다음 단계 버튼 */}
            <button
              className="btn-primary"
              onClick={() => setStep('garment')}
              disabled={!personBase64}
            >
              다음: 옷 사진 선택 →
            </button>
          </>
        )}

        {/* ─── STEP 2: 옷 이미지 ─── */}
        {step === 'garment' && (
          <>
            <div style={{ fontSize: 14, color: '#888', lineHeight: 1.6 }}>
              입혀볼 옷 이미지를 선택해 주세요.<br />
              쇼핑몰 상품 이미지 URL을 붙여넣거나 직접 촬영하세요.
            </div>

            {/* URL vs 사진 토글 */}
            <div style={{ display: 'flex', background: '#1e1e1e', borderRadius: 10, padding: 4, gap: 4 }}>
              {(['url', 'photo'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setGarmentMode(mode)}
                  style={{
                    flex: 1, height: 40, borderRadius: 8,
                    background: garmentMode === mode ? '#2a2a2a' : 'transparent',
                    border: garmentMode === mode ? '1px solid #3a3a3a' : '1px solid transparent',
                    fontSize: 14, fontWeight: garmentMode === mode ? 700 : 400,
                    color: garmentMode === mode ? '#f0f0f0' : '#888',
                    transition: 'all 0.2s',
                  }}
                >
                  {mode === 'url' ? '🔗 URL 입력' : '📸 직접 촬영'}
                </button>
              ))}
            </div>

            {/* URL 입력 모드 */}
            {garmentMode === 'url' && (
              <div>
                <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 8, fontWeight: 600 }}>
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
                  <div style={{ marginTop: 12, borderRadius: 10, overflow: 'hidden', border: '1px solid #2a2a2a' }}>
                    <img
                      src={garmentUrl}
                      alt="옷 이미지 미리보기"
                      style={{ width: '100%', maxHeight: 200, objectFit: 'contain', background: '#141414' }}
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
                  <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #2a2a2a', position: 'relative' }}>
                    <img
                      src={garmentPreviewUrl}
                      alt="옷 사진 미리보기"
                      style={{ width: '100%', maxHeight: 280, objectFit: 'contain', background: '#141414' }}
                    />
                    <button
                      onClick={() => { setGarmentBase64(''); setGarmentPreviewUrl(''); }}
                      style={{
                        position: 'absolute', top: 10, right: 10,
                        width: 32, height: 32, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.7)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, color: '#fff',
                      }}
                      aria-label="사진 제거"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div
                    style={{
                      height: 180,
                      border: '2px dashed #2a2a2a',
                      borderRadius: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      background: '#141414',
                    }}
                  >
                    <span style={{ fontSize: 40 }}>👗</span>
                    <span style={{ fontSize: 13, color: '#666' }}>옷 사진을 선택해 주세요</span>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button className="btn-secondary" onClick={handleGarmentCamera} style={{ gap: 10 }}>
                    <span>📷</span> 카메라로 촬영
                  </button>
                  <button className="btn-secondary" onClick={handleGarmentGallery} style={{ gap: 10 }}>
                    <span>🖼</span> 갤러리에서 선택
                  </button>
                  <label
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 10, height: 48, borderRadius: 12,
                      background: '#1e1e1e', border: '1px solid #2a2a2a',
                      fontSize: 15, color: '#f0f0f0', cursor: 'pointer',
                    }}
                  >
                    <span>📁</span> 파일로 선택
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
              <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 8, fontWeight: 600 }}>
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
                      background: category === opt.value ? '#001a1f' : '#1e1e1e',
                      border: `1px solid ${category === opt.value ? '#00e5ff40' : '#2a2a2a'}`,
                      color: category === opt.value ? '#00e5ff' : '#888',
                      textAlign: 'left', fontSize: 14,
                    }}
                  >
                    <div
                      style={{
                        width: 18, height: 18, borderRadius: '50%',
                        border: `2px solid ${category === opt.value ? '#00e5ff' : '#2a2a2a'}`,
                        background: category === opt.value ? '#00e5ff' : 'transparent',
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
              >
                AI 피팅 시작 🚀
              </button>
            )}
          </>
        )}

        {/* ─── STEP 3: 결과 ─── */}
        {step === 'result' && (
          <>
            {/* 결과 이미지 */}
            <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #2a2a2a' }}>
              <img
                ref={resultImgRef}
                src={resultImageUrl}
                alt="AI 피팅 결과 이미지"
                style={{ width: '100%', objectFit: 'contain', background: '#141414' }}
              />
            </div>

            <div style={{ fontSize: 11, color: '#555', textAlign: 'center' }}>
              AI 생성 이미지입니다. 실제 착용과 차이가 있을 수 있습니다.
            </div>

            {/* PMF 피드백 */}
            {!pmfFeedback && (
              <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 14, padding: '16px' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f0f0', marginBottom: 14, textAlign: 'center' }}>
                  이 피팅 결과, 구매에 도움이 됐나요?
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setPmfFeedback('yes')}
                    style={{
                      flex: 1, height: 48, borderRadius: 10,
                      background: '#003a1a', border: '1px solid #00c85340',
                      color: '#00c853', fontSize: 14, fontWeight: 700,
                    }}
                  >
                    도움 됐어요 👍
                  </button>
                  <button
                    onClick={() => setPmfFeedback('no')}
                    style={{
                      flex: 1, height: 48, borderRadius: 10,
                      background: '#1e1e1e', border: '1px solid #2a2a2a',
                      color: '#888', fontSize: 14,
                    }}
                  >
                    별로예요 👎
                  </button>
                </div>
              </div>
            )}

            {pmfFeedback && (
              <div style={{ textAlign: 'center', fontSize: 13, color: '#888', padding: '8px 0' }}>
                {pmfFeedback === 'yes' ? '피드백 감사합니다! 😊' : '개선하겠습니다. 감사합니다.'}
              </div>
            )}

            {/* 액션 버튼 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn-primary" onClick={handleSaveResult}>
                결과 저장 💾
              </button>
              <button className="btn-secondary" onClick={handleRetry}>
                다시 하기 🔄
              </button>
            </div>

            {/* 치수 정보 (있을 때) */}
            {measurements && (
              <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 12, padding: '14px' }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 10, fontWeight: 600 }}>내 치수</div>
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
                        background: '#1e1e1e', borderRadius: 8,
                        padding: '6px 12px', border: '1px solid #2a2a2a',
                        display: 'flex', gap: 4, alignItems: 'baseline',
                      }}
                    >
                      <span style={{ fontSize: 11, color: '#888' }}>{item.label}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#00e5ff' }}>{item.value}</span>
                      <span style={{ fontSize: 10, color: '#666' }}>{item.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 쿠팡파트너스 고지 */}
            <div style={{ fontSize: 11, color: '#555', textAlign: 'center' }}>
              쿠팡파트너스 제휴 링크 — 구매 시 수수료가 발생할 수 있습니다. 사용자 추가 비용 없음.
            </div>
          </>
        )}
      </div>
    </main>
  );
}
