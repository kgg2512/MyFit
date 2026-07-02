/**
 * 데모 리셋 버튼 — 데모 빌드에서만 표시. 저장 데이터를 초기화하고 온보딩부터 재시연.
 * 스토어 빌드에서는 DEMO_MODE=false 리터럴로 항상 null 반환 → dead-code 제거.
 */

'use client';

import { useRouter } from 'next/navigation';
import { clearAllData } from '@/lib/storage';

const IconRefresh = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" />
  </svg>
);
const IconChevronRight = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export default function DemoReset() {
  const router = useRouter();
  // 모듈 로컬 process.env 직접 참조 — 스토어 빌드에서 아래 JSX가 dead-code 제거됨(DemoBanner 주석 참조).
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') return null;

  const handleDemoReset = () => {
    clearAllData();
    router.push('/onboarding');
  };

  return (
    <button
      onClick={handleDemoReset}
      aria-label="데모 리셋 — 모든 데이터를 지우고 온보딩부터 다시 시작"
      style={{ width: '100%', textAlign: 'left', background: '#fff', border: '1px dashed var(--myfit-border-strong)', borderRadius: 'var(--myfit-radius)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, minHeight: 0 }}
    >
      <span style={{ flexShrink: 0, display: 'flex', color: 'var(--myfit-text-sub)' }}>{IconRefresh}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--myfit-text)' }}>데모 리셋 · 온보딩 다시 보기</div>
        <div style={{ fontSize: 12, color: 'var(--myfit-text-sub)', marginTop: 2 }}>저장 데이터를 초기화하고 첫 사용자 흐름을 처음부터 시연</div>
      </div>
      <span style={{ flexShrink: 0, display: 'flex', color: 'var(--myfit-text-muted)' }}>{IconChevronRight}</span>
    </button>
  );
}
