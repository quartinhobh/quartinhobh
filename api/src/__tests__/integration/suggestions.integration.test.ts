/**
 * Suggestions Integration Tests — runs against Firebase Emulators.
 *
 * Prerequisites:
 *   make up  (or: docker compose -f docker-compose.test.yml up -d)
 *
 * Run:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 \
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *   bun run test:emulators
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';

const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'quartinho-emulator';

// Skip if not running against emulators
const SKIP = !FIRESTORE_HOST;

describe.skipIf(SKIP)('Suggestions Integration', () => {
  let adminDb: FirebaseFirestore.Firestore;
  let adminAuth: import('firebase-admin/auth').Auth;
  let app: import('express').Express;

  beforeAll(async () => {
    const firebase = await import('../../config/firebase');
    adminDb = firebase.adminDb;
    adminAuth = firebase.adminAuth;
    const idx = await import('../../index');
    app = idx.default;
  });

  beforeEach(async () => {
    // Clear Firestore emulator data
    await fetch(
      `http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
      { method: 'DELETE' },
    );
    // Clear Auth emulator data
    await fetch(
      `http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`,
      { method: 'DELETE' },
    ).catch(() => {});
  });

  // ── Helpers ──────────────────────────────────────────────────────────────

  async function mintIdToken(uid: string): Promise<string> {
    const customToken = await adminAuth.createCustomToken(uid);
    const res = await fetch(
      `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: customToken, returnSecureToken: true }),
      },
    );
    const json = (await res.json()) as { idToken: string };
    return json.idToken;
  }

  async function getAdminToken(): Promise<string> {
    const uid = `admin-${Date.now()}`;
    const user = await adminAuth.createUser({
      uid,
      email: `${uid}@example.com`,
      password: 'testpass123',
      displayName: 'Admin User',
      emailVerified: true,
    });
    await adminDb.collection('users').doc(user.uid).set({
      id: user.uid,
      email: user.email,
      displayName: 'Admin User',
      username: null,
      role: 'admin',
      linkedSessionId: null,
      avatarUrl: null,
      bio: null,
      socialLinks: [],
      favoriteAlbums: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return mintIdToken(user.uid);
  }

  async function getUserToken(): Promise<{ uid: string; email: string; token: string }> {
    const uid = `user-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const email = `${uid}@example.com`;
    const user = await adminAuth.createUser({
      uid,
      email,
      password: 'testpass123',
      displayName: 'Regular User',
      emailVerified: true,
    });
    await adminDb.collection('users').doc(user.uid).set({
      id: user.uid,
      email: user.email,
      displayName: 'Regular User',
      username: null,
      role: 'user',
      linkedSessionId: null,
      avatarUrl: null,
      bio: null,
      socialLinks: [],
      favoriteAlbums: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const token = await mintIdToken(user.uid);
    return { uid: user.uid, email, token };
  }

  async function seedBar(partial: { name: string } & Partial<import('../../types').BarSuggestion>): Promise<import('../../types').BarSuggestion> {
    const now = Date.now();
    const id = partial.id ?? `bar-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const bar: import('../../types').BarSuggestion = {
      status: 'suggested',
      suggestedByUid: null,
      suggestedByEmail: null,
      createdAt: now,
      updatedAt: now,
      address: null,
      instagram: null,
      isClosed: false,
      hasSoundSystem: false,
      ...partial,
      id,
    };
    await adminDb.collection('barSuggestions').doc(id).set(bar);
    return bar;
  }

  // ── BARS — public ─────────────────────────────────────────────────────────

  it('POST /suggestions/bars (no auth) → 201, suggestedByUid: null', async () => {
    const res = await request(app)
      .post('/suggestions/bars')
      .send({ name: 'Bar Anonimo' });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.suggestedByUid).toBeNull();
    expect(res.body.data.name).toBe('Bar Anonimo');
  });

  it('POST /suggestions/bars (with auth) → 201, uid and email captured', async () => {
    const { token } = await getUserToken();

    const res = await request(app)
      .post('/suggestions/bars')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bar Autenticado' });

    expect(res.status).toBe(201);
    expect(res.body.data.suggestedByUid).toBeTruthy();
    expect(res.body.data.suggestedByEmail).toBeTruthy();
    expect(res.body.data.name).toBe('Bar Autenticado');
  });

  it('POST /suggestions/bars without name → 400', async () => {
    const res = await request(app)
      .post('/suggestions/bars')
      .send({ address: 'Rua Sem Nome' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('name_required');
  });

  it('GET /suggestions/bars → 200, array, no status field in items', async () => {
    await seedBar({ name: 'Bar Um' });
    await seedBar({ name: 'Bar Dois' });

    const res = await request(app).get('/suggestions/bars');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    for (const item of res.body.data as Record<string, unknown>[]) {
      expect(item).not.toHaveProperty('status');
    }
  });

  it('GET /suggestions/bars/:id → 200, returns bar', async () => {
    const bar = await seedBar({ name: 'Bar Especifico' });

    const res = await request(app).get(`/suggestions/bars/${bar.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(bar.id);
    expect(res.body.data.name).toBe('Bar Especifico');
    expect(res.body.data).not.toHaveProperty('status');
  });

  it('GET /suggestions/bars/:nonexistent → 404', async () => {
    const res = await request(app).get('/suggestions/bars/does-not-exist-xyz');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  // ── BARS — admin ──────────────────────────────────────────────────────────

  it('PATCH /suggestions/bars/:id/status (no auth) → 401', async () => {
    const bar = await seedBar({ name: 'Bar Sem Auth' });

    const res = await request(app)
      .patch(`/suggestions/bars/${bar.id}/status`)
      .send({ status: 'liked' });

    expect(res.status).toBe(401);
  });

  it('PATCH /suggestions/bars/:id/status (non-admin) → 403', async () => {
    const bar = await seedBar({ name: 'Bar Nao Admin' });
    const { token } = await getUserToken();

    const res = await request(app)
      .patch(`/suggestions/bars/${bar.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'liked' });

    expect(res.status).toBe(403);
  });

  it('PATCH /suggestions/bars/:id/status (admin) → 204', async () => {
    const bar = await seedBar({ name: 'Bar Admin Status' });
    const adminToken = await getAdminToken();

    const res = await request(app)
      .patch(`/suggestions/bars/${bar.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'liked' });

    expect(res.status).toBe(204);
  });

  it('DELETE /suggestions/bars/:id (no auth) → 401', async () => {
    const bar = await seedBar({ name: 'Bar Delete Sem Auth' });

    const res = await request(app).delete(`/suggestions/bars/${bar.id}`);

    expect(res.status).toBe(401);
  });

  it('DELETE /suggestions/bars/:id (admin) → 204', async () => {
    const bar = await seedBar({ name: 'Bar Admin Delete' });
    const adminToken = await getAdminToken();

    const res = await request(app)
      .delete(`/suggestions/bars/${bar.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
  });

  // ── FEEDBACK ──────────────────────────────────────────────────────────────

  it('POST /suggestions/bars/:id/feedback (no auth) → 401', async () => {
    const bar = await seedBar({ name: 'Bar Feedback Sem Auth' });

    const res = await request(app)
      .post(`/suggestions/bars/${bar.id}/feedback`)
      .send({ vote: 'liked' });

    expect(res.status).toBe(401);
  });

  it('POST /suggestions/bars/:id/feedback (auth, vote:liked) → 204', async () => {
    const bar = await seedBar({ name: 'Bar Feedback Like' });
    const { token } = await getUserToken();

    const res = await request(app)
      .post(`/suggestions/bars/${bar.id}/feedback`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vote: 'liked' });

    expect(res.status).toBe(204);
  });

  it('POST /suggestions/bars/:id/feedback (auth, second vote:disliked) → 204 (overwrites)', async () => {
    const bar = await seedBar({ name: 'Bar Feedback Overwrite' });
    const { token } = await getUserToken();

    await request(app)
      .post(`/suggestions/bars/${bar.id}/feedback`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vote: 'liked' });

    const res = await request(app)
      .post(`/suggestions/bars/${bar.id}/feedback`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vote: 'disliked' });

    expect(res.status).toBe(204);
  });

  it('GET /suggestions/bars/:id/feedback → 200, { liked: N, disliked: N }', async () => {
    const bar = await seedBar({ name: 'Bar Feedback Count' });
    const user1 = await getUserToken();
    const user2 = await getUserToken();

    await request(app)
      .post(`/suggestions/bars/${bar.id}/feedback`)
      .set('Authorization', `Bearer ${user1.token}`)
      .send({ vote: 'liked' });

    await request(app)
      .post(`/suggestions/bars/${bar.id}/feedback`)
      .set('Authorization', `Bearer ${user2.token}`)
      .send({ vote: 'disliked' });

    const res = await request(app).get(`/suggestions/bars/${bar.id}/feedback`);

    expect(res.status).toBe(200);
    expect(typeof res.body.data.liked).toBe('number');
    expect(typeof res.body.data.disliked).toBe('number');
    expect(res.body.data.liked).toBe(1);
    expect(res.body.data.disliked).toBe(1);
  });

  it('DELETE /suggestions/bars/:id/feedback (auth) → 204', async () => {
    const bar = await seedBar({ name: 'Bar Feedback Delete' });
    const { token } = await getUserToken();

    await request(app)
      .post(`/suggestions/bars/${bar.id}/feedback`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vote: 'liked' });

    const res = await request(app)
      .delete(`/suggestions/bars/${bar.id}/feedback`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
  });

  // ── BAR COMMENTS ─────────────────────────────────────────────────────────

  it('POST /suggestions/bars/:id/comments (no auth) → 401', async () => {
    const bar = await seedBar({ name: 'Bar Comment Sem Auth' });

    const res = await request(app)
      .post(`/suggestions/bars/${bar.id}/comments`)
      .send({ content: 'Otimo bar!' });

    expect(res.status).toBe(401);
  });

  it('POST /suggestions/bars/:id/comments (auth) → 201', async () => {
    const bar = await seedBar({ name: 'Bar Comment Auth' });
    const { token } = await getUserToken();

    const res = await request(app)
      .post(`/suggestions/bars/${bar.id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Adoro esse bar!' });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.content).toBe('Adoro esse bar!');
  });

  it('GET /suggestions/bars/:id/comments → 200, array', async () => {
    const bar = await seedBar({ name: 'Bar Comments List' });
    const { token } = await getUserToken();

    await request(app)
      .post(`/suggestions/bars/${bar.id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Comentario 1' });

    const res = await request(app).get(`/suggestions/bars/${bar.id}/comments`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  // ── ALBUMS ────────────────────────────────────────────────────────────────

  it('POST /suggestions/albums (no auth) with albumTitle → 201 anonymous', async () => {
    const res = await request(app)
      .post('/suggestions/albums')
      .send({ albumTitle: 'Rumours' });

    expect(res.status).toBe(201);
    expect(res.body.data.suggestedByUid).toBeNull();
    expect(res.body.data.suggestedByEmail).toBeNull();
    expect(res.body.data.albumTitle).toBe('Rumours');
    expect(res.body.data.instagramLink).toBeNull();
  });

  it('POST /suggestions/albums (no auth) with spotifyUrl → 201 anonymous', async () => {
    const res = await request(app)
      .post('/suggestions/albums')
      .send({ spotifyUrl: 'https://open.spotify.com/album/abc123' });

    expect(res.status).toBe(201);
    expect(res.body.data.suggestedByUid).toBeNull();
    expect(res.body.data.spotifyUrl).toBe('https://open.spotify.com/album/abc123');
  });

  it('POST /suggestions/albums (no auth) with mbid → 201, coverUrl set', async () => {
    const res = await request(app)
      .post('/suggestions/albums')
      .send({ mbid: 'mb-release-xyz', albumTitle: 'Test Album' });

    expect(res.status).toBe(201);
    expect(res.body.data.mbid).toBe('mb-release-xyz');
    expect(res.body.data.coverUrl).toBe('https://coverartarchive.org/release/mb-release-xyz/front-250');
  });

  it('POST /suggestions/albums (non-admin user) → 201 with email/uid', async () => {
    const { token, uid, email } = await getUserToken();

    const res = await request(app)
      .post('/suggestions/albums')
      .set('Authorization', `Bearer ${token}`)
      .send({ albumTitle: 'Autenticado Album' });

    expect(res.status).toBe(201);
    expect(res.body.data.suggestedByUid).toBe(uid);
    expect(res.body.data.suggestedByEmail).toBe(email);
  });

  it('POST /suggestions/albums (admin) → 201', async () => {
    const adminToken = await getAdminToken();

    const res = await request(app)
      .post('/suggestions/albums')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ albumTitle: 'Admin Suggested Album', artistName: 'Some Artist' });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.albumTitle).toBe('Admin Suggested Album');
    expect(res.body.data.artistName).toBe('Some Artist');
  });

  it('POST /suggestions/albums with empty body → 400 payload_required', async () => {
    const res = await request(app)
      .post('/suggestions/albums')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('payload_required');
  });

  it('POST /suggestions/albums with invalid spotifyUrl → 400 invalid_spotify_url', async () => {
    const res = await request(app)
      .post('/suggestions/albums')
      .send({ spotifyUrl: 'https://soundcloud.com/track/abc' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_spotify_url');
  });

  it('POST /suggestions/albums with invalid youtubeUrl → 400 invalid_youtube_url', async () => {
    const res = await request(app)
      .post('/suggestions/albums')
      .send({ youtubeUrl: 'https://vimeo.com/12345' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_youtube_url');
  });

  it('GET /suggestions/albums (admin) → 200, new fields present', async () => {
    const adminToken = await getAdminToken();

    await request(app)
      .post('/suggestions/albums')
      .send({ albumTitle: 'Lista Album', spotifyUrl: 'https://open.spotify.com/album/list' });

    const res = await request(app)
      .get('/suggestions/albums')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    const item = (res.body.data as Record<string, unknown>[])[0];
    expect(item).toBeDefined();
    expect(item).toHaveProperty('mbid');
    expect(item).toHaveProperty('albumTitle');
    expect(item).toHaveProperty('spotifyUrl');
  });

  // Rate limit test skipped: anonymousSuggestionLimiter is disabled in emulator mode.
});
