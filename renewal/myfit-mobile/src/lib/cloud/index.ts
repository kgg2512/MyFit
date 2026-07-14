/**
 * 클라우드 저장 싱글톤 — 구현체 선택은 오직 이 파일에서만 한다.
 * 백엔드 교체 시 여기 한 줄만 바꾼다.
 */

import { FirestoreStore } from './FirestoreStore';
import type { CloudStore } from './CloudStore';

export type { CloudStore } from './CloudStore';

export const cloudStore: CloudStore = new FirestoreStore();
