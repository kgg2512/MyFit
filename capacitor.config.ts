import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.g2company.myfit',
  appName: 'MyFit',
  webDir: 'out',

  // CISO 보안 요건 (필수)
  server: {
    allowMixedContent: false,
    cleartext: false,
    // FASHN AI API 호출은 반드시 CF Worker 프록시를 통해서만
    // 직접 외부 API 호출 금지 — API Key 노출 방지
  },

  ios: {
    limitsNavigationsToAppBoundDomains: true,
    contentInset: 'automatic',
  },

  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },

  plugins: {
    // 카메라 (신체 사진 촬영 — FASHN AI 피팅용)
    Camera: {
      // saveToGallery: false (신체 사진 자동 저장 금지 — CISO 지시)
    },

    // 상태바
    StatusBar: {
      style: 'light',
      backgroundColor: '#000000',
    },

    SplashScreen: {
      launchShowDuration: 2500,
      backgroundColor: '#000000',
      showSpinner: false,
    },
  },
};

export default config;
