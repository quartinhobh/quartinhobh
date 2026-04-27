// barFeedbackService unit tests — mock Firestore via the firebase config module.
// Subcollection path: barFeedbacks/{barId}/userVotes/{userId}

import { describe, expect, it, vi, beforeEach } from 'vitest';

// In-memory store: barId -> (userId -> doc)
const store = new Map<string, Map<string, Record<string, unknown>>>();

function getBarStore(barId: string): Map<string, Record<string, unknown>> {
  if (!store.has(barId)) store.set(barId, new Map());
  return store.get(barId)!;
}

function makeUserVotesRef(barId: string) {
  return {
    doc: (userId: string) => {
      const barStore = getBarStore(barId);
      return {
        get: () => {
          const data = barStore.get(userId);
          return Promise.resolve({ exists: data !== undefined, data: () => data });
        },
        set: (value: Record<string, unknown>) => {
          barStore.set(userId, structuredClone(value));
          return Promise.resolve();
        },
        update: (patch: Record<string, unknown>) => {
          const existing = barStore.get(userId) ?? {};
          barStore.set(userId, { ...existing, ...patch });
          return Promise.resolve();
        },
        delete: () => {
          barStore.delete(userId);
          return Promise.resolve();
        },
      };
    },
    get: () => {
      const barStore = getBarStore(barId);
      const docs = Array.from(barStore.entries()).map(([id, data]) => ({
        id,
        data: () => data,
        exists: true,
      }));
      return Promise.resolve({ docs });
    },
  };
}

vi.mock('../config/firebase', () => {
  const adminDb = {
    collection: (name: string) => ({
      doc: (barId: string) => ({
        collection: (subName: string) => {
          if (name === 'barFeedbacks' && subName === 'userVotes') {
            return makeUserVotesRef(barId);
          }
          throw new Error(`unknown subcollection: ${name}/${subName}`);
        },
      }),
    }),
  };
  return { adminDb, adminAuth: {} };
});

import {
  getFeedbackCount,
  getUserFeedback,
  upsertFeedback,
  deleteFeedback,
} from '../services/barFeedbackService';

beforeEach(() => {
  store.clear();
});

describe('getFeedbackCount', () => {
  it('returns { liked: 0, disliked: 0 } for an empty bar', async () => {
    const result = await getFeedbackCount('bar1');
    expect(result).toEqual({ liked: 0, disliked: 0 });
  });

  it('counts likes and dislikes correctly', async () => {
    await upsertFeedback('bar1', 'u1', 'liked');
    await upsertFeedback('bar1', 'u2', 'liked');
    await upsertFeedback('bar1', 'u3', 'disliked');

    const result = await getFeedbackCount('bar1');
    expect(result).toEqual({ liked: 2, disliked: 1 });
  });

  it('counts independently per bar', async () => {
    await upsertFeedback('barA', 'u1', 'liked');
    await upsertFeedback('barB', 'u1', 'disliked');
    await upsertFeedback('barB', 'u2', 'disliked');

    expect(await getFeedbackCount('barA')).toEqual({ liked: 1, disliked: 0 });
    expect(await getFeedbackCount('barB')).toEqual({ liked: 0, disliked: 2 });
  });
});

describe('getUserFeedback', () => {
  it('returns null when no vote exists', async () => {
    expect(await getUserFeedback('bar1', 'u1')).toBeNull();
  });

  it('returns the user vote after upsert', async () => {
    await upsertFeedback('bar1', 'u1', 'liked');
    const fb = await getUserFeedback('bar1', 'u1');
    expect(fb?.vote).toBe('liked');
    expect(typeof fb?.createdAt).toBe('number');
  });
});

describe('upsertFeedback', () => {
  it('creates vote doc on first call', async () => {
    await upsertFeedback('bar1', 'u1', 'liked');
    const fb = await getUserFeedback('bar1', 'u1');
    expect(fb?.vote).toBe('liked');
  });

  it('updates only vote field on second call (preserves createdAt)', async () => {
    await upsertFeedback('bar1', 'u1', 'liked');
    const first = await getUserFeedback('bar1', 'u1');
    const originalCreatedAt = first?.createdAt;

    await upsertFeedback('bar1', 'u1', 'disliked');
    const second = await getUserFeedback('bar1', 'u1');
    expect(second?.vote).toBe('disliked');
    expect(second?.createdAt).toBe(originalCreatedAt);
  });

  it('is idempotent: same vote twice keeps count at 1', async () => {
    await upsertFeedback('bar1', 'u1', 'liked');
    await upsertFeedback('bar1', 'u1', 'liked');
    const count = await getFeedbackCount('bar1');
    expect(count.liked).toBe(1);
  });
});

describe('deleteFeedback', () => {
  it('deletes an existing vote', async () => {
    await upsertFeedback('bar1', 'u1', 'liked');
    await deleteFeedback('bar1', 'u1');
    expect(await getUserFeedback('bar1', 'u1')).toBeNull();
  });

  it('throws not_found when vote does not exist', async () => {
    await expect(deleteFeedback('bar1', 'u99')).rejects.toThrow('not_found');
  });

  it('updates count after delete', async () => {
    await upsertFeedback('bar1', 'u1', 'liked');
    await upsertFeedback('bar1', 'u2', 'liked');
    await deleteFeedback('bar1', 'u1');
    const count = await getFeedbackCount('bar1');
    expect(count).toEqual({ liked: 1, disliked: 0 });
  });
});
