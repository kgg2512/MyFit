/**
 * FASHN AI API 유틸리티
 * CF Worker 프록시를 통해 호출 — API Key 직접 노출 금지 (CISO 보안 요건)
 * panel.js requestFashnFit() 로직을 TypeScript로 포팅
 */

'use client';

export const CF_WORKER_URL =
  process.env.NEXT_PUBLIC_CF_WORKER_URL ||
  'https://myfit-fashn-proxy.kgg2512.workers.dev';

// NEXT_PUBLIC_DEMO_MODE=true 이면 데모 버전 (CF Worker 호출 없음)
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export type FitCategory = 'tops' | 'bottoms';

export interface FashnResult {
  output_image_url: string;
}

export interface FashnError {
  message: string;
  code?: string;
  retryAfter?: number;
}

// ── base64 변환 ──

/**
 * blob: / data: URL → base64 문자열 (prefix 제거)
 */
export async function blobUrlToBase64(blobUrl: string): Promise<string> {
  const res = await fetch(blobUrl);
  const blob = await res.blob();
  return blobToBase64(blob);
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new Error('base64 변환 실패'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.readAsDataURL(blob);
  });
}

/**
 * File 객체 → base64
 */
export function fileToBase64(file: File): Promise<string> {
  return blobToBase64(file);
}

// ── FASHN AI 피팅 요청 ──

/**
 * FASHN AI 가상 피팅 요청
 * @param humanImageBase64      - 사용자 사진 base64 (prefix 없음)
 * @param garmentImageUrlOrB64  - 쇼핑몰 URL (https://) 또는 base64 문자열
 * @param category              - tops | bottoms
 * @param isGarmentBase64       - true이면 garmentImageUrlOrB64를 base64로 전송
 */
export async function requestFashnFit(
  humanImageBase64: string,
  garmentImageUrlOrB64: string,
  category: FitCategory,
  isGarmentBase64 = false
): Promise<FashnResult> {
  // 데모 모드: 3.5초 로딩 시뮬레이션 후 옷 이미지를 결과로 반환
  if (DEMO_MODE) {
    await new Promise(r => setTimeout(r, 3500));
    const demoUrl = isGarmentBase64
      ? `data:image/jpeg;base64,${garmentImageUrlOrB64}`
      : garmentImageUrlOrB64;
    return { output_image_url: demoUrl };
  }

  const bodyPayload = isGarmentBase64
    ? { human_image: humanImageBase64, garment_image_base64: garmentImageUrlOrB64, category }
    : { human_image: humanImageBase64, garment_image_url: garmentImageUrlOrB64, category };

  const response = await fetch(`${CF_WORKER_URL}/try-on`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyPayload),
  });

  let data: Record<string, unknown> = {};
  try {
    data = await response.json();
  } catch {
    throw new Error(`서버 응답 파싱 실패 (${response.status})`);
  }

  if (!response.ok) {
    if (response.status === 402 || data['code'] === 'CREDITS_EXHAUSTED') {
      throw new Error('AI 피팅 크레딧이 소진되었습니다. 잠시 후 다시 시도해 주세요.');
    }
    if (response.status === 429) {
      const wait = data['retryAfter'] ? `${data['retryAfter']}초 후` : '잠시 후';
      throw new Error(`요청이 너무 많습니다. ${wait} 다시 시도해 주세요.`);
    }
    throw new Error((data['error'] as string) || `서버 오류 (${response.status})`);
  }

  const outputUrl = data['output_image_url'] as string | undefined;
  if (!outputUrl) {
    throw new Error('AI 피팅 결과를 받지 못했습니다.');
  }

  return { output_image_url: outputUrl };
}

// ── 이미지 유효성 검사 ──

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) {
    return '이미지 파일만 업로드 가능합니다.';
  }
  if (file.size > MAX_SIZE_BYTES) {
    return '이미지 파일 크기는 5MB 이하여야 합니다.';
  }
  return null;
}

export function validateImageUrl(url: string): string | null {
  if (!url || !url.startsWith('https://')) {
    return '유효한 https:// 이미지 URL을 입력해 주세요.';
  }
  return null;
}

// ── 로딩 단계 정의 ──

export interface LoadingStep {
  label: string;
  tip: string;
  barPercent: number;
  delayMs: number;
}

export const LOADING_STEPS: LoadingStep[] = [
  { label: '사진 분석 중',      tip: '정면 사진일수록 결과가 정확합니다',     barPercent: 10, delayMs: 0 },
  { label: '옷 패턴 매핑',      tip: 'AI가 의류의 질감과 형태를 분석합니다',  barPercent: 45, delayMs: 7000 },
  { label: '피팅 이미지 생성',   tip: '거의 다 됐어요! 잠시만 기다려주세요',  barPercent: 85, delayMs: 18000 },
];
