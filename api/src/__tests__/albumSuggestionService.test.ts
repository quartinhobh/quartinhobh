// albumSuggestionService unit tests — mocks Firestore with an in-memory store.

import { describe, expect, it, vi, beforeEach } from 'vitest';

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

vi.mock('../config/firebase', () => ({
  adminDb: {
    collection: () => ({
      doc: (id: string) => makeDocRef(id),
      where: (field: string, _op: string, val: unknown) => {
        const filtered = [...store.values()].filter((d) => d[field] === val);
        const sorted = [...filtered].sort(
          (a, b) => (b['createdAt'] as number) - (a['createdAt'] as number),
        );
        const docs = sorted.map((d) => ({
          id: d['id'] as string,
          data: () => d,
        }));
        return {
          orderBy: () => ({
            get: () => Promise.resolve({ docs }),
          }),
          limit: (n: number) => ({
            get: () =>
              Promise.resolve({
                empty: docs.slice(0, n).length === 0,
                docs: docs.slice(0, n),
              }),
          }),
          get: () => Promise.resolve({ empty: docs.length === 0, docs }),
        };
      },
      orderBy: () => ({
        get: () =>
          Promise.resolve({
            docs: [...store.values()]
              .sort((a, b) => (b['createdAt'] as number) - (a['createdAt'] as number))
              .map((d) => ({ data: () => d })),
          }),
      }),
    }),
  },
  adminAuth: {},
}));

import {
  listAlbumSuggestions,
  createAlbumSuggestion,
  updateAlbumSuggestionStatus,
  deleteAlbumSuggestion,
} from '../services/albumSuggestionService';

beforeEach(() => {
  store.clear();
});

describe('createAlbumSuggestion', () => {
  it('accepts payload with only mbid', async () => {
    const result = await createAlbumSuggestion('uid1', 'user@test.com', {
      mbid: 'some-mbid-123',
    });
    expect(result.status).toBe('suggested');
    expect(result.mbid).toBe('some-mbid-123');
    expect(result.instagramLink).toBeNull();
    expect(typeof result.id).toBe('string');
    expect(typeof result.createdAt).toBe('number');
  });

  it('accepts payload with only spotifyUrl', async () => {
    const result = await createAlbumSuggestion('uid1', 'user@test.com', {
      spotifyUrl: 'https://open.spotify.com/album/abc',
    });
    expect(result.status).toBe('suggested');
    expect(result.spotifyUrl).toBe('https://open.spotify.com/album/abc');
    expect(result.mbid).toBeNull();
  });

  it('accepts payload with only youtubeUrl', async () => {
    const result = await createAlbumSuggestion('uid1', 'user@test.com', {
      youtubeUrl: 'https://www.youtube.com/watch?v=abc',
    });
    expect(result.status).toBe('suggested');
    expect(result.youtubeUrl).toBe('https://www.youtube.com/watch?v=abc');
  });

  it('accepts payload with only albumTitle', async () => {
    const result = await createAlbumSuggestion('uid1', 'user@test.com', {
      albumTitle: 'Rumours',
    });
    expect(result.status).toBe('suggested');
    expect(result.albumTitle).toBe('Rumours');
  });

  it('sets suggestedByUid and suggestedByEmail', async () => {
    const result = await createAlbumSuggestion('uid-x', 'x@test.com', {
      albumTitle: 'Some Album',
    });
    expect(result.suggestedByUid).toBe('uid-x');
    expect(result.suggestedByEmail).toBe('x@test.com');
  });

  it('sets suggestedByUid/Email to null for anonymous', async () => {
    const result = await createAlbumSuggestion(null, null, {
      albumTitle: 'Anonymous Album',
    });
    expect(result.suggestedByUid).toBeNull();
    expect(result.suggestedByEmail).toBeNull();
  });

  it('derives coverUrl from mbid via Cover Art Archive', async () => {
    const result = await createAlbumSuggestion(null, null, {
      mbid: 'release-abc-123',
    });
    expect(result.coverUrl).toBe('https://coverartarchive.org/release/release-abc-123/front-250');
  });

  it('sets coverUrl to null when mbid is absent', async () => {
    const result = await createAlbumSuggestion(null, null, {
      albumTitle: 'No Cover',
    });
    expect(result.coverUrl).toBeNull();
  });

  it('instagramLink is always null in new docs', async () => {
    const result = await createAlbumSuggestion(null, null, {
      albumTitle: 'New Doc',
    });
    expect(result.instagramLink).toBeNull();
  });

  it('truncates notes silently to 500 chars', async () => {
    const longNotes = 'a'.repeat(600);
    const result = await createAlbumSuggestion(null, null, {
      albumTitle: 'Notes Album',
      notes: longNotes,
    });
    expect(result.notes).toHaveLength(500);
  });

  it('stores notes when under 500 chars', async () => {
    const result = await createAlbumSuggestion(null, null, {
      albumTitle: 'Short Notes',
      notes: 'short note',
    });
    expect(result.notes).toBe('short note');
  });

  it('throws payload_required when no identifier provided', async () => {
    await expect(
      createAlbumSuggestion('uid1', 'user@test.com', {}),
    ).rejects.toThrow('payload_required');
  });

  it('throws payload_required when all fields are empty strings', async () => {
    await expect(
      createAlbumSuggestion('uid1', 'user@test.com', {
        mbid: '   ',
        albumTitle: '',
        spotifyUrl: null,
        youtubeUrl: undefined,
      }),
    ).rejects.toThrow('payload_required');
  });

  it('throws invalid_spotify_url for non-spotify URL', async () => {
    await expect(
      createAlbumSuggestion(null, null, {
        spotifyUrl: 'https://soundcloud.com/track/abc',
      }),
    ).rejects.toThrow('invalid_spotify_url');
  });

  it('throws invalid_youtube_url for non-youtube URL', async () => {
    await expect(
      createAlbumSuggestion(null, null, {
        youtubeUrl: 'https://vimeo.com/12345',
      }),
    ).rejects.toThrow('invalid_youtube_url');
  });

  it('accepts youtu.be short URL', async () => {
    const result = await createAlbumSuggestion(null, null, {
      youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
    });
    expect(result.youtubeUrl).toBe('https://youtu.be/dQw4w9WgXcQ');
  });

  it('new suggestion has suggestionCount = 1', async () => {
    const result = await createAlbumSuggestion(null, null, {
      mbid: 'mb-fresh',
    });
    expect(result.suggestionCount).toBe(1);
  });

  it('dedup by mbid: second submission increments count, no new doc', async () => {
    const first = await createAlbumSuggestion('u1', 'a@b.com', { mbid: 'mb-dup' });
    const second = await createAlbumSuggestion('u2', 'b@c.com', { mbid: 'mb-dup' });
    expect(second.id).toBe(first.id);
    expect(second.suggestionCount).toBe(2);
    const list = await listAlbumSuggestions();
    expect(list).toHaveLength(1);
  });

  it('dedup by spotifyUrl', async () => {
    const url = 'https://open.spotify.com/album/xyz';
    const first = await createAlbumSuggestion(null, null, { spotifyUrl: url });
    const second = await createAlbumSuggestion(null, null, { spotifyUrl: url });
    expect(second.id).toBe(first.id);
    expect(second.suggestionCount).toBe(2);
  });

  it('dedup by youtubeUrl', async () => {
    const url = 'https://youtu.be/abc';
    const first = await createAlbumSuggestion(null, null, { youtubeUrl: url });
    const second = await createAlbumSuggestion(null, null, { youtubeUrl: url });
    expect(second.id).toBe(first.id);
    expect(second.suggestionCount).toBe(2);
  });

  it('dedup by albumTitle + artistName (case-insensitive)', async () => {
    const first = await createAlbumSuggestion(null, null, {
      albumTitle: 'Rumours',
      artistName: 'Fleetwood Mac',
    });
    const second = await createAlbumSuggestion(null, null, {
      albumTitle: 'Rumours',
      artistName: 'fleetwood mac',
    });
    expect(second.id).toBe(first.id);
    expect(second.suggestionCount).toBe(2);
  });

  it('different albumTitle is NOT deduped', async () => {
    await createAlbumSuggestion(null, null, {
      albumTitle: 'Album A',
      artistName: 'Artist',
    });
    await createAlbumSuggestion(null, null, {
      albumTitle: 'Album B',
      artistName: 'Artist',
    });
    const list = await listAlbumSuggestions();
    expect(list).toHaveLength(2);
  });
});

