import { randomUUID } from 'node:crypto';
import { adminDb } from '../config/firebase';
import type { Comment, CommentWithUser, User } from '../types';

const COMMENTS = 'comments';
const USERS = 'users';

async function getUserById(userId: string): Promise<User | null> {
  const snap = await adminDb.collection(USERS).doc(userId).get();
  if (!snap.exists) return null;
  return snap.data() as User;
}

interface CreateCommentPayload {
  eventId: string;
  content: string;
}

export async function getCommentsByEventId(
  eventId: string,
): Promise<CommentWithUser[]> {
  const snap = await adminDb
    .collection(COMMENTS)
    .where('eventId', '==', eventId)
    .orderBy('createdAt', 'desc')
    .get();

  const comments: CommentWithUser[] = [];
  for (const doc of snap.docs) {
    const data = doc.data() as Comment;
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

export async function createComment(
  userId: string,
  payload: CreateCommentPayload,
): Promise<Comment> {
  const now = Date.now();
  const id = randomUUID();

  const comment: Comment = {
    id,
    eventId: payload.eventId,
    userId,
    content: payload.content.trim(),
    createdAt: now,
    updatedAt: now,
  };

  await adminDb.collection(COMMENTS).doc(id).set(comment);

  return comment;
}

export async function deleteComment(
  commentId: string,
  userId: string,
  userRole: string,
): Promise<boolean> {
  const doc = await adminDb.collection(COMMENTS).doc(commentId).get();

  if (!doc.exists) return false;

  const data = doc.data() as Comment;

  // Allow deletion if user is the author OR is admin/moderator
  if (data.userId !== userId && userRole !== 'admin' && userRole !== 'moderator') {
    return false;
  }

  await adminDb.collection(COMMENTS).doc(commentId).delete();

  return true;
}