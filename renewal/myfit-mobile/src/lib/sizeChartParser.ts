/**
 * sizeChartParser — 쇼핑몰 실측 사이즈표 텍스트 → GarmentSizeChart (MyFit P7 코어, 순수 함수)
 *
 * 회장 비전: "브랜드가 제공하는 의류 수치 사이즈를 토대로."
 *   웹 채널에서는 크롬확장(content.js) 대신, 사용자가 상품 페이지의 실측표를 복사해
 *   붙여넣는다. 이 파서가 탭/공백/개행 구분 텍스트를 fitEngine이 먹는 구조로 변환한다.
 *
 * 설계 원칙:
 *   - 순수 함수(외부 의존 0, import type만) → 오라클 테스트 대상.
 *   - 사용자 제공 데이터 1회성 처리(저장·재배포 없음 — CLO 원칙). 파싱만.
 *   - 무신사 실측표 복사 포맷 최우선. 행렬 방향(사이즈=행 / 사이즈=열) 자동 판별.
 *   - 측정항목 별칭은 fitEngine findValue 계열(총장/가슴단면/어깨너비)과 정합.
 */

import type { GarmentSizeChart, GarmentSizeRow } from './fitEngine';

// ─────────────────────────────────────────────────────────────
// 분류 규칙
// ─────────────────────────────────────────────────────────────

/** 사이즈 라벨 패턴 (알파벳 사이즈 + 숫자 사이즈 90/95/100, 44/55/66, 28~40 등 + FREE) */
const SIZE_RE = /^(xxs|xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl|5xl|free|f|onesize|\d{2,3})$/i;

/** 측정항목 별칭 (공백 제거·소문자 비교로 부분일치) */
const MEASURE_ALIASES = [
  '총장', '기장', '착장', '가슴단면', '가슴', '밑단단면', '밑단', '어깨너비', '어깨',
  '소매길이', '소매', '암홀', '허리단면', '허리', '엉덩이단면', '엉덩이', '힙',
  '허벅지단면', '허벅지', '밑위', '목너비',
  'chest', 'shoulder', 'length', 'sleeve', 'waist', 'hip', 'thigh', 'hem',
];

function norm(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase();
}

function isSizeLabel(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  return SIZE_RE.test(t.replace(/\s+/g, ''));
}

function isMeasureLabel(s: string): boolean {
  const t = norm(s);
  if (!t) return false;
  return MEASURE_ALIASES.some((a) => t.includes(norm(a)));
}

/** 셀 → 숫자 (첫 숫자 토큰 추출, "53.5cm"·"약 56" 등 허용). 실패 시 null */
function toNumber(s: string | undefined): number | null {
  if (s == null) return null;
  const m = String(s).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** 측정항목 이름 정리 (괄호 단위 표기 제거, 트림) */
function cleanMeasure(s: string): string {
  return s.replace(/\(.*?\)/g, '').trim();
}

// ─────────────────────────────────────────────────────────────
// 토크나이저 — 텍스트 → 2D 그리드
// ─────────────────────────────────────────────────────────────
function tokenizeLines(text: string): string[][] {
  const rawLines = text.replace(/ /g, ' ').split(/\r?\n/);
  const grid: string[][] = [];
  for (const line of rawLines) {
    if (!line.trim()) continue;
    // 탭이 있으면 탭 우선(웹 테이블 복사), 없으면 공백런.
    const cells = (line.includes('\t') ? line.split('\t') : line.trim().split(/\s+/))
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cells.length) grid.push(cells);
  }
  return grid;
}

function count(cells: string[], pred: (s: string) => boolean): number {
  return cells.reduce((n, c) => (pred(c) ? n + 1 : n), 0);
}

// ─────────────────────────────────────────────────────────────
// 파싱 결과
// ─────────────────────────────────────────────────────────────
export interface ParseResult {
  ok: boolean;
  chart: GarmentSizeChart | null;
  shape: 'rows' | 'cols' | null; // rows = 사이즈가 행, cols = 사이즈가 열(전치)
  error?: string;
}

