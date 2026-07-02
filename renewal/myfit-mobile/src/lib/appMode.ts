/**
 * 앱 실행 모드 — 단일 소스 (빌드타임 env로 결정, 런타임 불변).
 * NEXT_PUBLIC_DEMO_MODE=true → 데모 빌드 (CF Worker 호출 없이 샘플 이미지·seed 데이터).
 * false → 스토어 빌드 (실 백엔드).
 * process.env.NEXT_PUBLIC_* 는 빌드 시 리터럴로 치환되므로, 스토어 빌드에서는
 * `if (DEMO_MODE)` 분기와 그 안의 데모 코드가 dead-code로 제거된다.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
