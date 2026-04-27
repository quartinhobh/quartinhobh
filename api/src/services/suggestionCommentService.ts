import { randomUUID } from 'node:crypto';
import { adminDb } from '../config/firebase';
import type { SuggestionComment, SuggestionCommentWithUser, CreateSuggestionCommentPayload, User } from '../types';

const SUGGESTION_COMMENTS = 'suggestionComments';
const USERS = 'users';

async function getUserById(userId: string): Promise<User | null> {
  const snap = await adminDb.collection(USERS).doc(userId).get();
  if (!snap.exists) return null;
  return snap.data() as User;
}

/**
 * Get all comments for a suggestion, ordered by createdAt ASC (oldest first).
 * Joins each comment with user data from the 'users' collection.
 * Falls back to { id, displayName: 'Unknown', avatarUrl: null } on user lookup failure.
 */
export async function getCommentsBySuggestionId(
  suggestionId: string,
): Promise<SuggestionCommentWithUser[]> {
  const snap = await adminDb
    .collection(SUGGESTION_COMMENTS)
    .where('suggestionId', '==', suggestionId)
    .orderBy('createdAt', 'asc')
    .get();

  const comments: SuggestionCommentWithUser[] = [];
  for (const doc of snap.docs) {
    const data = doc.data() as SuggestionComment;
    try {
      const user = await getUserById(data.userId);
      comments.push({
        ...data,
        user: user
          ? {
              id: user.id,
              displayName: user.displayName,
              avatarUrl: user.avatarUrl,
            }
          : { id: data.userId, displayName: 'Unknown', avatarUrl: null },
      });
    } catch {
      comments.push({
        ...data,
        user: { id: data.userId, displayName: 'Unknown', avatarUrl: null },
      });
    }
  }

  return comments;
}

/**
 * Create a new suggestion comment.
 * userId must be the authenticated user's uid.
 * content is trimmed. Sets createdAt and updatedAt = Date.now().
 */
export async function createSuggestionComment(
  userId: string,
  payload: CreateSuggestionCommentPayload,
): Promise<SuggestionComment> {
  const now = Date.now();
  const id = randomUUID();

  const comment: SuggestionComment = {
    id,
    suggestionId: payload.suggestionId,
    suggestionType: payload.suggestionType,
    userId,
    content: payload.content.trim(),
    createdAt: now,
    updatedAt: now,
  };

  await adminDb.collection(SUGGESTION_COMMENTS).doc(id).set(comment);

  return comment;
}

/**
 * Delete a suggestion comment.
 * Allows deletion if: comment.userId === userId OR userRole is 'admin' or 'moderator'.
 * Returns false if document not found or permission denied.
 * Returns true on successful deletion.
 */
export async function deleteSuggestionComment(
  commentId: string,
  userId: string,
  userRole: string,
): Promise<boolean> {
  const doc = await adminDb.collection(SUGGESTION_COMMENTS).doc(commentId).get();

  if (!doc.exists) return false;

  const data = doc.data() as SuggestionComment;

  // Allow deletion if user is the author OR is admin/moderator
  if (data.userId !== userId && userRole !== 'admin' && userRole !== 'moderator') {
    return false;
  }

  await adminDb.collection(SUGGESTION_COMMENTS).doc(commentId).delete();

  return true;
}
