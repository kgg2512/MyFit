/**
 * CloudStore의 Firestore 구현 (현재 백엔드). 이 파일 + firebase.ts만이
 * firebase/firestore 를 직접 import 한다(어댑터 격리).
 *
 * 스키마: profiles/{uid} = { height, weight, shoulder, chest, waist, hip, savedAt, updatedAt }
 * Security Rules(firestore.rules): 본인 uid만 read/write.
 */

'use client';

import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { getFirebaseDb, FIREBASE_ENABLED } from '../firebase';
import type { Measurements } from '../storage';
import type { CloudStore } from './CloudStore';

const COLLECTION = 'profiles';

/** 서버 문서 → Measurements (필드 화이트리스트 — 임의 필드 무시, 숫자 강제). */
function toMeasurements(d: Record<string, unknown>): Measurements | null {
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
  const m: Measurements = {
    height: num(d.height),
    weight: num(d.weight),
    shoulder: num(d.shoulder),
    chest: num(d.chest),
    waist: num(d.waist),
    hip: num(d.hip),
    savedAt: typeof d.savedAt === 'number' ? d.savedAt : undefined,
  };
  // 필수 6종 중 하나라도 손상이면 무효 처리.
  if ([m.height, m.weight, m.shoulder, m.chest, m.waist, m.hip].some(Number.isNaN)) return null;
  return m;
}

export class FirestoreStore implements CloudStore {
  readonly available = FIREBASE_ENABLED;

  async loadMeasurements(uid: string): Promise<Measurements | null> {
    const db = getFirebaseDb();
    if (!db) return null;
    const snap = await getDoc(doc(db, COLLECTION, uid));
    if (!snap.exists()) return null;
    return toMeasurements(snap.data() as Record<string, unknown>);
  }

  async saveMeasurements(uid: string, m: Measurements): Promise<void> {
    const db = getFirebaseDb();
    if (!db) return;
    await setDoc(doc(db, COLLECTION, uid), {
      height: m.height,
      weight: m.weight,
      shoulder: m.shoulder,
      chest: m.chest,
      waist: m.waist,
      hip: m.hip,
      savedAt: m.savedAt ?? Date.now(),
      updatedAt: Date.now(),
    });
  }

  async deleteAll(uid: string): Promise<void> {
    const db = getFirebaseDb();
    if (!db) return;
    await deleteDoc(doc(db, COLLECTION, uid));
  }
}
