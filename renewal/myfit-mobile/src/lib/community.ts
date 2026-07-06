/**
 * MyFit 커뮤니티 데이터 레이어 — "핏 자랑" 피드.
 *
 * 컨셉(회장 정의): 유저가 "나는 키 N·몸무게 M·평소 이런 스타일인데,
 * 이 브랜드 이 사이즈를 입으니 이런 핏이 나온다"를 공유·자랑한다.
 * MyFit 커뮤니티의 존재 이유 = 인스타식 OOTD가 아니라 **핏 데이터**.
 * 킬러 기능 = "나와 비슷한 체형"의 사람이 이 옷을 입으면 어떤 핏인지 → 핏예측 본업과 직결.
 *
 * 현 단계 = 백엔드 없음(정적 사이트). 데모 seed + localStorage("내 글")만.
 * 실 UGC(타인에게 실제 노출) = 다음 단계 백엔드(계정+DB+이미지) 필요.
 */

'use client';

import type { Measurements } from './storage';

export type FitTone = 'tight' | 'standard' | 'oversized';

export interface CommunityUser {
  /** 표시 닉네임 (실명 금지 — 프라이버시) */
  nickname: string;
  height: number; // cm
  weight: number; // kg
  /** 평소 즐겨 입는 스타일 태그 (예: 미니멀, 오버핏, 스트릿) */
  styleTags: string[];
  /** 아바타 배경색 (닉네임 이니셜 표시) */
  avatarColor: string;
}

export interface PartFit {
  /** 부위 라벨 (어깨/가슴/허리/기장 등) */
  label: string;
  tone: FitTone;
}

export interface CommunityPost {
  id: string;
  user: CommunityUser;
  /** 브랜드 (무신사·나이키·자라...) */
  brand: string;
  /** 상품명 */
  garmentName: string;
  category: 'tops' | 'bottoms' | 'outer';
  /** 착용한 사이즈 (M, L, 30...) */
  sizeWorn: string;
  /** 대표 핏 판정 */
  fitOverall: FitTone;
  /** 부위별 핏 (선택) */
  partFits: PartFit[];
  /** 한줄 후기 */
  caption: string;
  likes: number;
  comments: number;
  /** 작성 시각(ms) */
  createdAt: number;
  /** 유저가 직접 올린 글이면 true (데모 seed와 구분) */
  mine?: boolean;
}

// ─────────────────────────────────────────────────────────────
// 핏 톤 → 한국어 라벨
// ─────────────────────────────────────────────────────────────
export const TONE_LABEL: Record<FitTone, string> = {
  tight: '타이트',
  standard: '딱 맞음',
  oversized: '오버핏',
};

export const STYLE_OPTIONS = ['미니멀', '오버핏', '스트릿', '캐주얼', '클래식', '스포티', '아메카지'] as const;

// ─────────────────────────────────────────────────────────────
// 데모 seed 게시물 (가상 유저 — 실제 개인정보 0)
//   체형(키·몸무게)을 다양하게 분포시켜 "나와 비슷한 체형" 필터가 의미 있게 작동하도록.
// ─────────────────────────────────────────────────────────────
const H = 60 * 60 * 1000;
const D = 24 * H;

