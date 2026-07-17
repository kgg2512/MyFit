'use client';

import './globals.css';
import { useEffect } from 'react';
import DemoGate from '@/demo/DemoGate';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // StatusBar 스타일 (Capacitor 네이티브)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cap = (window as unknown as Record<string, unknown>)['Capacitor'];
    if (!cap) return;

    (async () => {
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#0a0a0a' });
      } catch {
        // 웹 환경에서는 무시
      }
    })();
  }, []);

  return (
    <html lang="ko">
      <head>
        <meta charSet="UTF-8" />
        {/* 보안(감사 2026-07-17 CAE 전사 보안감사): meta CSP 백스톱. GitHub Pages는 응답헤더(CSP) 불가 →
            루트 랜딩과 동일한 검증된 posture로 심층방어. Next 정적export는 인라인 부트스트랩 스크립트를
            쓰므로 script-src에 'unsafe-inline' 유지(strict 불가). object-src 'none'·base-uri 'self'·
            외부 script origin 차단이 실이득. connect/font/frame은 Firebase·구글폰트 파손 방지 위해 https 허용. */}
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https:; frame-src 'self' https:; base-uri 'self'; object-src 'none'; form-action 'self'"
        />
        {/* 보안(감사 2026-07-08): 클릭재킹 방어. GitHub Pages는 X-Frame-Options/frame-ancestors
            헤더 불가 → framebusting으로 프레임 탈출(리소스 제약 0, 앱 파손 없음). 네이티브 웹뷰는 self===top이라 무동작. */}
        <script dangerouslySetInnerHTML={{ __html: 'try{if(self!==top)top.location=self.location.href;}catch(e){}' }} />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="theme-color" content="#0a0a0a" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <title>MyFit</title>
      </head>
      <body
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <DemoGate />
        {children}
      </body>
    </html>
  );
}
