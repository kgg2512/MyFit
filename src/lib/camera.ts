/**
 * Capacitor 카메라 유틸리티
 * SSR-safe — typeof window 체크 + 동적 임포트
 */

'use client';

export interface CameraImageResult {
  base64: string;        // prefix 없는 순수 base64
  mimeType: string;      // 'image/jpeg' 등
  dataUrl: string;       // data:image/jpeg;base64,XXX
}

export type CameraSourceType = 'camera' | 'gallery';

/**
 * Capacitor Camera 플러그인으로 이미지 캡처
 * 웹 환경(Next.js dev / 정적 빌드 미리보기)에서는 file input 폴백 사용
 */
export async function captureImage(source: CameraSourceType): Promise<CameraImageResult> {
  if (typeof window === 'undefined') {
    throw new Error('카메라는 브라우저 환경에서만 사용할 수 있습니다.');
  }

  // Capacitor 런타임 체크 — 네이티브 빌드에서만 작동
  const isCapacitorNative =
    typeof (window as Record<string, unknown>)['Capacitor'] !== 'undefined' &&
    (window as Record<string, unknown>)['Capacitor'] !== null;

  if (isCapacitorNative) {
    return captureWithCapacitor(source);
  }

  // 웹 폴백: file input 트리거
  return captureWithFileInput(source);
}

async function captureWithCapacitor(source: CameraSourceType): Promise<CameraImageResult> {
  // 동적 임포트 — 네이티브 환경에서만 로드
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');

  const photo = await Camera.getPhoto({
    quality: 85,
    allowEditing: false,
    resultType: CameraResultType.Base64,
    source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
    saveToGallery: false, // CISO: 신체 사진 자동 저장 금지
  });

  const base64 = photo.base64String ?? '';
  const mimeType = photo.format === 'png' ? 'image/png' : 'image/jpeg';

  return {
    base64,
    mimeType,
    dataUrl: `data:${mimeType};base64,${base64}`,
  };
}

function captureWithFileInput(source: CameraSourceType): Promise<CameraImageResult> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    if (source === 'camera') {
      input.capture = 'user'; // 전면 카메라 우선
    }

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('파일을 선택하지 않았습니다.'));
        return;
      }

      try {
        const base64 = await fileToBase64Web(file);
        const dataUrl = `data:${file.type};base64,${base64}`;
        resolve({ base64, mimeType: file.type, dataUrl });
      } catch (e) {
        reject(e);
      }
    };

    input.oncancel = () => reject(new Error('사진 선택이 취소됐습니다.'));
    input.click();
  });
}

function fileToBase64Web(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      if (!base64) { reject(new Error('base64 변환 실패')); return; }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.readAsDataURL(file);
  });
}

/**
 * base64 데이터URL → Blob (미리보기용 objectURL 생성 시 사용)
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}
