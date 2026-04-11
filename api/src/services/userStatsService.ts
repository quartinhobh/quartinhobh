import { adminDb } from '../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';

export interface UserStats {
  userId: string;
  stickersClicked: number;
  profilesVisited: number;
  profileViewsReceived: number;
  updatedAt: number;
}

const COLLECTION = 'userStats';

type StatField = 'stickersClicked' | 'profilesVisited' | 'profileViewsReceived';

export async function incrementStat(userId: string, field: StatField, by = 1): Promise<void> {
  if (!userId) return;
  const ref = adminDb.collection(COLLECTION).doc(userId);
  await ref.set(
    {
      userId,
      [field]: FieldValue.increment(by),
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}

export async function getUserStats(userId: string): Promise<UserStats | null> {
  const snap = await adminDb.collection(COLLECTION).doc(userId).get();
  if (!snap.exists) return null;
  return snap.data() as UserStats;
}
