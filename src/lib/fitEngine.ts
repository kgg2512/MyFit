/**
 * FitEngine — 치수 기반 핏 예측 엔진 (MyFit P2 코어)
 *
 * 회장 비전: "단순 비주얼 합성이 아니라 치수 기반 핏 예측."
 *   옷의 실측 사이즈표(크롬확장 content.js가 쇼핑몰에서 추출) × 사용자 신체 치수
 *   → 사이즈별·부위별 여유분(ease) 계산 → 핏 판정(타이트~오버).
 *
 * 설계 원칙:
 *   - `FitEngine` 인터페이스로 추상화 → 향후 TrueToForm 백엔드로 무손실 교체 가능.
 *     (제휴 성사 시 LocalFitEngine 대신 TrueToFormFitEngine 구현체만 주입)
 *   - 순수 함수형, 외부 의존 0, 사용자 기기 내 계산만 (사이즈표 서버 전송 없음).
 *   - 여유분 구간은 회장 확정 스펙(가슴 기준)을 그대로 코드화.
 */

// ─────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────

/** 핏 판정 레벨 (좁음 → 넓음) */
export type FitLevel =
  | 'impossible' // 입을 수 없음 (음수 여유분이 큼)
  | 'tight'      // 타이트
  | 'bodyfit'    // 바디핏 (몸에 붙음)
  | 'standard'   // 스탠다드 (적정)
  | 'semiover'   // 세미오버
  | 'oversized'; // 오버

/** UI 토큰 매핑용 3분류 (globals.css의 fit-tag--tight/standard/oversized와 정합) */
export type FitTone = 'tight' | 'standard' | 'oversized';

/** 옷 실측 사이즈표 1개 사이즈 행 (content.js 추출 결과와 동일 형태) */
export interface GarmentSizeRow {
  size: string; // 'M' | 'L' | 'XL' ...
  // 측정 항목별 단면/길이 (cm). 키는 한글 측정명 그대로(총장/가슴단면/어깨너비 등).
  [measureKey: string]: string | number | null;
}

/** content.js가 넘기는 사이즈표 전체 구조 */
export interface GarmentSizeChart {
  category?: string;
  unit?: 'cm';
  measureKeys: string[];          // ['총장','가슴단면','어깨너비']
  sizes: GarmentSizeRow[];
  stretch?: string | null;        // '없음'|'보통'|'있음' 등 (선택)
}

/** 사용자 신체 치수 (단면 기준 — 옷 단면과 직접 비교) */
export interface UserBody {
  height: number;       // cm (총장 핏 판정 참고용)
  weight?: number;      // kg (현재 직접 사용 안 함, 향후 체형 보정용)
  chestHalf: number;    // 가슴 단면 (cm) — 가슴둘레/2. 옷 '가슴단면'과 직접 비교
  shoulder: number;     // 어깨 너비 (cm) — 옷 '어깨너비'와 직접 비교
}

/** 부위 1개의 핏 판정 결과 */
export interface PartFit {
  measureKey: string;   // '가슴단면'
  garment: number | null;   // 옷 실측 (cm)
  body: number | null;      // 사용자 실측 (cm)
  ease: number | null;      // 여유분 = 옷 - 몸 (cm). null이면 비교 불가
  level: FitLevel;
  tone: FitTone;
  label: string;        // 한국어 라벨 ('바디핏', '스탠다드'...)
}

/** 사이즈 1개의 전체 핏 판정 */
export interface SizeFit {
  size: string;
  parts: PartFit[];
  // 대표 핏 = 가슴 기준(상의) — 추천 정렬/배지에 사용
  primary: PartFit;
  // 종합 점수(0~100, 100=완벽 적정) — 추천 사이즈 선택용
  score: number;
}

/** 엔진 전체 출력 */
export interface FitResult {
  category: string;
  sizes: SizeFit[];
  recommended: string | null; // 가장 적정한 사이즈명
  stretchApplied: boolean;    // 신축 보정 적용 여부
}