describe('listAlbumSuggestions', () => {
  beforeEach(async () => {
    await createAlbumSuggestion('u1', 'a@b.com', { albumTitle: 'Album One' });
    await new Promise((r) => setTimeout(r, 1)); // ensure different createdAt
    await createAlbumSuggestion('u2', 'b@b.com', { spotifyUrl: 'https://open.spotify.com/album/2' });
  });

  it('returns all suggestions when no status filter', async () => {
    const list = await listAlbumSuggestions();
    expect(list).toHaveLength(2);
  });

  it('returns only suggestions with matching status', async () => {
    const list = await listAlbumSuggestions('suggested');
    expect(list.length).toBe(2);
    expect(list.every((s) => s.status === 'suggested')).toBe(true);
  });

  it('returns empty for status with no matches', async () => {
    const list = await listAlbumSuggestions('liked');
    expect(list).toHaveLength(0);
  });
});

describe('updateAlbumSuggestionStatus', () => {
  it('updates status of existing suggestion', async () => {
    const created = await createAlbumSuggestion('u1', 'a@b.com', {
      albumTitle: 'Update Me',
    });
    await updateAlbumSuggestionStatus(created.id, 'liked');
    const doc = store.get(created.id);
    expect(doc?.['status']).toBe('liked');
  });

  it('throws not_found for missing id', async () => {
    await expect(updateAlbumSuggestionStatus('nonexistent', 'liked')).rejects.toThrow('not_found');
  });
});

describe('deleteAlbumSuggestion', () => {
  it('deletes an existing suggestion', async () => {
    const created = await createAlbumSuggestion('u1', 'a@b.com', {
      albumTitle: 'Delete Me',
    });
    await deleteAlbumSuggestion(created.id);
    expect(store.has(created.id)).toBe(false);
  });

  it('throws not_found for missing id', async () => {
    await expect(deleteAlbumSuggestion('nonexistent')).rejects.toThrow('not_found');
  });
});
