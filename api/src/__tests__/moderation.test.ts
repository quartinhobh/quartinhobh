// Moderation route tests — P3-F.
// Validation + auth tests run unconditionally.
// Firestore/RTDB-touching tests gated on FIRESTORE_EMULATOR_HOST.

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { adminAuth, adminDb, adminRtdb } from '../config/firebase';
import app from '../index';

const EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'quartinho-emulator';

async function clearFirestore(): Promise<void> {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  await fetch(
    `http://${host}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
}

async function clearAuth(): Promise<void> {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
    method: 'DELETE',
  });
}

async function clearRtdb(): Promise<void> {
  await adminRtdb.ref('/').remove();
}

async function mintIdTokenForUid(uid: string): Promise<string> {
  const customToken = await adminAuth.createCustomToken(uid);
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
  const exchange = await fetch(
    `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const json = (await exchange.json()) as { idToken: string };
  return json.idToken;
}

async function createUser(
  label: string,
  role: 'user' | 'moderator' | 'admin',
): Promise<{ uid: string; token: string }> {
  const user = await adminAuth.createUser({
    email: `${label}-${Date.now()}-${Math.random()}@example.com`,
    password: 'testpass123',
    displayName: label,
  });
  await adminDb.collection('users').doc(user.uid).set({
    id: user.uid,
    email: user.email ?? null,
    displayName: label,
    role,
    linkedSessionId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  const token = await mintIdTokenForUid(user.uid);
  return { uid: user.uid, token };
}

// ── Unconditional auth/validation tests ─────────────────────────────

describe('Moderation — auth gates', () => {
  it('POST /moderation/chat/:eventId/delete 401 without token', async () => {
    const res = await request(app)
      .post('/moderation/chat/evt1/delete')
      .send({ messageId: 'm1' });
    expect(res.status).toBe(401);
  });

  it('POST /moderation/ban 401 without token', async () => {
    const res = await request(app)
      .post('/moderation/ban')
      .send({ userId: 'u1' });
    expect(res.status).toBe(401);
  });

  it('DELETE /moderation/ban/:userId 401 without token', async () => {
    const res = await request(app).delete('/moderation/ban/u1');
    expect(res.status).toBe(401);
  });

  it('GET /moderation/bans 401 without token', async () => {
    const res = await request(app).get('/moderation/bans');
    expect(res.status).toBe(401);
  });

  it('GET /moderation/logs 401 without token', async () => {
    const res = await request(app).get('/moderation/logs');
    expect(res.status).toBe(401);
  });
});

// ── Emulator-gated tests ─────────────────────────────────────────────

describe.skipIf(!EMULATOR)('Moderation API (emulator)', () => {
  beforeAll(async () => {
    await clearFirestore();
    await clearAuth();
    await clearRtdb();
  });

  beforeEach(async () => {
    await clearFirestore();
    await clearAuth();
    await clearRtdb();
  });

  it('POST /moderation/chat/:id/delete — 403 for regular user', async () => {
    const { token } = await createUser('alice', 'user');
    const res = await request(app)
      .post('/moderation/chat/evt1/delete')
      .set('Authorization', `Bearer ${token}`)
      .send({ messageId: 'm1' });
    expect(res.status).toBe(403);
  });

  it('POST /moderation/chat/:id/delete — 400 when messageId missing', async () => {
    const { token } = await createUser('mod', 'moderator');
    const res = await request(app)
      .post('/moderation/chat/evt1/delete')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /moderation/chat/:id/delete — mod soft-deletes + logs', async () => {
    const { uid: modUid, token } = await createUser('mod', 'moderator');
    // seed an RTDB message
    await adminRtdb.ref('chats/evt1/messages/m1').set({
      uid: 'victim',
      displayName: 'victim',
      text: 'bad',
      timestamp: Date.now(),
      isDeleted: false,
    });
    const res = await request(app)
      .post('/moderation/chat/evt1/delete')
      .set('Authorization', `Bearer ${token}`)
      .send({ messageId: 'm1', reason: 'spam' });
    expect(res.status).toBe(200);

    const snap = await adminRtdb.ref('chats/evt1/messages/m1').get();
    expect(snap.val().isDeleted).toBe(true);

    const logs = await adminDb.collection('moderation_logs').get();
    expect(logs.size).toBe(1);
    const log = logs.docs[0]!.data();
    expect(log.action).toBe('delete_message');
    expect(log.performedBy).toBe(modUid);
    expect(log.targetUserId).toBe('victim');
    expect(log.messageId).toBe('m1');
    expect(log.reason).toBe('spam');
  });

  it('POST /moderation/ban — 403 for regular user', async () => {
    const { token } = await createUser('alice', 'user');
    const res = await request(app)
      .post('/moderation/ban')
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: 'u2' });
    expect(res.status).toBe(403);
  });

  it('POST /moderation/ban — moderator creates ban + log', async () => {
    const { uid: modUid, token } = await createUser('mod', 'moderator');
    const res = await request(app)
      .post('/moderation/ban')
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: 'target', reason: 'abuse' });
    expect(res.status).toBe(200);
    expect(res.body.ban.userId).toBe('target');
    expect(res.body.ban.bannedBy).toBe(modUid);
    expect(res.body.ban.reason).toBe('abuse');

    const banDoc = await adminDb.collection('bans').doc('target').get();
    expect(banDoc.exists).toBe(true);

    const logs = await adminDb.collection('moderation_logs').get();
    expect(logs.size).toBe(1);
    expect(logs.docs[0]!.data().action).toBe('ban_user');
  });

  it('POST /moderation/ban — 400 without userId', async () => {
    const { token } = await createUser('mod', 'moderator');
    const res = await request(app)
      .post('/moderation/ban')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('DELETE /moderation/ban/:userId — 403 for moderator', async () => {
    const { token } = await createUser('mod', 'moderator');
    await adminDb.collection('bans').doc('target').set({
      userId: 'target',
      bannedBy: 'someone',
      reason: null,
      createdAt: Date.now(),
      expiresAt: null,
    });
    const res = await request(app)
      .delete('/moderation/ban/target')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('DELETE /moderation/ban/:userId — admin removes + logs', async () => {
    const { token } = await createUser('admin', 'admin');
    await adminDb.collection('bans').doc('target').set({
      userId: 'target',
      bannedBy: 'someone',
      reason: null,
      createdAt: Date.now(),
      expiresAt: null,
    });
    const res = await request(app)
      .delete('/moderation/ban/target')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const banDoc = await adminDb.collection('bans').doc('target').get();
    expect(banDoc.exists).toBe(false);

    const logs = await adminDb.collection('moderation_logs').get();
    expect(logs.size).toBe(1);
    expect(logs.docs[0]!.data().action).toBe('unban_user');
  });

  it('GET /moderation/bans — mod lists active bans', async () => {
    const { token } = await createUser('mod', 'moderator');
    await adminDb.collection('bans').doc('u1').set({
      userId: 'u1',
      bannedBy: 'x',
      reason: null,
      createdAt: Date.now(),
      expiresAt: null,
    });
    const res = await request(app)
      .get('/moderation/bans')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.bans).toHaveLength(1);
    expect(res.body.bans[0].userId).toBe('u1');
  });

  it('GET /moderation/logs — 403 for moderator, 200 for admin', async () => {
    const { token: modTok } = await createUser('mod', 'moderator');
    const modRes = await request(app)
      .get('/moderation/logs')
      .set('Authorization', `Bearer ${modTok}`);
    expect(modRes.status).toBe(403);

    const { token: admTok } = await createUser('adm', 'admin');
    const admRes = await request(app)
      .get('/moderation/logs')
      .set('Authorization', `Bearer ${admTok}`);
    expect(admRes.status).toBe(200);
    expect(Array.isArray(admRes.body.logs)).toBe(true);
  });
});