/** 핏 엔진 인터페이스 — TrueToForm 등으로 교체 가능 */
export interface FitEngine {
  predict(chart: GarmentSizeChart, body: UserBody, opts?: PredictOptions): FitResult;
}

export interface PredictOptions {
  /**
   * 원단 신축 보정. 옷이 늘어나면 체감 여유분이 커지므로(타이트 완화),
   * 여유분에 보정값(cm)을 더해 판정한다. content.js가 넘긴 stretch 문자열로 자동 매핑하거나,
   * 명시적 fabricStretch(cm)로 덮어쓸 수 있다.
   */
  fabricStretch?: number; // cm, 양수 = 더 잘 늘어남
  /** content.js stretch 문자열('있음' 등) → 보정 cm 자동 매핑 사용 */
  stretchFromChart?: boolean;
}

// ─────────────────────────────────────────────────────────────
// 여유분 → 핏 판정 구간 (회장 확정 스펙 — 가슴 단면 기준)
// ─────────────────────────────────────────────────────────────
//   타이트(<0) / 바디핏(0~+2) / 스탠다드(+2~+6) / 세미오버(+6~+10) / 오버(+10~)
//   음수가 -4 이하로 크면 실착 불가(impossible)로 강등.

interface FitBand {
  level: FitLevel;
  tone: FitTone;
  label: string;
}

const FIT_LABELS: Record<FitLevel, FitBand> = {
  impossible: { level: 'impossible', tone: 'tight', label: '작아서 불가' },
  tight: { level: 'tight', tone: 'tight', label: '타이트' },
  bodyfit: { level: 'bodyfit', tone: 'standard', label: '바디핏' },
  standard: { level: 'standard', tone: 'standard', label: '스탠다드' },
  semiover: { level: 'semiover', tone: 'oversized', label: '세미오버' },
  oversized: { level: 'oversized', tone: 'oversized', label: '오버핏' },
};

/** 가슴 단면 여유분(cm) → 핏 밴드 */
function bandForChest(ease: number): FitBand {
  if (ease < -4) return FIT_LABELS.impossible;
  if (ease < 0) return FIT_LABELS.tight;
  if (ease < 2) return FIT_LABELS.bodyfit;
  if (ease < 6) return FIT_LABELS.standard;
  if (ease < 10) return FIT_LABELS.semiover;
  return FIT_LABELS.oversized;
}

/**
 * 어깨 너비 여유분(cm) → 핏 밴드.
 * 어깨는 가슴보다 허용 여유가 작다(어깨가 넘어가면 핏이 무너짐).
 *   타이트(<-1) / 바디핏(-1~+1) / 스탠다드(+1~+3) / 세미오버(+3~+6) / 오버(+6~)
 */
function bandForShoulder(ease: number): FitBand {
  if (ease < -3) return FIT_LABELS.impossible;
  if (ease < -1) return FIT_LABELS.tight;
  if (ease < 1) return FIT_LABELS.bodyfit;
  if (ease < 3) return FIT_LABELS.standard;
  if (ease < 6) return FIT_LABELS.semiover;
  return FIT_LABELS.oversized;
}

// ─────────────────────────────────────────────────────────────
// 신축성 문자열 → 보정 cm
// ─────────────────────────────────────────────────────────────
const STRETCH_MAP: Record<string, number> = {
  '없음': 0,
  '거의 없음': 0.5,
  '보통': 1.5,
  '약간 있음': 2.5,
  '있음': 4,
};

function stretchToCm(stretch?: string | null): number {
  if (!stretch) return 0;
  return STRETCH_MAP[stretch.trim()] ?? 0;
}

// ─────────────────────────────────────────────────────────────
// 측정 키 매칭 (쇼핑몰마다 명칭 다를 수 있음)
// ─────────────────────────────────────────────────────────────
const CHEST_KEYS = ['가슴단면', '가슴 단면', '가슴', 'chest'];
const SHOULDER_KEYS = ['어깨너비', '어깨 너비', '어깨', 'shoulder'];
const LENGTH_KEYS = ['총장', '기장', 'length'];