/** 고정 기준 시각 — 정적 export(SSR)에서 Date.now() 하이드레이션 불일치를 피하려 상대시각 라벨만 사용 */
export const DEMO_POSTS: CommunityPost[] = [
  {
    id: 'c-1',
    user: { nickname: '민준', height: 178, weight: 72, styleTags: ['미니멀', '캐주얼'], avatarColor: '#0891b2' },
    brand: '무신사 스탠다드', garmentName: '오버핏 옥스퍼드 셔츠', category: 'tops', sizeWorn: 'L',
    fitOverall: 'oversized',
    partFits: [{ label: '어깨', tone: 'oversized' }, { label: '가슴', tone: 'standard' }, { label: '기장', tone: 'oversized' }],
    caption: '어깨 넓은 편인데 L 딱 좋아요. 오버핏 원하면 그대로, 깔끔하게 입으려면 M 추천.',
    likes: 128, comments: 14, createdAt: 2 * H,
  },
  {
    id: 'c-2',
    user: { nickname: '서연', height: 163, weight: 52, styleTags: ['미니멀', '클래식'], avatarColor: '#db2777' },
    brand: '자라', garmentName: '크롭 니트 가디건', category: 'tops', sizeWorn: 'S',
    fitOverall: 'standard',
    partFits: [{ label: '어깨', tone: 'standard' }, { label: '가슴', tone: 'standard' }, { label: '기장', tone: 'tight' }],
    caption: '키 163인데 S가 딱. 기장이 짧으니 하이웨스트랑 매치하면 예뻐요.',
    likes: 96, comments: 8, createdAt: 6 * H,
  },
  {
    id: 'c-3',
    user: { nickname: '도현', height: 182, weight: 88, styleTags: ['스트릿', '스포티'], avatarColor: '#111827' },
    brand: '나이키', garmentName: '테크 플리스 후디', category: 'outer', sizeWorn: 'XL',
    fitOverall: 'standard',
    partFits: [{ label: '어깨', tone: 'standard' }, { label: '가슴', tone: 'standard' }, { label: '기장', tone: 'standard' }],
    caption: '덩치 있는 편(182/88). XL이 정사이즈. XXL은 너무 커요. 팔 기장 딱 맞음.',
    likes: 210, comments: 31, createdAt: 1 * D,
  },
  {
    id: 'c-4',
    user: { nickname: '지우', height: 170, weight: 60, styleTags: ['캐주얼', '아메카지'], avatarColor: '#16a34a' },
    brand: '유니클로', garmentName: '와이드 데님 팬츠', category: 'bottoms', sizeWorn: '30',
    fitOverall: 'oversized',
    partFits: [{ label: '허리', tone: 'standard' }, { label: '허벅지', tone: 'oversized' }, { label: '기장', tone: 'oversized' }],
    caption: '허리 30 맞는데 기장이 길어서 한 번 접어 입어요. 와이드핏 좋아하면 강추.',
    likes: 74, comments: 5, createdAt: 1 * D + 4 * H,
  },
  {
    id: 'c-5',
    user: { nickname: '하은', height: 158, weight: 48, styleTags: ['미니멀'], avatarColor: '#7c3aed' },
    brand: '무신사 스탠다드', garmentName: '베이직 반팔 티셔츠', category: 'tops', sizeWorn: 'S',
    fitOverall: 'standard',
    partFits: [{ label: '어깨', tone: 'standard' }, { label: '가슴', tone: 'standard' }, { label: '기장', tone: 'standard' }],
    caption: '작은 키(158)엔 S가 정답. M은 원피스처럼 길어요. 목이 살짝 파여서 데일리로 굿.',
    likes: 143, comments: 19, createdAt: 2 * D,
  },
  {
    id: 'c-6',
    user: { nickname: '준서', height: 175, weight: 68, styleTags: ['클래식', '미니멀'], avatarColor: '#0e7490' },
    brand: '커버낫', garmentName: '치노 팬츠', category: 'bottoms', sizeWorn: '32',
    fitOverall: 'tight',
    partFits: [{ label: '허리', tone: 'tight' }, { label: '허벅지', tone: 'standard' }, { label: '기장', tone: 'standard' }],
    caption: '허리가 딱 붙는 편이라 슬림 좋아하면 32, 편하게는 34 사이즈업 추천.',
    likes: 61, comments: 7, createdAt: 3 * D,
  },
  {
    id: 'c-7',
    user: { nickname: '유나', height: 167, weight: 58, styleTags: ['스트릿', '오버핏'], avatarColor: '#d97706' },
    brand: '아디다스', garmentName: '트레포일 크루넥', category: 'tops', sizeWorn: 'M',
    fitOverall: 'oversized',
    partFits: [{ label: '어깨', tone: 'oversized' }, { label: '가슴', tone: 'oversized' }, { label: '기장', tone: 'standard' }],
    caption: '일부러 오버핏 원해서 M(원래 S). 여성분들 박시하게 입으려면 한 사이즈 업.',
    likes: 189, comments: 22, createdAt: 4 * D,
  },
  {
    id: 'c-8',
    user: { nickname: '태윤', height: 172, weight: 64, styleTags: ['캐주얼'], avatarColor: '#dc2626' },
    brand: '폴로 랄프로렌', garmentName: '옥스퍼드 셔츠', category: 'tops', sizeWorn: 'M',
    fitOverall: 'standard',
    partFits: [{ label: '어깨', tone: 'standard' }, { label: '가슴', tone: 'standard' }, { label: '기장', tone: 'standard' }],
    caption: '172/64 표준 체형엔 M 정사이즈. 폴로는 살짝 크게 나와서 슬림 원하면 S도 가능.',
    likes: 88, comments: 11, createdAt: 5 * D,
  },
];

