// suggestionCommentService unit tests — mocks Firestore with an in-memory store.

import { describe, expect, it, vi, beforeEach } from 'vitest';

interface Store {
  suggestionComments: Map<string, Record<string, unknown>>;
  users: Map<string, Record<string, unknown>>;
}

const store: Store = {
  suggestionComments: new Map(),
  users: new Map(),
};

function collectionMap(name: string): Map<string, Record<string, unknown>> {
  if (name === 'suggestionComments') return store.suggestionComments;
  if (name === 'users') return store.users;
  throw new Error(`unknown collection: ${name}`);
}

function makeDocRef(col: string, id: string) {
  return {
    id,
    get: () => {
      const data = collectionMap(col).get(id);
      return Promise.resolve({ exists: data !== undefined, id, data: () => data });
    },
    set: (value: Record<string, unknown>) => {
      collectionMap(col).set(id, structuredClone(value));
      return Promise.resolve();
    },
    delete: () => {
      collectionMap(col).delete(id);
      return Promise.resolve();
    },
  };
}

function makeQueryBuilder(col: string, filters: Array<[string, string, unknown]> = [], order?: { field: string; dir: string }) {
  const builder = {
    where(field: string, op: string, value: unknown) {
      return makeQueryBuilder(col, [...filters, [field, op, value]], order);
    },
    orderBy(field: string, dir: string) {
      return makeQueryBuilder(col, filters, { field, dir });
    },
    get() {
      const map = collectionMap(col);
      let docs = Array.from(map.entries())
        .filter(([, data]) => {
          return filters.every(([field, op, value]) => {
            if (op === '==') return data[field] === value;
            return true;
          });
        })
        .map(([id, data]) => ({ id, data: () => data, exists: true }));

      if (order) {
        const { field, dir } = order;
        docs = docs.sort((a, b) => {
          const av = a.data()[field] as number;
          const bv = b.data()[field] as number;
          return dir === 'asc' ? av - bv : bv - av;
        });
      }

      return Promise.resolve({ docs });
    },
  };
  return builder;
}

vi.mock('../config/firebase', () => ({
  adminDb: {
    collection: (name: string) => ({
      doc: (id: string) => makeDocRef(name, id),
      where: (field: string, op: string, value: unknown) =>
        makeQueryBuilder(name, [[field, op, value]]),
    }),
  },
  adminAuth: {},
}));

import {
  getCommentsBySuggestionId,
  createSuggestionComment,
  deleteSuggestionComment,
} from '../services/suggestionCommentService';

beforeEach(() => {
  store.suggestionComments.clear();
  store.users.clear();
});

describe('createSuggestionComment', () => {
  it('creates a comment with trimmed content and returns it', async () => {
    const result = await createSuggestionComment('user-1', {
      suggestionId: 'sug-1',
      suggestionType: 'bar',
      content: '  great suggestion  ',
    });

    expect(result.id).toBeDefined();
    expect(result.userId).toBe('user-1');
    expect(result.suggestionId).toBe('sug-1');
    expect(result.suggestionType).toBe('bar');
    expect(result.content).toBe('great suggestion');
    expect(typeof result.createdAt).toBe('number');
    expect(typeof result.updatedAt).toBe('number');
  });

  it('persists the comment to Firestore', async () => {
    const result = await createSuggestionComment('user-2', {
      suggestionId: 'sug-2',
      suggestionType: 'album',
      content: 'nice album',
    });

    const stored = store.suggestionComments.get(result.id);
    expect(stored).toBeDefined();
    expect(stored!['content']).toBe('nice album');
  });
});

