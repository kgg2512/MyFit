/**
 * 데모 진입 단일 경계 — 데모 seed를 여기 한 곳에서만 실행한다(페이지에서 축출).
 * layout.tsx 최상단에서 렌더되며, 렌더 페이즈 동기 실행이라 페이지 useEffect(데이터 read)보다
 * 먼저 seed가 끝난다(부모가 자식보다 먼저 렌더). seed는 DEMO_SEEDED 마커로 idempotent.
 * 스토어 빌드에서는 DEMO_MODE=false 리터럴로 seed 호출과 import 참조가 dead-code 제거된다.
 * onboarding/privacy 흐름에서는 seed하지 않는다(데모 리셋 후 빈-상태 시연 보존).
 */

'use client';

import { usePathname } from 'next/navigation';
import { seedDemoData } from '@/demo/seed';

export default function DemoGate() {
  const raw = usePathname();
  const path = raw && raw !== '/' ? raw.replace(/\/$/, '') : '/';
  const skip = path === '/onboarding' || path === '/privacy';

  // 모듈 로컬 process.env 직접 참조 — 스토어 빌드(false)에서 seedDemoData 호출과
  // seed 모듈 참조가 dead-code로 제거되어 데모 seed 데이터가 산출물에 남지 않는다.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && typeof window !== 'undefined' && !skip) {
    seedDemoData(process.env.NEXT_PUBLIC_BASE_PATH || '');
  }
  return null;
}
