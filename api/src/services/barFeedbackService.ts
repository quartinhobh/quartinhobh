import { adminDb } from '../config/firebase';
import type { BarFeedback } from '../types';

function votesRef(barId: string) {
  return adminDb.collection('barFeedbacks').doc(barId).collection('userVotes');
}

/**
 * Get aggregated feedback counts for a bar.
 * Returns { liked: N, disliked: N }.
 */
export async function getFeedbackCount(
  barId: string,
): Promise<{ liked: number; disliked: number }> {
  const snap = await votesRef(barId).get();
  let liked = 0;
  let disliked = 0;
  for (const doc of snap.docs) {
    const data = doc.data() as BarFeedback;
    if (data.vote === 'liked') liked++;
    else if (data.vote === 'disliked') disliked++;
  }
  return { liked, disliked };
}

/**
 * Get a single user's vote for a bar. Returns null if no vote exists.
 */
export async function getUserFeedback(
  barId: string,
  userId: string,
): Promise<BarFeedback | null> {
  const snap = await votesRef(barId).doc(userId).get();
  if (!snap.exists) return null;
  return snap.data() as BarFeedback;
}

/**
 * Create or overwrite a user's vote for a bar (idempotent).
 * If document already exists: update only the `vote` field (preserve createdAt).
 * If document does not exist: create with { vote, createdAt: Date.now() }.
 */
export async function upsertFeedback(
  barId: string,
  userId: string,
  vote: 'liked' | 'disliked',
): Promise<void> {
  const ref = votesRef(barId).doc(userId);
  const snap = await ref.get();
  if (snap.exists) {
    await ref.update({ vote });
  } else {
    await ref.set({ vote, createdAt: Date.now() });
  }
}

/**
 * Delete a user's vote for a bar.
 * Throws Error('not_found') if vote document does not exist.
 */
export async function deleteFeedback(barId: string, userId: string): Promise<void> {
  const ref = votesRef(barId).doc(userId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('not_found');
  await ref.delete();
}