describe('getCommentsBySuggestionId', () => {
  it('returns comments for the given suggestion, ordered by createdAt ASC', async () => {
    store.suggestionComments.set('c1', {
      id: 'c1', suggestionId: 'sug-1', suggestionType: 'bar',
      userId: 'u1', content: 'second', createdAt: 2000, updatedAt: 2000,
    });
    store.suggestionComments.set('c2', {
      id: 'c2', suggestionId: 'sug-1', suggestionType: 'bar',
      userId: 'u2', content: 'first', createdAt: 1000, updatedAt: 1000,
    });
    store.users.set('u1', { id: 'u1', displayName: 'Alice', avatarUrl: 'url1' });
    store.users.set('u2', { id: 'u2', displayName: 'Bob', avatarUrl: null });

    const results = await getCommentsBySuggestionId('sug-1');

    expect(results).toHaveLength(2);
    expect(results[0].content).toBe('first');
    expect(results[0].user.displayName).toBe('Bob');
    expect(results[1].content).toBe('second');
    expect(results[1].user.displayName).toBe('Alice');
  });

  it('filters out comments from other suggestions', async () => {
    store.suggestionComments.set('c1', {
      id: 'c1', suggestionId: 'sug-1', suggestionType: 'bar',
      userId: 'u1', content: 'mine', createdAt: 1000, updatedAt: 1000,
    });
    store.suggestionComments.set('c2', {
      id: 'c2', suggestionId: 'sug-OTHER', suggestionType: 'bar',
      userId: 'u1', content: 'other', createdAt: 2000, updatedAt: 2000,
    });

    const results = await getCommentsBySuggestionId('sug-1');
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('mine');
  });

  it('falls back to Unknown user when user not found', async () => {
    store.suggestionComments.set('c1', {
      id: 'c1', suggestionId: 'sug-x', suggestionType: 'album',
      userId: 'missing-user', content: 'hello', createdAt: 1000, updatedAt: 1000,
    });

    const results = await getCommentsBySuggestionId('sug-x');
    expect(results[0].user.displayName).toBe('Unknown');
    expect(results[0].user.avatarUrl).toBeNull();
    expect(results[0].user.id).toBe('missing-user');
  });

  it('returns empty array when no comments exist for suggestion', async () => {
    const results = await getCommentsBySuggestionId('nonexistent-sug');
    expect(results).toHaveLength(0);
  });
});

describe('deleteSuggestionComment', () => {
  it('returns false when comment does not exist', async () => {
    const result = await deleteSuggestionComment('nonexistent', 'user-1', 'member');
    expect(result).toBe(false);
  });

  it('returns false when user is not the author and not admin/moderator', async () => {
    store.suggestionComments.set('c1', {
      id: 'c1', suggestionId: 'sug-1', suggestionType: 'bar',
      userId: 'author', content: 'hello', createdAt: 1000, updatedAt: 1000,
    });

    const result = await deleteSuggestionComment('c1', 'other-user', 'member');
    expect(result).toBe(false);
    expect(store.suggestionComments.has('c1')).toBe(true);
  });

  it('allows author to delete their own comment', async () => {
    store.suggestionComments.set('c1', {
      id: 'c1', suggestionId: 'sug-1', suggestionType: 'bar',
      userId: 'author', content: 'hello', createdAt: 1000, updatedAt: 1000,
    });

    const result = await deleteSuggestionComment('c1', 'author', 'member');
    expect(result).toBe(true);
    expect(store.suggestionComments.has('c1')).toBe(false);
  });

  it('allows admin to delete any comment', async () => {
    store.suggestionComments.set('c1', {
      id: 'c1', suggestionId: 'sug-1', suggestionType: 'bar',
      userId: 'author', content: 'hello', createdAt: 1000, updatedAt: 1000,
    });

    const result = await deleteSuggestionComment('c1', 'admin-user', 'admin');
    expect(result).toBe(true);
    expect(store.suggestionComments.has('c1')).toBe(false);
  });

  it('allows moderator to delete any comment', async () => {
    store.suggestionComments.set('c1', {
      id: 'c1', suggestionId: 'sug-1', suggestionType: 'bar',
      userId: 'author', content: 'hello', createdAt: 1000, updatedAt: 1000,
    });

    const result = await deleteSuggestionComment('c1', 'mod-user', 'moderator');
    expect(result).toBe(true);
    expect(store.suggestionComments.has('c1')).toBe(false);
  });
});
