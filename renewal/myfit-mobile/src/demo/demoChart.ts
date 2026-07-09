/**
 * 데모 사이즈표 — 데모 빌드 전용(무신사 나시 M/L/XL/XXL, P2 라이브 검증 실측).
 * 스토어 빌드에서는 process.env.NEXT_PUBLIC_DEMO_MODE 리터럴('true' 아님)로
 * getDemoFitInput() 본문이 `return null`만 남고 아래 실측 데이터 리터럴은
 * dead-code로 제거된다(DemoGate/DemoBanner와 동일 tree-shaking 패턴).
 * → 데모 사이즈표 데이터가 스토어 산출물에 남지 않는다.
 */

import type { GarmentSizeChart } from '@/lib/fitEngine';

export interface DemoFitInput {
  productName: string;
  chart: GarmentSizeChart;
}

export function getDemoFitInput(): DemoFitInput | null {
  // 모듈 로컬 process.env 직접 참조 — 스토어 빌드에서 아래 리터럴 dead-code 제거.
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') return null;
  return {
    productName: '무신사 나시 (데모)',
    chart: {
      category: 'sleeveless',
      unit: 'cm',
      measureKeys: ['총장', '가슴단면', '어깨너비'],
      sizes: [
        { size: 'M', 총장: 70.5, 가슴단면: 53.5, 어깨너비: 43.5 },
        { size: 'L', 총장: 72, 가슴단면: 56, 어깨너비: 45 },
        { size: 'XL', 총장: 73.5, 가슴단면: 58.5, 어깨너비: 46.5 },
        { size: 'XXL', 총장: 75, 가슴단면: 61, 어깨너비: 48 },
      ],
      stretch: '약간 있음',
    },
  };
}