// ─────────────────────────────────────────────────────────────
// 체형 유사도 — 키·몸무게 거리 기반 (0~100, 높을수록 유사)
//   키 1cm ≈ 몸무게 1kg 가중. 실제 핏 예측 본업과 직결되는 핵심 신호.
// ─────────────────────────────────────────────────────────────
export function bodySimilarity(a: Pick<Measurements, 'height' | 'weight'>, b: Pick<CommunityUser, 'height' | 'weight'>): number {
  const dh = a.height - b.height;
  const dw = a.weight - b.weight;
  const dist = Math.sqrt(dh * dh + dw * dw);
  // dist 0 → 100점, dist 25 이상 → 0점 (선형)
  return Math.max(0, Math.round(100 - (dist / 25) * 100));
}

/** "나와 비슷한 체형" 단일 임계값 — 필터 컷오프·배지 강조 모두 이 값을 사용(일관성) */
export const SIMILAR_THRESHOLD = 55;

/** "나와 비슷한 체형" 여부 판정 (유사도 임계값) */
export function isSimilarBody(m: Pick<Measurements, 'height' | 'weight'>, u: CommunityUser, threshold = SIMILAR_THRESHOLD): boolean {
  return bodySimilarity(m, u) >= threshold;
}

/** 키/몸무게 차이 요약 문구 ("나보다 +5cm / -3kg") */
export function bodyDiffLabel(m: Pick<Measurements, 'height' | 'weight'>, u: CommunityUser): string {
  const dh = u.height - m.height;
  const dw = u.weight - m.weight;
  const hp = dh === 0 ? '키 같음' : `키 ${dh > 0 ? '+' : ''}${dh}cm`;
  const wp = dw === 0 ? '몸무게 같음' : `${dw > 0 ? '+' : ''}${dw}kg`;
  return `${hp} · ${wp}`;
}

// ─────────────────────────────────────────────────────────────
// 내 글 (localStorage) — 데모 단계: 이 기기에만. 백엔드 붙이면 교체.
// ─────────────────────────────────────────────────────────────
const MY_POSTS_KEY = 'myfit_community_my_posts';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function loadMyPosts(): CommunityPost[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(MY_POSTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CommunityPost[];
  } catch {
    return [];
  }
}

export function addMyPost(post: CommunityPost): CommunityPost[] {
  if (!isBrowser()) return [];
  const updated = [post, ...loadMyPosts()].slice(0, 30);
  try {
    localStorage.setItem(MY_POSTS_KEY, JSON.stringify(updated));
  } catch {
    // quota 초과 무시
  }
  return updated;
}

export function deleteMyPost(id: string): CommunityPost[] {
  if (!isBrowser()) return [];
  const remaining = loadMyPosts().filter(p => p.id !== id);
  if (remaining.length === 0) localStorage.removeItem(MY_POSTS_KEY);
  else localStorage.setItem(MY_POSTS_KEY, JSON.stringify(remaining));
  return remaining;
}

/** 데모 seed + 내 글 병합 (내 글 최신 우선) */
export function loadAllPosts(): CommunityPost[] {
  return [...loadMyPosts(), ...DEMO_POSTS];
}

/**
 * 게시물의 '경과 ms'를 단일 규칙으로 해석한다.
 * - 데모 seed: createdAt 필드에 '경과 ms'를 그대로 저장(정적 상수, Date.now() 불필요).
 * - 내 글(mine): createdAt 필드에 절대 epoch(ms)를 저장 → now - createdAt.
 * @param now Date.now() (호출부에서 마운트 이후 계산해 전달)
 */
export function resolveElapsedMs(post: CommunityPost, now: number): number {
  return post.mine ? Math.max(0, now - post.createdAt) : post.createdAt;
}

/** 상대 시각 라벨 ("방금 전", "3시간 전", "2일 전") — 입력은 경과 ms */
export function relativeTime(elapsedMs: number): string {
  if (elapsedMs < 60 * 1000) return '방금 전';
  if (elapsedMs < H) return `${Math.floor(elapsedMs / (60 * 1000))}분 전`;
  if (elapsedMs < D) return `${Math.floor(elapsedMs / H)}시간 전`;
  return `${Math.floor(elapsedMs / D)}일 전`;
}
