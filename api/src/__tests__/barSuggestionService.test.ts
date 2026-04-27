// barSuggestionService unit tests — mocks Firestore with an in-memory store.

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { BarSuggestion } from '../types';

const store = new Map<string, Record<string, unknown>>();

function makeDocRef(id: string) {
  return {
    id,
    get: () => {
      const data = store.get(id);
      return Promise.resolve({ exists: data !== undefined, id, data: () => data });
    },
    set: (value: Record<string, unknown>) => {
      store.set(id, structuredClone(value));
      return Promise.resolve();
    },
    update: (patch: Record<string, unknown>) => {
      const existing = store.get(id) ?? {};
      store.set(id, { ...existing, ...patch });
      return Promise.resolve();
    },
    delete: () => {
      store.delete(id);
      return Promise.resolve();
    },
  };
}

function makeCollectionRef() {
  return {
    doc: (id: string) => makeDocRef(id),
    orderBy: (_field: string, _dir?: string) => ({
      get: () => {
        const docs = [...store.entries()].map(([id, data]) => ({
          id,
          data: () => data,
        }));
        return Promise.resolve({ docs });
      },
      where: (_f: string, _op: string, _val: unknown) => ({
        orderBy: (_f2: string, _dir2?: string) => ({
          get: () => {
            const docs = [...store.entries()]
              .filter(([, data]) => data['status'] === _val)
              .map(([id, data]) => ({ id, data: () => data }));
            return Promise.resolve({ docs });
          },
        }),
      }),
    }),
    where: (_field: string, _op: string, val: unknown) => ({
      orderBy: (_f2: string, _dir2?: string) => ({
        get: () => {
          const docs = [...store.entries()]
            .filter(([, data]) => data['status'] === val)
            .map(([id, data]) => ({ id, data: () => data }));
          return Promise.resolve({ docs });
        },
      }),
    }),
  };
}

vi.mock('../config/firebase', () => ({
  adminDb: {
    collection: (_name: string) => makeCollectionRef(),
  },
  adminAuth: {},
}));

import {
  listBarSuggestions,
  listBarSuggestionsByStatus,
  getBarSuggestion,
  createBarSuggestion,
  updateBarSuggestionStatus,
  deleteBarSuggestion,
} from '../services/barSuggestionService';

function seedBar(overrides: Partial<BarSuggestion> = {}): BarSuggestion {
  const bar: BarSuggestion = {
    id: 'bar1',
    status: 'suggested',
    suggestedByUid: 'uid1',
    suggestedByEmail: 'u@test.com',
    createdAt: 1000,
    updatedAt: 1000,
    name: 'Bar Teste',
    address: 'Rua X',
    instagram: '@barteste',
    isClosed: false,
    hasSoundSystem: true,
    ...overrides,
  };
  store.set(bar.id, bar as unknown as Record<string, unknown>);
  return bar;
}

beforeEach(() => {
  store.clear();
});

describe('listBarSuggestions', () => {
  it('returns all bars without status field', async () => {
    seedBar();
    const results = await listBarSuggestions();
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Bar Teste');
    expect((results[0] as Record<string, unknown>)['status']).toBeUndefined();
  });

  it('returns empty array when no bars', async () => {
    const results = await listBarSuggestions();
    expect(results).toEqual([]);
  });
});

describe('listBarSuggestionsByStatus', () => {
  it('returns only bars with matching status (includes status field)', async () => {
    seedBar({ id: 'bar1', status: 'suggested' });
    seedBar({ id: 'bar2', status: 'liked' });
    const results = await listBarSuggestionsByStatus('suggested');
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('suggested');
  });

  it('returns empty array when no match', async () => {
    seedBar({ id: 'bar1', status: 'suggested' });
    const results = await listBarSuggestionsByStatus('liked');
    expect(results).toEqual([]);
  });
});

describe('getBarSuggestion', () => {
  it('returns bar without status when found', async () => {
    seedBar();
    const result = await getBarSuggestion('bar1');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Bar Teste');
    expect((result as Record<string, unknown>)['status']).toBeUndefined();
  });

  it('returns null when not found', async () => {
    const result = await getBarSuggestion('missing');
    expect(result).toBeNull();
  });
});

describe('createBarSuggestion', () => {
  it('creates bar with correct fields', async () => {
    const bar = await createBarSuggestion('uid1', 'u@test.com', {
      name: '  Novo Bar  ',
      address: 'Rua Y',
      instagram: '@novobar',
      isClosed: false,
      hasSoundSystem: true,
    });
    expect(bar.name).toBe('Novo Bar');
    expect(bar.status).toBe('suggested');
    expect(bar.suggestedByUid).toBe('uid1');
    expect(bar.suggestedByEmail).toBe('u@test.com');
    expect(typeof bar.id).toBe('string');
    expect(typeof bar.createdAt).toBe('number');
  });

  it('defaults optional fields correctly', async () => {
    const bar = await createBarSuggestion(null, null, { name: 'Anon Bar' });
    expect(bar.address).toBeNull();
    expect(bar.instagram).toBeNull();
    expect(bar.isClosed).toBe(false);
    expect(bar.hasSoundSystem).toBe(false);
    expect(bar.suggestedByUid).toBeNull();
    expect(bar.suggestedByEmail).toBeNull();
  });

  it('throws name_required when name is empty', async () => {
    await expect(createBarSuggestion('uid1', null, { name: '   ' })).rejects.toThrow(
      'name_required',
    );
  });

  it('throws name_required when name is missing', async () => {
    await expect(
      createBarSuggestion('uid1', null, { name: undefined as unknown as string }),
    ).rejects.toThrow('name_required');
  });

  it('result does not have a knowsOwner property', async () => {
    const bar = await createBarSuggestion('uid1', 'u@test.com', { name: 'Test Bar' });
    expect((bar as unknown as Record<string, unknown>)['knowsOwner']).toBeUndefined();
  });
});

describe('updateBarSuggestionStatus', () => {
  it('updates status on existing bar', async () => {
    seedBar();
    await updateBarSuggestionStatus('bar1', 'liked');
    const updated = store.get('bar1');
    expect(updated?.['status']).toBe('liked');
    expect(typeof updated?.['updatedAt']).toBe('number');
  });

  it('throws not_found when bar does not exist', async () => {
    await expect(updateBarSuggestionStatus('ghost', 'liked')).rejects.toThrow('not_found');
  });
});

describe('deleteBarSuggestion', () => {
  it('deletes existing bar', async () => {
    seedBar();
    await deleteBarSuggestion('bar1');
    expect(store.has('bar1')).toBe(false);
  });

  it('throws not_found when bar does not exist', async () => {
    await expect(deleteBarSuggestion('ghost')).rejects.toThrow('not_found');
  });
});
