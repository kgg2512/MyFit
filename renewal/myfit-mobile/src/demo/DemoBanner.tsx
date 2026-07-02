/**
 * 데모 모드 배너 — 데모 빌드에서만 표시. 스토어 빌드에서는 DEMO_MODE=false 리터럴로
 * 항상 null 반환 → minifier가 아래 JSX(배너 텍스트 포함)를 dead-code로 제거한다.
 */

'use client';

const IconDemo = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
    <polyline points="17 2 12 7 7 2" />
  </svg>
);

export default function DemoBanner() {
  // 모듈 로컬 process.env 직접 참조 — 스토어 빌드(false)에서 아래 JSX가 minifier로 dead-code 제거됨.
  // (appMode.DEMO_MODE를 import하면 'use client' 모듈 경계로 리터럴 치환이 전파되지 않아 제거 실패)
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') return null;
  return (
    <div style={{ background: 'var(--myfit-primary-soft)', borderBottom: '1px solid #a5f0fc', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: 'var(--myfit-primary)', flexShrink: 0 }}>{IconDemo}</span>
      <span style={{ fontSize: 12, color: 'var(--myfit-primary)', fontWeight: 600 }}>데모 버전 — 핏 예측 결과는 샘플입니다</span>
    </div>
  );
}