function findValue(row: GarmentSizeRow, keys: string[]): number | null {
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

// ─────────────────────────────────────────────────────────────
// 점수 — 가슴 여유분이 "스탠다드 중앙(+4cm)"에 가까울수록 100점
// ─────────────────────────────────────────────────────────────
function scoreForEase(ease: number | null): number {
  if (ease === null) return 0;
  const ideal = 4; // 스탠다드 구간 중앙
  const dist = Math.abs(ease - ideal);
  return Math.max(0, Math.round(100 - dist * 8));
}

// ─────────────────────────────────────────────────────────────
// 자체 구현체
// ─────────────────────────────────────────────────────────────

export class LocalFitEngine implements FitEngine {
  predict(chart: GarmentSizeChart, body: UserBody, opts: PredictOptions = {}): FitResult {
    // 신축 보정값 결정
    let stretchCm = 0;
    if (typeof opts.fabricStretch === 'number') {
      stretchCm = opts.fabricStretch;
    } else if (opts.stretchFromChart) {
      stretchCm = stretchToCm(chart.stretch);
    }
    const stretchApplied = stretchCm > 0;

    const sizes: SizeFit[] = (chart.sizes || []).map((row) => {
      const parts: PartFit[] = [];

      // 가슴 (대표 부위)
      const chestG = findValue(row, CHEST_KEYS);
      const chestEaseRaw = chestG !== null ? chestG - body.chestHalf : null;
      const chestEase = chestEaseRaw !== null ? chestEaseRaw + stretchCm : null;
      const chestBand = chestEase !== null ? bandForChest(chestEase) : FIT_LABELS.standard;
      const chestPart: PartFit = {
        measureKey: '가슴단면',
        garment: chestG,
        body: body.chestHalf,
        // 표시 여유분은 보정 전 원값(사용자가 실측 차이를 직관적으로 보게) — 판정만 보정 반영
        ease: chestEaseRaw !== null ? round1(chestEaseRaw) : null,
        level: chestEase !== null ? chestBand.level : 'standard',
        tone: chestEase !== null ? chestBand.tone : 'standard',
        label: chestEase !== null ? chestBand.label : '비교 불가',
      };
      parts.push(chestPart);

      // 어깨
      const shoulderG = findValue(row, SHOULDER_KEYS);
      const shoulderEaseRaw = shoulderG !== null ? shoulderG - body.shoulder : null;
      const shoulderEase = shoulderEaseRaw !== null ? shoulderEaseRaw + stretchCm : null;
      const shoulderBand = shoulderEase !== null ? bandForShoulder(shoulderEase) : FIT_LABELS.standard;
      parts.push({
        measureKey: '어깨너비',
        garment: shoulderG,
        body: body.shoulder,
        ease: shoulderEaseRaw !== null ? round1(shoulderEaseRaw) : null,
        level: shoulderEase !== null ? shoulderBand.level : 'standard',
        tone: shoulderEase !== null ? shoulderBand.tone : 'standard',
        label: shoulderEase !== null ? shoulderBand.label : '비교 불가',
      });

      // 총장 (참고 — 키 대비 길이감. 판정은 정보성으로 약하게)
      const lengthG = findValue(row, LENGTH_KEYS);
      if (lengthG !== null) {
        parts.push({
          measureKey: '총장',
          garment: lengthG,
          body: null,
          ease: null,
          level: 'standard',
          tone: 'standard',
          label: `${lengthG}cm`,
        });
      }

      return {
        size: row.size,
        parts,
        primary: chestPart,
        score: scoreForEase(chestEase),
      };
    });

    // 추천 = 최고 점수 (동점이면 더 작은 사이즈가 앞이므로 첫 번째)
    let recommended: string | null = null;
    let best = -1;
    for (const s of sizes) {
      if (s.score > best) { best = s.score; recommended = s.size; }
    }

    return {
      category: chart.category || 'tops',
      sizes,
      recommended,
      stretchApplied,
    };
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 기본 엔진 싱글톤 (호출부 편의) */
export const fitEngine: FitEngine = new LocalFitEngine();
