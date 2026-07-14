/**
 * 클라우드 저장 추상화 인터페이스 (설계 §B).
 * 치수(숫자)만 다룬다. 사진은 온디바이스 유지(설계 §E — Firebase Storage 미사용).
 */

import type { Measurements } from '../storage';

export interface CloudStore {
  /** 이 빌드에서 클라우드 저장이 사용 가능한지(firebase 비활성 빌드 = false). */
  readonly available: boolean;

  /** uid의 치수 로드. 문서 없으면 null. */
  loadMeasurements(uid: string): Promise<Measurements | null>;

  /** uid의 치수 저장(덮어쓰기). */
  saveMeasurements(uid: string, m: Measurements): Promise<void>;

  /** uid의 모든 클라우드 데이터 삭제(PIPA 삭제권). */
  deleteAll(uid: string): Promise<void>;
}
