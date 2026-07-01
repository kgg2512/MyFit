'use client';

import { useEffect, useState } from 'react';
import { LOADING_STEPS } from '@/lib/tryon';

interface Props {
  isActive: boolean;
  onCancel?: () => void;
}

export default function LoadingSteps({ isActive, onCancel }: Props) {
  const [currentStep, setCurrentStep] = useState(-1);
  const [barPercent, setBarPercent] = useState(5);

  useEffect(() => {
    if (!isActive) {
      setCurrentStep(-1);
      setBarPercent(5);
      return;
    }

    setCurrentStep(0);
    setBarPercent(LOADING_STEPS[0].barPercent);

    const timers: ReturnType<typeof setTimeout>[] = [];

    LOADING_STEPS.forEach((step, idx) => {
      if (idx === 0) return; // 즉시 실행
      timers.push(
        setTimeout(() => {
          setCurrentStep(idx);
          setBarPercent(step.barPercent);
        }, step.delayMs)
      );
    });

    return () => timers.forEach(clearTimeout);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '16px 0', position: 'relative' }}>
      {/* 취소 버튼 */}
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          aria-label="작업 취소"
          style={{
            position: 'absolute', top: 0, right: 0,
            width: 44, height: 44, borderRadius: '50%',
            background: 'rgba(255,255,255,0.10)',
            color: '#f0f0f0',
            border: '1px solid rgba(255,255,255,0.15)',
            cursor: 'pointer',
            fontSize: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×
        </button>
      )}

      {/* 스피너 */}
      <div className="spinner" />

      <div style={{ fontSize: 14, color: '#f0f0f0', fontWeight: 600 }}>
        AI가 옷을 입히는 중... (15–30초)
      </div>

      {/* 단계 표시 */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {LOADING_STEPS.map((step, idx) => {
          const isDone = idx < currentStep;
          const isActive = idx === currentStep;
          return (
            <div
              key={step.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                opacity: idx > currentStep ? 0.3 : 1,
                transition: 'opacity 0.4s',
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: isDone ? '#00c853' : isActive ? '#00e5ff' : '#2a2a2a',
                  border: isActive ? '2px solid #00e5ff' : '2px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  color: isDone ? '#fff' : 'transparent',
                  flexShrink: 0,
                  transition: 'all 0.4s',
                  boxShadow: isActive ? '0 0 8px rgba(0,229,255,0.6)' : 'none',
                }}
              >
                {isDone ? '✓' : ''}
              </div>
              <span
                style={{
                  fontSize: 13,
                  color: isActive ? '#00e5ff' : isDone ? '#888' : '#888',
                  fontWeight: isActive ? 700 : 400,
                }}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* 프로그레스 바 */}
      <div className="loading-bar-track" style={{ width: '100%' }}>
        <div className="loading-bar-fill" style={{ width: `${barPercent}%` }} />
      </div>

      {/* 팁 */}
      <div style={{ fontSize: 12, color: '#666', textAlign: 'center' }}>
        {currentStep >= 0 ? LOADING_STEPS[currentStep].tip : ''}
      </div>
    </div>
  );
}
