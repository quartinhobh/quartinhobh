import { randomUUID } from 'node:crypto';
import { adminDb } from '../config/firebase';
import type {
  BarSuggestion,
  PublicBarSuggestion,
  SuggestionStatus,
  CreateBarSuggestionPayload,
} from '../types';

const COLLECTION = 'barSuggestions';

/**
 * List ALL bars ordered by createdAt DESC — no status filter.
 * Used by the public endpoint. Strips the `status` field from each result.
 */
export async function listBarSuggestions(): Promise<PublicBarSuggestion[]> {
  const snap = await adminDb.collection(COLLECTION).orderBy('createdAt', 'desc').get();
  return snap.docs.map((doc) => {
    const { status, ...pub } = doc.data() as BarSuggestion;
    void status;
    return pub as PublicBarSuggestion;
  });
}

/**
 * List bars filtered by status — admin internal use only.
 */
export async function listBarSuggestionsByStatus(
  status: SuggestionStatus,
): Promise<BarSuggestion[]> {
  const snap = await adminDb
    .collection(COLLECTION)
    .where('status', '==', status)
    .orderBy('createdAt', 'desc')
    .get();
  return snap.docs.map((doc) => doc.data() as BarSuggestion);
}

/**
 * Get a single bar by ID. Returns null if not found. Strips status field.
 */
export async function getBarSuggestion(id: string): Promise<PublicBarSuggestion | null> {
  const snap = await adminDb.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  const { status, ...pub } = snap.data() as BarSuggestion;
  void status;
  return pub as PublicBarSuggestion;
}

/**
 * Create a new bar suggestion.
 * uid and email are null for anonymous users.
 */
export async function createBarSuggestion(
  uid: string | null,
  email: string | null,
  payload: CreateBarSuggestionPayload,
): Promise<BarSuggestion> {
  if (!payload.name?.trim()) throw new Error('name_required');

  const now = Date.now();
  const id = randomUUID();

  const bar: BarSuggestion = {
    id,
    status: 'suggested',
    suggestedByUid: uid,
    suggestedByEmail: email,
    createdAt: now,
    updatedAt: now,
    name: payload.name.trim(),
    address: payload.address?.trim() ?? null,
    instagram: payload.instagram?.trim() ?? null,
    isClosed: payload.isClosed ?? false,
    hasSoundSystem: payload.hasSoundSystem ?? false,
  };

  await adminDb.collection(COLLECTION).doc(id).set(bar);

  return bar;
}

/**
 * Update the status field of a bar suggestion (admin only).
 * Throws Error('not_found') if document does not exist.
 */
export async function updateBarSuggestionStatus(
  id: string,
  status: SuggestionStatus,
): Promise<void> {
  const snap = await adminDb.collection(COLLECTION).doc(id).get();
  if (!snap.exists) throw new Error('not_found');
  await adminDb.collection(COLLECTION).doc(id).update({ status, updatedAt: Date.now() });
}

/**
 * Delete a bar suggestion document.
 * Throws Error('not_found') if document does not exist.
 */
export async function deleteBarSuggestion(id: string): Promise<void> {
  const snap = await adminDb.collection(COLLECTION).doc(id).get();
  if (!snap.exists) throw new Error('not_found');
  await adminDb.collection(COLLECTION).doc(id).delete();
}
