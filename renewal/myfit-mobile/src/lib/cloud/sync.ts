/**
 * 로컬 ↔ 클라우드 치수 동기화 (설계 §D).
 *
 * savedAt(epoch ms) 최신 우선 병합:
 *  - 로컬만 존재      → 클라우드 업로드
 *  - 클라우드만 존재  → 로컬 반영
 *  - 둘 다 존재       → savedAt 큰 쪽이 승자 → 양쪽을 승자로 수렴
 *  - 둘 다 없음       → no-op
 *
 * 어느 방향이든 데이터를 파괴하지 않는다(값 동일 시 idempotent 재쓰기만 발생).
 */

'use client';

import { loadMeasurements, saveMeasurements, isCloudConsented, type Measurements } from '../storage';
import { cloudStore } from './index';

export async function syncMeasurementsOnLogin(uid: string): Promise<Measurements | null> {
  // 클라우드 저장 별도 동의가 없으면 어떤 방향의 동기화도 하지 않는다(위탁 write/read 0, 로컬만 유지).
  // 로그인만으로 개인정보(치수)가 Google로 전송되는 것을 원천 차단(CLO 게이트).
  if (!isCloudConsented()) return null;

  const local = loadMeasurements();
  const remote = await cloudStore.loadMeasurements(uid);

  if (!local && !remote) return null;

  if (local && !remote) {
    await cloudStore.saveMeasurements(uid, local);
    return local;
  }

  if (!local && remote) {
    saveMeasurements(remote); // 로컬 반영
    return remote;
  }

  // 둘 다 존재 — savedAt 최신 우선
  const localTs = local!.savedAt ?? 0;
  const remoteTs = remote!.savedAt ?? 0;
  if (remoteTs > localTs) {
    saveMeasurements(remote!);
    return remote!;
  }
  // 로컬이 최신(또는 동일) → 클라우드 갱신
  await cloudStore.saveMeasurements(uid, local!);
  return local!;
}
