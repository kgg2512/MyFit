/**
 * FitEngine (Extension JS port) — 치수 기반 핏 예측 엔진 (MyFit P2 코어)
 *
 * 출처: myfit-mobile/src/lib/fitEngine.ts (검증된 TS 엔진)의 충실 포팅.
 *   - 밴드/라벨/신축맵/점수 로직 1:1 동일. TS와 출력이 같아야 함(정확성 오라클).
 *   - 크롬확장은 ES 모듈이 아니므로(panel.html이 일반 <script>) IIFE로 전역 노출.
 *   - 순수 함수형, 외부 의존 0, 사용자 기기 내 계산만 (사이즈표 서버 전송 없음).
 *
 * 사용:
 *   const result = window.MyFitEngine.predict(sizeChart, body, { stretchFromChart: true });
 *     sizeChart = content.js parseMusinsaSizeChart() 반환값
 *     body      = { height, chestHalf, shoulder }  ← chestHalf = 가슴둘레/2 (단면)
 */
(function (global) {
  'use strict';

  // ── 여유분 → 핏 판정 구간 (회장 확정 스펙 — 가슴 단면 기준) ──
  //   타이트(<0) / 바디핏(0~+2) / 스탠다드(+2~+6) / 세미오버(+6~+10) / 오버(+10~)
  //   음수가 -4 이하로 크면 실착 불가(impossible)로 강등.
  const FIT_LABELS = {
    impossible: { level: 'impossible', tone: 'tight', label: '작아서 불가' },
    tight: { level: 'tight', tone: 'tight', label: '타이트' },
    bodyfit: { level: 'bodyfit', tone: 'standard', label: '바디핏' },
    standard: { level: 'standard', tone: 'standard', label: '스탠다드' },
    semiover: { level: 'semiover', tone: 'oversized', label: '세미오버' },
    oversized: { level: 'oversized', tone: 'oversized', label: '오버핏' },
  };

  /** 가슴 단면 여유분(cm) → 핏 밴드 */
  function bandForChest(ease) {
    if (ease < -4) return FIT_LABELS.impossible;
    if (ease < 0) return FIT_LABELS.tight;
    if (ease < 2) return FIT_LABELS.bodyfit;
    if (ease < 6) return FIT_LABELS.standard;
    if (ease < 10) return FIT_LABELS.semiover;
    return FIT_LABELS.oversized;
  }

  /**
   * 어깨 너비 여유분(cm) → 핏 밴드 (가슴보다 허용 여유 작음).
   *   타이트(<-1) / 바디핏(-1~+1) / 스탠다드(+1~+3) / 세미오버(+3~+6) / 오버(+6~)
   */
  function bandForShoulder(ease) {
    if (ease < -3) return FIT_LABELS.impossible;
    if (ease < -1) return FIT_LABELS.tight;
    if (ease < 1) return FIT_LABELS.bodyfit;
    if (ease < 3) return FIT_LABELS.standard;
    if (ease < 6) return FIT_LABELS.semiover;
    return FIT_LABELS.oversized;
  }

  // ── 신축성 문자열 → 보정 cm ──
  const STRETCH_MAP = {
    '없음': 0,
    '거의 없음': 0.5,
    '보통': 1.5,
    '약간 있음': 2.5,
    '있음': 4,
  };

  function stretchToCm(stretch) {
    if (!stretch) return 0;
    const v = STRETCH_MAP[String(stretch).trim()];
    return typeof v === 'number' ? v : 0;
  }

  // ── 측정 키 매칭 (쇼핑몰마다 명칭 다를 수 있음) ──
  const CHEST_KEYS = ['가슴단면', '가슴 단면', '가슴', 'chest'];
  const SHOULDER_KEYS = ['어깨너비', '어깨 너비', '어깨', 'shoulder'];
  const LENGTH_KEYS = ['총장', '기장', 'length'];

  function findValue(row, keys) {
    for (const k of keys) {
      const v = row[k];
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string') {
        const n = parseFloat(v);
        if (Number.isFinite(n)) return n;
      }
    }
    return null;
  }

  // ── 점수 — 가슴 여유분이 "스탠다드 중앙(+4cm)"에 가까울수록 100점 ──
  function scoreForEase(ease) {
    if (ease === null) return 0;
    const ideal = 4;
    const dist = Math.abs(ease - ideal);
    return Math.max(0, Math.round(100 - dist * 8));
  }

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  // ── 자체 구현체 ──
  function predict(chart, body, opts) {
    opts = opts || {};
    if (!chart || !Array.isArray(chart.sizes)) {
      return { category: (chart && chart.category) || 'tops', sizes: [], recommended: null, stretchApplied: false };
    }

    // 신축 보정값 결정
    let stretchCm = 0;
    if (typeof opts.fabricStretch === 'number') {
      stretchCm = opts.fabricStretch;
    } else if (opts.stretchFromChart) {
      stretchCm = stretchToCm(chart.stretch);
    }
    const stretchApplied = stretchCm > 0;

    const sizes = chart.sizes.map((row) => {
      const parts = [];

      // 가슴 (대표 부위)
      const chestG = findValue(row, CHEST_KEYS);
      const chestEaseRaw = chestG !== null ? chestG - body.chestHalf : null;
      const chestEase = chestEaseRaw !== null ? chestEaseRaw + stretchCm : null;
      const chestBand = chestEase !== null ? bandForChest(chestEase) : FIT_LABELS.standard;
      const chestPart = {
        measureKey: '가슴단면',
        garment: chestG,
        body: body.chestHalf,
        ease: chestEaseRaw !== null ? round1(chestEaseRaw) : null,
        level: chestEase !== null ? chestBand.level : 'standard',
        tone: chestEase !== null ? chestBand.tone : 'standard',
        label: chestEase !== null ? chestBand.label : '비교 불가',
      };
      parts.push(chestPart);

      // 어깨 — 민소매/나시/탱크는 측정 기준 달라 비교 제외(정보성)
      const shoulderComparable = !/sleeveless|나시|민소매|탱크|cami/i.test(chart.category || '');
      const shoulderG = findValue(row, SHOULDER_KEYS);
      const shoulderEaseRaw = shoulderG !== null ? shoulderG - body.shoulder : null;
      const shoulderEase = (shoulderComparable && shoulderEaseRaw !== null) ? shoulderEaseRaw + stretchCm : null;
      const shoulderBand = shoulderEase !== null ? bandForShoulder(shoulderEase) : FIT_LABELS.standard;
      parts.push({
        measureKey: '어깨너비',
        garment: shoulderG,
        body: body.shoulder,
        ease: (shoulderComparable && shoulderEaseRaw !== null) ? round1(shoulderEaseRaw) : null,
        level: shoulderEase !== null ? shoulderBand.level : 'standard',
        tone: shoulderEase !== null ? shoulderBand.tone : 'standard',
        label: shoulderEase !== null
          ? shoulderBand.label
          : (shoulderComparable ? '비교 불가' : '민소매 — 어깨 비교 제외'),
      });

      // 총장 (참고 — 정보성)
      const lengthG = findValue(row, LENGTH_KEYS);
      if (lengthG !== null) {
        parts.push({
          measureKey: '총장',
          garment: lengthG,
          body: null,
          ease: null,
          level: 'standard',
          tone: 'standard',
          label: lengthG + 'cm',
        });
      }

      return {
        size: row.size,
        parts: parts,
        primary: chestPart,
        score: scoreForEase(chestEase),
      };
    });

    // 추천 = 최고 점수 (동점이면 더 작은 사이즈가 앞이므로 첫 번째)
    let recommended = null;
    let best = -1;
    for (const s of sizes) {
      if (s.score > best) { best = s.score; recommended = s.size; }
    }

    return {
      category: chart.category || 'tops',
      sizes: sizes,
      recommended: recommended,
      stretchApplied: stretchApplied,
    };
  }

  global.MyFitEngine = { predict: predict };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
