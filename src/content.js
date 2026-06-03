/**
 * MyFit Chrome Extension — Content Script
 *
 * 책임:
 *  - 쇼핑몰 상품 페이지에서 상품 정보 감지
 *  - "MyFit으로 피팅" 버튼 주입
 *  - 감지한 상품 데이터를 background로 전달 (서버 전송 금지)
 *
 * 보안 제약 (CLO/CISO):
 *  - innerHTML 사용 금지 → DOM API 직접 사용
 *  - 상품 데이터 G2 서버 전송 금지
 *  - eval() 사용 금지
 *  - 쇼핑몰 사이즈 차트 DOM 스크래핑 금지
 */

(function () {
  'use strict';

  // ── 중복 실행 방지 ──
  if (window.__myfit_injected) return;
  window.__myfit_injected = true;

  // ── 쇼핑몰별 상품 파서 (URL 기반 라우팅) ──
  const PARSERS = {
    'musinsa.com': parseMusinsa,
    'nike.com': parseNike,
    'zara.com': parseZara,
    'uniqlo.com': parseUniqlo,
    'hm.com': parseHM,
  };

  function detectStore() {
    const host = window.location.hostname.replace('www.', '');
    return Object.keys(PARSERS).find(k => host.includes(k));
  }

  // ── 상품 파서들 ──
  // 주의: DOM 텍스트/이미지 URL만 읽고 G2 서버에는 전송하지 않음

  function parseMusinsa() {
    // 무신사 React 구조 — 여러 셀렉터 fallback
    const name = (
      document.querySelector('[class*="product_title"] h2') ||
      document.querySelector('[class*="ProductTitle"] h2') ||
      document.querySelector('h2[class*="title"]') ||
      document.querySelector('.product-title__name') ||
      document.querySelector('h2.product-name') ||
      document.querySelector('h2')
    )?.textContent?.trim();

    const price = (
      document.querySelector('[class*="price_original"]') ||
      document.querySelector('[class*="Price"] [class*="original"]') ||
      document.querySelector('.sale_price, .price-value') ||
      document.querySelector('[class*="price"]')
    )?.textContent?.trim();

    const brand = (
      document.querySelector('[class*="brand"] a') ||
      document.querySelector('.product-title__brand') ||
      document.querySelector('[class*="Brand"] a')
    )?.textContent?.trim();

    const img = (
      document.querySelector('[class*="product_image"] img') ||
      document.querySelector('[class*="ProductImage"] img') ||
      document.querySelector('.product-image__img') ||
      document.querySelector('img[class*="product"]')
    )?.src;

    // URL에 /products/ 있으면 파싱 실패해도 최소 데이터로 반환
    const isProductPage = location.pathname.includes('/products/');
    if (!name && !isProductPage) return null;
    return {
      store: 'musinsa',
      name: name || '무신사 상품',
      price: price || '',
      brand: brand || 'MUSINSA',
      img: img || '',
      url: location.href,
    };
  }

  function parseNike() {
    const name = document.querySelector('[data-test="product-title"], h1.headline-5')?.textContent?.trim();
    const price = document.querySelector('[data-test="product-price"], .product-price')?.textContent?.trim();
    const brand = 'Nike';
    const img = document.querySelector('.pdp-hero-image img, .product-image-container img')?.src;
    return name ? { store: 'nike', name, price, brand, img } : null;
  }

  function parseZara() {
    const name = document.querySelector('.product-detail-info__name, h1.product-name')?.textContent?.trim();
    const price = document.querySelector('.money-amount__main, .price-current')?.textContent?.trim();
    const brand = 'Zara';
    const img = document.querySelector('.media-image__image, picture img')?.src;
    return name ? { store: 'zara', name, price, brand, img } : null;
  }

  function parseUniqlo() {
    const name = document.querySelector('[data-test="product-name"], .fr-product__title')?.textContent?.trim();
    const price = document.querySelector('[data-test="product-price"], .fr-product__price')?.textContent?.trim();
    const brand = 'Uniqlo';
    const img = document.querySelector('.fr-product__image img')?.src;
    return name ? { store: 'uniqlo', name, price, brand, img } : null;
  }

  function parseHM() {
    const name = document.querySelector('.product-detail-info h1, .product-item__name')?.textContent?.trim();
    const price = document.querySelector('.product-item-price .price, .price-value')?.textContent?.trim();
    const brand = 'H&M';
    const img = document.querySelector('.product-detail-main-image img')?.src;
    return name ? { store: 'hm', name, price, brand, img } : null;
  }

  // ── 버튼 주입 ──
  function injectFitButton(product) {
    if (document.getElementById('myfit-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'myfit-btn';
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-label', 'MyFit으로 가상 피팅');

    // 스타일: classList + inline (innerHTML 금지라 textContent 사용)
    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '80px',
      right: '20px',
      zIndex: '2147483647',
      width: '56px',
      height: '56px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #00e5ff, #7c4dff)',
      border: 'none',
      cursor: 'pointer',
      boxShadow: '0 4px 20px rgba(0,229,255,0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '24px',
      transition: 'transform 0.2s, box-shadow 0.2s',
    });

    btn.textContent = '👗';
    btn.title = 'MyFit으로 피팅';

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.1)';
      btn.style.boxShadow = '0 6px 28px rgba(0,229,255,0.6)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1.0)';
      btn.style.boxShadow = '0 4px 20px rgba(0,229,255,0.4)';
    });

    btn.addEventListener('click', () => {
      // background service worker에 상품 데이터 전달
      chrome.runtime.sendMessage({
        type: 'PRODUCT_DETECTED',
        payload: product
      });
      // side panel은 background에서 openPanelOnActionClick으로 관리
      // content script에서 직접 sidePanel API 접근 불가 → message 방식
    });

    document.body.appendChild(btn);
  }

  // ── 라벨 배지 (어느 쇼핑몰인지 표시) ──
  function injectStoreBadge(storeName) {
    if (document.getElementById('myfit-badge')) return;
    const badge = document.createElement('div');
    badge.id = 'myfit-badge';
    Object.assign(badge.style, {
      position: 'fixed',
      bottom: '142px',
      right: '12px',
      zIndex: '2147483646',
      background: 'rgba(0,0,0,0.85)',
      color: '#00e5ff',
      fontSize: '10px',
      fontWeight: '700',
      padding: '4px 10px',
      borderRadius: '100px',
      border: '1px solid rgba(0,229,255,0.3)',
      letterSpacing: '0.5px',
      pointerEvents: 'none',
    });
    badge.textContent = 'MyFit ✓';
    document.body.appendChild(badge);
  }

  // ── 메인 실행 ──
  function main() {
    const store = detectStore();
    if (!store) return;

    const product = PARSERS[store]();
    if (!product) return;

    injectFitButton(product);
    injectStoreBadge(store);
  }

  // SPA(React/Next.js 기반 쇼핑몰) 대응 — URL 변경 감지 (단일 옵저버, 최초 1회만 등록)
  let _spaObserverActive = false;
  function observeSPANavigation() {
    if (_spaObserverActive) return;
    _spaObserverActive = true;
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        document.getElementById('myfit-btn')?.remove();
        document.getElementById('myfit-badge')?.remove();
        setTimeout(main, 800); // DOM 렌더링 대기
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // DOM 준비 후 실행 + SPA 대응 단일 등록
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
  observeSPANavigation();

})();
