/**
 * MyFit Chrome Extension — Content Script
 *
 * 책임:
 *  - 쇼핑몰 상품 페이지에서 상품 정보 감지
 *  - "MyFit으로 피팅" 버튼 주입
 *  - 감지한 상품 데이터를 background로 전달 (서버 전송 금지)
 *
 * 보안 제약 (CLO/CISO):
 *  - innerHTML 사용 금지 → DOM API 직접 사용 (textContent만)
 *  - 상품 데이터 G2 서버 전송 금지
 *  - eval() 사용 금지
 *  - 사이즈표(실측) 처리 원칙 (CLO 확정 2026-06-26):
 *      · 쇼핑몰이 상품페이지에 "공개 표시"하는 실측 사이즈표는 읽기만 허용.
 *      · 저장·재배포·서버 전송 금지. 사용자 기기 내 핏 계산에만 1회성 사용.
 *      · 대량 크롤링·DB 적재 아님 — 사용자가 보고 있는 그 페이지의 표시정보만 파싱.
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
    // SEC-CISO: url은 https:// 전용 — javascript: URI 등 이상 URL 차단
    const safeUrl = location.href.startsWith('https://') ? location.href : '';
    return {
      store: 'musinsa',
      name: name || '무신사 상품',
      price: price || '',
      brand: brand || 'MUSINSA',
      imageUrl: img && img.startsWith('https://') ? img : '',
      url: safeUrl,
      // 실측 사이즈표 (공개 표시정보 — 읽기 전용). 없으면 null.
      sizeChart: parseMusinsaSizeChart(),
    };
  }

  /**
   * 무신사 실측 사이즈표 파서 (P2 핵심 기능).
   *
   * 무신사 DOM 구조 (2026-06-26 라이브 검증):
   *   div[class*="ActiaulSizeWrap-sc-"]            (무신사 오타 그대로 — 깨지기 쉬우니 fallback 셀렉터 병행)
   *   ├── ul[class*="ActualSizeHeaderUl-sc-"]
   *   │     └── li × N : ["cm", "내 사이즈", "M", "L", "XL", "XXL"]   ← 사이즈 라벨
   *   └── table[class*="ActualSizeTable-sc-"]
   *         ├── thead > tr > th × M : ["총장", "가슴단면", "어깨너비"]  ← 측정 항목
   *         └── tbody > tr
   *               ├── (placeholder) td×1 "사이즈를 직접 입력해주세요"   ← 스킵
   *               └── (사이즈별) td×M : [총장값, 가슴단면값, 어깨너비값]
   *
   * 셀렉터는 모두 [class*="...-sc-"] 부분일치 — styled-components 빌드 해시 변동에 견딤.
   * @returns {{category:string, unit:'cm', measureKeys:string[], sizes:Object[], stretch:string|null}|null}
   */
  function parseMusinsaSizeChart() {
    try {
      const SIZE_RE = /^(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|FREE|F|\d{2,3})$/;

      const table = document.querySelector('[class*="ActualSizeTable-sc-"]');
      if (!table) return null;

      // 1. 측정 항목 (thead th) — textContent만 사용
      const measureKeys = Array.from(table.querySelectorAll('thead th'))
        .map(th => (th.textContent || '').trim())
        .filter(Boolean);
      if (measureKeys.length === 0) return null;

      // 2. 데이터 행 = 셀 수가 측정항목 수와 일치하는 tbody 행만 (placeholder 행 자동 배제)
      const dataRows = Array.from(table.querySelectorAll('tbody tr'))
        .map(tr => Array.from(tr.querySelectorAll('td')).map(td => (td.textContent || '').trim()))
        .filter(cells => cells.length === measureKeys.length);
      if (dataRows.length === 0) return null;

      // 3. 사이즈 라벨 = 헤더 ul 의 li 중 사이즈 패턴만 ("cm","내 사이즈" 등 자동 배제)
      const headerUl = document.querySelector('[class*="ActualSizeHeaderUl-sc-"]');
      let sizeLabels = [];
      if (headerUl) {
        sizeLabels = Array.from(headerUl.querySelectorAll('li'))
          .map(li => (li.textContent || '').trim())
          .filter(t => SIZE_RE.test(t));
      }
      // 라벨이 데이터 행보다 적으면 인덱스 기반 fallback (행 누락 시 데이터 보존)
      if (sizeLabels.length < dataRows.length) {
        sizeLabels = dataRows.map((_, i) => sizeLabels[i] || `SIZE_${i + 1}`);
      }

      // 4. 행렬 → 구조화 객체 (숫자 변환, 실패 시 null)
      const sizes = dataRows.map((cells, i) => {
        const obj = { size: sizeLabels[i] };
        measureKeys.forEach((key, j) => {
          const num = parseFloat(cells[j]);
          obj[key] = Number.isFinite(num) ? num : null;
        });
        return obj;
      });

      return {
        category: detectMusinsaCategory(),
        unit: 'cm',
        measureKeys,
        sizes,
        stretch: parseMusinsaStretch(), // 신축성(없음~있음) — 메쉬/스판 핏 보정용, best-effort
      };
    } catch (e) {
      // 파싱 실패는 치명적이지 않음 — 상품 기본정보는 그대로 반환
      console.warn('[MyFit] 사이즈표 파싱 실패:', e && e.message);
      return null;
    }
  }

  /**
   * 카테고리 자동 감지 — 사이즈 측정법 안내 텍스트의 키워드로 추정.
   * 예: "민소매 사이즈 측정법" → 'sleeveless'.  실패 시 'tops' 기본.
   * @returns {string}
   */
  function detectMusinsaCategory() {
    const wrap = document.querySelector('[class*="ActualSizeTable__Wrap-sc-"]');
    const guideText = wrap ? (wrap.textContent || '') : '';
    const map = [
      [/민소매|나시|탱크/, 'sleeveless'],
      [/반소매|반팔|티셔츠/, 'tshirt'],
      [/긴소매|긴팔|맨투맨|니트|스웨터|후드/, 'longsleeve'],
      [/셔츠|블라우스/, 'shirt'],
      [/아우터|코트|자켓|재킷|점퍼|패딩/, 'outerwear'],
      [/팬츠|바지|데님|슬랙스|쇼츠|반바지/, 'bottoms'],
    ];
    for (const [re, cat] of map) {
      if (re.test(guideText)) return cat;
    }
    return 'tops';
  }

  /**
   * 소재 신축성 감지 — MaterialInfo 테이블에서 "신축성" 행의 선택된 셀.
   * 무신사는 선택 셀에 파란 배경(rgba(36,94,255,0.1))을 적용 → computed style로 판별.
   * 신축성 행은 5개 데이터 행 중 3번째(핏/촉감/신축성/비침/두께) — 라벨 매칭으로 안전하게 찾음.
   * @returns {string|null}  '없음'|'거의 없음'|'보통'|'약간 있음'|'있음' 등, 못 찾으면 null
   */
  function parseMusinsaStretch() {
    try {
      const matWrap = document.querySelector('[class*="MaterialInfo__MaterialWrap-sc-"]');
      if (!matWrap) return null;
      // 행 라벨 ("신축성")과 같은 행의 데이터 셀들을 찾는다.
      // 무신사는 라벨 ul + 값 table 분리 구조 — 인덱스로 대응.
      const labels = Array.from(matWrap.querySelectorAll('*'))
        .filter(el => {
          const t = Array.from(el.childNodes)
            .filter(n => n.nodeType === 3)
            .map(n => n.textContent.trim()).join('');
          return t === '신축성';
        });
      const table = matWrap.querySelector('[class*="MaterialInfo__MaterialTable-sc-"]');
      if (!table) return null;
      const rows = Array.from(table.querySelectorAll('tr'));
      // 라벨 순서: 핏(0) 촉감(1) 신축성(2) 비침(3) 두께(4) — 신축성 = index 2
      const STRETCH_ROW = 2;
      const row = rows[STRETCH_ROW];
      if (!row) return null;
      const selected = Array.from(row.querySelectorAll('th, td')).find(c => {
        const bg = getComputedStyle(c).backgroundColor;
        // 흰색/투명이 아니면 선택된 셀 (무신사 파란 하이라이트)
        return bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'rgb(255, 255, 255)' && bg !== 'transparent';
      });
      return selected ? (selected.textContent || '').trim() || null : null;
    } catch {
      return null;
    }
  }

  function parseNike() {
    const name = document.querySelector('[data-test="product-title"], h1.headline-5')?.textContent?.trim();
    const price = document.querySelector('[data-test="product-price"], .product-price')?.textContent?.trim();
    const brand = 'Nike';
    const img = document.querySelector('.pdp-hero-image img, .product-image-container img')?.src;
    const imageUrl = img && img.startsWith('https://') ? img : '';
    return name ? { store: 'nike', name, price, brand, imageUrl, url: location.href } : null;
  }

  function parseZara() {
    const name = document.querySelector('.product-detail-info__name, h1.product-name')?.textContent?.trim();
    const price = document.querySelector('.money-amount__main, .price-current')?.textContent?.trim();
    const brand = 'Zara';
    const img = document.querySelector('.media-image__image, picture img')?.src;
    const imageUrl = img && img.startsWith('https://') ? img : '';
    return name ? { store: 'zara', name, price, brand, imageUrl, url: location.href } : null;
  }

  function parseUniqlo() {
    const name = document.querySelector('[data-test="product-name"], .fr-product__title')?.textContent?.trim();
    const price = document.querySelector('[data-test="product-price"], .fr-product__price')?.textContent?.trim();
    const brand = 'Uniqlo';
    const img = document.querySelector('.fr-product__image img')?.src;
    const imageUrl = img && img.startsWith('https://') ? img : '';
    return name ? { store: 'uniqlo', name, price, brand, imageUrl, url: location.href } : null;
  }

  function parseHM() {
    const name = document.querySelector('.product-detail-info h1, .product-item__name')?.textContent?.trim();
    const price = document.querySelector('.product-item-price .price, .price-value')?.textContent?.trim();
    const brand = 'H&M';
    const img = document.querySelector('.product-detail-main-image img')?.src;
    const imageUrl = img && img.startsWith('https://') ? img : '';
    return name ? { store: 'hm', name, price, brand, imageUrl, url: location.href } : null;
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