/**
 * 실측표 텍스트를 GarmentSizeChart로 파싱.
 * @param text 붙여넣은 실측표 텍스트
 * @param category fitEngine 카테고리(민소매 어깨 제외 판정 등에 사용)
 * @param stretch 신축성 문자열(선택)
 */
export function parseSizeChart(
  text: string,
  category = 'tops',
  stretch: string | null = null,
): ParseResult {
  const fail = (error: string): ParseResult => ({ ok: false, chart: null, shape: null, error });

  if (!text || !text.trim()) return fail('사이즈표 텍스트가 비어 있습니다.');

  const grid = tokenizeLines(text);
  if (grid.length < 2) {
    return fail('표를 인식하지 못했습니다. 헤더 행과 데이터 행이 필요합니다.');
  }

  const firstRow = grid[0];
  const firstCol = grid.map((r) => r[0]);

  const isSizeNotMeasure = (s: string) => isSizeLabel(s) && !isMeasureLabel(s);

  const rowMeasures = count(firstRow, isMeasureLabel);
  const rowSizes = count(firstRow, isSizeNotMeasure);
  const colMeasures = count(firstCol, isMeasureLabel);
  const colSizes = count(firstCol, isSizeNotMeasure);

  // 방향 판별:
  //   rows = 첫 행이 측정항목(사이즈는 각 행 첫 셀) → 무신사 기본 형태
  //   cols = 첫 행이 사이즈(측정항목은 각 행 첫 셀) → 전치 형태
  let shape: 'rows' | 'cols';
  if (rowMeasures > rowSizes) shape = 'rows';
  else if (rowSizes > rowMeasures) shape = 'cols';
  else if (colSizes > colMeasures) shape = 'rows';
  else if (colMeasures > colSizes) shape = 'cols';
  else return fail('사이즈·측정항목을 구분하지 못했습니다. 표 형식을 확인해 주세요.');

  let measureKeys: string[] = [];
  let sizes: GarmentSizeRow[] = [];

  if (shape === 'rows') {
    // 헤더 행에서 측정항목만 순서 유지 추출(선행 코너/단위/'내 사이즈' 자동 배제)
    measureKeys = firstRow.filter(isMeasureLabel).map(cleanMeasure);
    // 데이터 행 = 첫 셀이 사이즈인 행
    const dataRows = grid.slice(1).filter((r) => isSizeNotMeasure(r[0]));
    sizes = dataRows.map((r) => {
      const values = r.slice(1); // 사이즈 라벨 이후 = 값들 (측정항목과 1:1)
      const row: GarmentSizeRow = { size: r[0].trim() };
      measureKeys.forEach((mk, i) => {
        row[mk] = toNumber(values[i]);
      });
      return row;
    });
  } else {
    // cols(전치): 첫 행 = 사이즈, 각 데이터 행 = [측정항목, 사이즈별 값...]
    const sizeLabels = firstRow.filter(isSizeNotMeasure).map((s) => s.trim());
    const dataRows = grid.slice(1).filter((r) => isMeasureLabel(r[0]));
    measureKeys = dataRows.map((r) => cleanMeasure(r[0]));
    sizes = sizeLabels.map((sz, j) => {
      const row: GarmentSizeRow = { size: sz };
      dataRows.forEach((r, mi) => {
        row[measureKeys[mi]] = toNumber(r.slice(1)[j]);
      });
      return row;
    });
  }

  // 중복 measureKey 제거(순서 유지)
  measureKeys = measureKeys.filter((mk, i) => mk && measureKeys.indexOf(mk) === i);

  if (measureKeys.length === 0) return fail('측정항목(총장·가슴단면·어깨너비 등)을 찾지 못했습니다.');
  if (sizes.length === 0) return fail('사이즈(S·M·L 등)를 찾지 못했습니다.');

  const chart: GarmentSizeChart = {
    category,
    unit: 'cm',
    measureKeys,
    sizes,
    stretch,
  };
  return { ok: true, chart, shape };
}
