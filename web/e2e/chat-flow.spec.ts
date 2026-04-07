import { test, expect, type Page, type APIRequestContext, type Route } from '@playwright/test';

/**
 * Chat system E2E tests.
 *
 * Covers:
 *   1. Chat access & authentication
 *   2. Sending messages
 *   3. Message moderation — delete
 *   4. Message moderation — ban
 *   5. Unban — admin only
 *   6. Moderation logs — admin only
 *   7. Role isolation (API-level)
 *
 * Preconditions:
 *   1. `bun run emulators:up`           — Firebase emulator suite
 *   2. `bun run --filter=api dev`       — Express API in emulator mode
 *   3. `bun run seed`                   — creates the admin user
 *   4. Playwright browsers installed    — `bun run --filter=web e2e:install`
 *
 * Workers: 1 (serial).
 */

// ── Constants ───────────────────────────────────────────────────────────────

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@quartinho.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'quartinho-dev-local-2026';
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3001';
const AUTH_EMULATOR = process.env.E2E_AUTH_EMULATOR_HOST ?? 'http://localhost:9099';

const MOCK_MB_ID = 'e2e-chat-album';
const MOCK_RELEASE = {
  id: MOCK_MB_ID,
  title: 'Chat Test Album',
  artistCredit: 'Chat Artists',
  date: '2020-01-01',
  tracks: [
    { id: 'ct1', title: 'Chat Track One', position: 1, length: 180000 },
    { id: 'ct2', title: 'Chat Track Two', position: 2, length: 200000 },
  ],
};

// ── Inline helpers ──────────────────────────────────────────────────────────

async function mockMusicBrainz(page: Page): Promise<void> {
  await page.route(/\/mb\/album\/.*/, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ release: MOCK_RELEASE }),
    }),
  );
  await page.route(/\/mb\/release-groups\/.*\/tracks/, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tracks: MOCK_RELEASE.tracks }),
    }),
  );
  await page.route(/\/lyrics.*/, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ lyrics: null }),
    }),
  );
}

async function mintAdminToken(request: APIRequestContext): Promise<string> {
  const url =
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword` +
    `?key=fake-e2e-key`;
  const res = await request.post(url, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, returnSecureToken: true },
  });
  if (!res.ok()) {
    throw new Error(`admin signIn failed: ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as { idToken: string; localId: string };
  return body.idToken;
}

async function devLoginUi(
  page: Page,
  email: string,
  password: string,
  next: string,
): Promise<void> {
  const qs = new URLSearchParams({ email, password, next });
  await page.goto(`/__dev-login?${qs.toString()}`);
  await page.waitForURL((url) => url.pathname.startsWith(next.split('?')[0]), {
    timeout: 15_000,
  });
}

async function devLoginAdmin(page: Page, next: string): Promise<void> {
  await devLoginUi(page, ADMIN_EMAIL, ADMIN_PASSWORD, next);
}

interface TestUser {
  email: string;
  password: string;
  uid: string;
  idToken: string;
}

async function createTestUser(
  request: APIRequestContext,
  label: string,
): Promise<TestUser> {
  const email = `${label}-${Date.now()}@test.local`;
  const password = 'testpass-e2e-123456';
  const res = await request.post(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-e2e-key`,
    {
      data: { email, password, displayName: label, returnSecureToken: true },
    },
  );
  if (!res.ok()) {
    throw new Error(`createTestUser failed: ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as { localId: string; idToken: string };
  return { email, password, uid: body.localId, idToken: body.idToken };
}

async function linkUser(
  request: APIRequestContext,
  idToken: string,
): Promise<void> {
  await request.post(`${API_URL}/auth/link`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    data: {},
  });
}

async function setUserRole(
  request: APIRequestContext,
  adminToken: string,
  userId: string,
  role: string,
): Promise<void> {
  const res = await request.put(`${API_URL}/users/${userId}/role`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    data: { role },
  });
  if (!res.ok()) {
    throw new Error(`setUserRole failed: ${res.status()} ${await res.text()}`);
  }
}

async function createEventViaApi(
  request: APIRequestContext,
  idToken: string,
  title?: string,
): Promise<{ id: string; title: string }> {
  const payload = {
    mbAlbumId: MOCK_MB_ID,
    title: title ?? `Chat Event ${Date.now()}`,
    date: new Date().toISOString().slice(0, 10),
    startTime: '20:00',
    endTime: '22:00',
    extras: { text: '', links: [], images: [] },
    spotifyPlaylistUrl: null,
  };
  const res = await request.post(`${API_URL}/events`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    data: payload,
  });
  expect(res.status(), 'POST /events').toBe(201);
  const body = (await res.json()) as { event: { id: string; title: string } };
  return body.event;
}

async function refreshToken(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  const url =
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword` +
    `?key=fake-e2e-key`;
  const res = await request.post(url, {
    data: { email, password, returnSecureToken: true },
  });
  const body = (await res.json()) as { idToken: string };
  return body.idToken;
}

// ── Test suites ─────────────────────────────────────────────────────────────

test.describe.serial('chat access & authentication', () => {
  let eventId: string;

  test.beforeAll(async ({ request }) => {
    const adminToken = await mintAdminToken(request);
    const ev = await createEventViaApi(request, adminToken);
    eventId = ev.id;
  });

  test('unauthenticated user sees login prompt, no chat input', async ({ page }) => {
    await mockMusicBrainz(page);
    await page.goto(`/chat/${eventId}`);
    await expect(page.getByText(/Faça login/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByPlaceholder(/escreva uma mensagem/i)).not.toBeVisible();
  });

  test('logged-in user sees chat input', async ({ page }) => {
    await mockMusicBrainz(page);
    await devLoginAdmin(page, `/chat/${eventId}`);
    await expect(page.getByPlaceholder(/escreva uma mensagem/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test('guest does not see send button', async ({ page }) => {
    await mockMusicBrainz(page);
    await page.goto(`/chat/${eventId}`);
    await expect(page.getByText(/Faça login/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /^send$/i })).not.toBeVisible();
  });
});

test.describe.serial('sending messages', () => {
  let eventId: string;

  test.beforeAll(async ({ request }) => {
    const adminToken = await mintAdminToken(request);
    const ev = await createEventViaApi(request, adminToken);
    eventId = ev.id;
  });

  test('user sends a message and it appears in chat', async ({ page }) => {
    await mockMusicBrainz(page);
    await devLoginAdmin(page, `/chat/${eventId}`);

    const msg = `e2e-msg-${Date.now()}`;
    await page.getByPlaceholder(/escreva uma mensagem/i).fill(msg);
    await page.getByRole('button', { name: /^send$/i }).click();

    await expect(page.getByText(msg)).toBeVisible({ timeout: 10_000 });
  });

  test('empty message does not send', async ({ page }) => {
    await mockMusicBrainz(page);
    await devLoginAdmin(page, `/chat/${eventId}`);

    const sendBtn = page.getByRole('button', { name: /^send$/i });
    await expect(sendBtn).toBeDisabled();

    // Type spaces only
    await page.getByPlaceholder(/escreva uma mensagem/i).fill('   ');
    await expect(sendBtn).toBeDisabled();
  });

  test('message appears with correct displayName', async ({ page, request }) => {
    await mockMusicBrainz(page);
    const user = await createTestUser(request, 'NameCheck');
    await linkUser(request, user.idToken);
    const adminToken = await mintAdminToken(request);
    await setUserRole(request, adminToken, user.uid, 'user');

    await devLoginUi(page, user.email, user.password, `/chat/${eventId}`);

    const msg = `name-check-${Date.now()}`;
    await page.getByPlaceholder(/escreva uma mensagem/i).fill(msg);
    await page.getByRole('button', { name: /^send$/i }).click();
    await expect(page.getByText(msg)).toBeVisible({ timeout: 10_000 });

    // The message row should contain the user's displayName
    const msgRow = page.locator('div').filter({ hasText: msg }).first();
    await expect(msgRow.getByText('NameCheck')).toBeVisible();
  });

  test('multiple users see each other messages', async ({ browser, request }) => {
    const adminToken = await mintAdminToken(request);
    const userA = await createTestUser(request, 'UserA');
    const userB = await createTestUser(request, 'UserB');
    await linkUser(request, userA.idToken);
    await linkUser(request, userB.idToken);
    await setUserRole(request, adminToken, userA.uid, 'user');
    await setUserRole(request, adminToken, userB.uid, 'user');

    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    await mockMusicBrainz(page1);
    await mockMusicBrainz(page2);

    await devLoginUi(page1, userA.email, userA.password, `/chat/${eventId}`);
    await devLoginUi(page2, userB.email, userB.password, `/chat/${eventId}`);

    await expect(page1.getByPlaceholder(/escreva uma mensagem/i)).toBeVisible({ timeout: 10_000 });
    await expect(page2.getByPlaceholder(/escreva uma mensagem/i)).toBeVisible({ timeout: 10_000 });

    const msgA = `from-A-${Date.now()}`;
    await page1.getByPlaceholder(/escreva uma mensagem/i).fill(msgA);
    await page1.getByRole('button', { name: /^send$/i }).click();

    // userB should see userA's message
    await expect(page2.getByText(msgA)).toBeVisible({ timeout: 10_000 });

    const msgB = `from-B-${Date.now()}`;
    await page2.getByPlaceholder(/escreva uma mensagem/i).fill(msgB);
    await page2.getByRole('button', { name: /^send$/i }).click();

    // userA should see userB's message
    await expect(page1.getByText(msgB)).toBeVisible({ timeout: 10_000 });

    await ctx1.close();
    await ctx2.close();
  });
});

test.describe.serial('message moderation — delete', () => {
  let eventId: string;
  let regularUser: TestUser;
  let modUser: TestUser;
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    adminToken = await mintAdminToken(request);
    const ev = await createEventViaApi(request, adminToken);
    eventId = ev.id;

    regularUser = await createTestUser(request, 'Regular');
    await linkUser(request, regularUser.idToken);
    await setUserRole(request, adminToken, regularUser.uid, 'user');

    modUser = await createTestUser(request, 'Moderator');
    await linkUser(request, modUser.idToken);
    await setUserRole(request, adminToken, modUser.uid, 'moderator');
  });

  test('regular user does NOT see apagar button', async ({ page }) => {
    await mockMusicBrainz(page);
    // Admin sends a message first
    await devLoginAdmin(page, `/chat/${eventId}`);
    const msg = `del-test-${Date.now()}`;
    await page.getByPlaceholder(/escreva uma mensagem/i).fill(msg);
    await page.getByRole('button', { name: /^send$/i }).click();
    await expect(page.getByText(msg)).toBeVisible({ timeout: 10_000 });

    // Now login as regular user
    await devLoginUi(page, regularUser.email, regularUser.password, `/chat/${eventId}`);
    await expect(page.getByText(msg)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('chat-delete-btn')).not.toBeVisible();
  });

  test('moderator sees apagar on other users messages', async ({ page }) => {
    await mockMusicBrainz(page);
    await devLoginUi(page, modUser.email, modUser.password, `/chat/${eventId}`);

    // Wait for existing messages to load
    await page.waitForTimeout(2_000);
    const deleteButtons = page.getByTestId('chat-delete-btn');
    const count = await deleteButtons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('moderator deletes a message and it disappears', async ({ browser, request }) => {
    // User sends a message, moderator deletes it
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    await mockMusicBrainz(page1);
    await mockMusicBrainz(page2);

    await devLoginUi(page1, regularUser.email, regularUser.password, `/chat/${eventId}`);
    await devLoginUi(page2, modUser.email, modUser.password, `/chat/${eventId}`);

    await expect(page1.getByPlaceholder(/escreva uma mensagem/i)).toBeVisible({ timeout: 10_000 });

    const msg = `to-delete-${Date.now()}`;
    await page1.getByPlaceholder(/escreva uma mensagem/i).fill(msg);
    await page1.getByRole('button', { name: /^send$/i }).click();
    await expect(page1.getByText(msg)).toBeVisible({ timeout: 10_000 });

    // Moderator sees message and deletes it
    await expect(page2.getByText(msg)).toBeVisible({ timeout: 10_000 });
    const msgRow = page2.locator('div').filter({ hasText: msg }).first();
    await msgRow.getByTestId('chat-delete-btn').click();

    // Fill reason and confirm
    await page2.getByTestId('chat-mod-reason').fill('spam');
    await page2.getByTestId('chat-mod-confirm').click();

    // Message disappears from both views (RTDB change event filters it out)
    await expect(page2.getByText(msg)).not.toBeVisible({ timeout: 10_000 });
    await expect(page1.getByText(msg)).not.toBeVisible({ timeout: 10_000 });

    await ctx1.close();
    await ctx2.close();
  });

  test('delete creates a moderation log entry', async ({ request }) => {
    const res = await request.get(`${API_URL}/moderation/logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { logs: Array<{ action: string }> };
    const deleteLog = body.logs.find((l) => l.action === 'delete_message');
    expect(deleteLog).toBeTruthy();
  });

  test('deleted message stays gone after page refresh', async ({ page }) => {
    await mockMusicBrainz(page);

    // Admin sends a message
    await devLoginAdmin(page, `/chat/${eventId}`);
    const msg = `persist-del-${Date.now()}`;
    await page.getByPlaceholder(/escreva uma mensagem/i).fill(msg);
    await page.getByRole('button', { name: /^send$/i }).click();
    await expect(page.getByText(msg)).toBeVisible({ timeout: 10_000 });

    // Admin deletes the message
    const msgRow = page.locator('div').filter({ hasText: msg }).first();
    await msgRow.getByTestId('chat-delete-btn').click();
    await page.getByTestId('chat-mod-confirm').click();

    // Message disappears (optimistic)
    await expect(page.getByText(msg)).not.toBeVisible({ timeout: 10_000 });

    // Refresh — message should still be gone (RTDB has isDeleted=true)
    await page.reload();
    await page.waitForTimeout(3_000);
    await expect(page.getByText(msg)).not.toBeVisible();
  });
});

test.describe.serial('message moderation — ban', () => {
  let eventId: string;
  let regularUser: TestUser;
  let modUser: TestUser;
  let targetUser: TestUser;
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    adminToken = await mintAdminToken(request);
    const ev = await createEventViaApi(request, adminToken);
    eventId = ev.id;

    regularUser = await createTestUser(request, 'BanRegular');
    await linkUser(request, regularUser.idToken);
    await setUserRole(request, adminToken, regularUser.uid, 'user');

    modUser = await createTestUser(request, 'BanMod');
    await linkUser(request, modUser.idToken);
    await setUserRole(request, adminToken, modUser.uid, 'moderator');

    targetUser = await createTestUser(request, 'BanTarget');
    await linkUser(request, targetUser.idToken);
    await setUserRole(request, adminToken, targetUser.uid, 'user');
  });

  test('moderator sees banir button', async ({ page }) => {
    await mockMusicBrainz(page);

    // Target sends a message
    await devLoginUi(page, targetUser.email, targetUser.password, `/chat/${eventId}`);
    const msg = `ban-test-${Date.now()}`;
    await page.getByPlaceholder(/escreva uma mensagem/i).fill(msg);
    await page.getByRole('button', { name: /^send$/i }).click();
    await expect(page.getByText(msg)).toBeVisible({ timeout: 10_000 });

    // Moderator sees banir button
    await devLoginUi(page, modUser.email, modUser.password, `/chat/${eventId}`);
    await expect(page.getByText(msg)).toBeVisible({ timeout: 10_000 });
    const msgRow = page.locator('div').filter({ hasText: msg }).first();
    await expect(msgRow.getByTestId('chat-ban-btn')).toBeVisible();
  });

  test('moderator bans a user and user appears in ban list', async ({ page, request }) => {
    await mockMusicBrainz(page);
    await devLoginUi(page, modUser.email, modUser.password, `/chat/${eventId}`);

    // Find a message from the target user and click ban
    await page.waitForTimeout(2_000);
    const banBtn = page.getByTestId('chat-ban-btn').first();
    await banBtn.click();

    await page.getByTestId('chat-mod-reason').fill('rule violation');
    await page.getByTestId('chat-mod-confirm').click();

    // Wait for API call to complete
    await page.waitForTimeout(2_000);

    // Verify via API that the user is banned
    const modToken = await refreshToken(request, modUser.email, modUser.password);
    const bansRes = await request.get(`${API_URL}/moderation/bans`, {
      headers: { Authorization: `Bearer ${modToken}` },
    });
    expect(bansRes.status()).toBe(200);
    const bansBody = (await bansRes.json()) as { bans: Array<{ userId: string }> };
    const found = bansBody.bans.find((b) => b.userId === targetUser.uid);
    expect(found).toBeTruthy();
  });

  test('regular user does NOT see banir button', async ({ page }) => {
    await mockMusicBrainz(page);
    await devLoginUi(page, regularUser.email, regularUser.password, `/chat/${eventId}`);
    await page.waitForTimeout(2_000);
    await expect(page.getByTestId('chat-ban-btn')).not.toBeVisible();
  });

  test.afterAll(async ({ request }) => {
    // Clean up: unban the target user
    await request.delete(`${API_URL}/moderation/ban/${targetUser.uid}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
  });
});

test.describe.serial('unban — admin only', () => {
  let eventId: string;
  let targetUser: TestUser;
  let modUser: TestUser;
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    adminToken = await mintAdminToken(request);
    const ev = await createEventViaApi(request, adminToken);
    eventId = ev.id;

    modUser = await createTestUser(request, 'UnbanMod');
    await linkUser(request, modUser.idToken);
    await setUserRole(request, adminToken, modUser.uid, 'moderator');

    targetUser = await createTestUser(request, 'UnbanTarget');
    await linkUser(request, targetUser.idToken);
    await setUserRole(request, adminToken, targetUser.uid, 'user');

    // Ban the target user via API
    await request.post(`${API_URL}/moderation/ban`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      data: { userId: targetUser.uid, eventId, reason: 'test ban for unban flow' },
    });
  });

  test('moderator CANNOT unban (API returns 403)', async ({ request }) => {
    const modToken = await refreshToken(request, modUser.email, modUser.password);
    const res = await request.delete(`${API_URL}/moderation/ban/${targetUser.uid}`, {
      headers: { Authorization: `Bearer ${modToken}` },
    });
    expect(res.status()).toBe(403);
  });

  test('admin can unban via API', async ({ request }) => {
    const res = await request.delete(`${API_URL}/moderation/ban/${targetUser.uid}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(200);
  });

  test('after unban, user can send messages again', async ({ page }) => {
    await mockMusicBrainz(page);
    await devLoginUi(page, targetUser.email, targetUser.password, `/chat/${eventId}`);

    const msg = `post-unban-${Date.now()}`;
    await page.getByPlaceholder(/escreva uma mensagem/i).fill(msg);
    await page.getByRole('button', { name: /^send$/i }).click();
    await expect(page.getByText(msg)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe.serial('moderation logs — admin only', () => {
  let modUser: TestUser;
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    adminToken = await mintAdminToken(request);

    modUser = await createTestUser(request, 'LogsMod');
    await linkUser(request, modUser.idToken);
    await setUserRole(request, adminToken, modUser.uid, 'moderator');
  });

  test('admin sees logs via API', async ({ request }) => {
    const res = await request.get(`${API_URL}/moderation/logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { logs: unknown[] };
    expect(Array.isArray(body.logs)).toBe(true);
  });

  test('moderator gets 403 on logs endpoint', async ({ request }) => {
    const modToken = await refreshToken(request, modUser.email, modUser.password);
    const res = await request.get(`${API_URL}/moderation/logs`, {
      headers: { Authorization: `Bearer ${modToken}` },
    });
    expect(res.status()).toBe(403);
  });
});

test.describe.serial('role isolation', () => {
  let eventId: string;
  let regularUser: TestUser;
  let modUser: TestUser;
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    adminToken = await mintAdminToken(request);
    const ev = await createEventViaApi(request, adminToken);
    eventId = ev.id;

    regularUser = await createTestUser(request, 'IsoRegular');
    await linkUser(request, regularUser.idToken);
    await setUserRole(request, adminToken, regularUser.uid, 'user');

    modUser = await createTestUser(request, 'IsoMod');
    await linkUser(request, modUser.idToken);
    await setUserRole(request, adminToken, modUser.uid, 'moderator');
  });

  test('regular user calling ban API gets 403', async ({ request }) => {
    const userToken = await refreshToken(request, regularUser.email, regularUser.password);
    const res = await request.post(`${API_URL}/moderation/ban`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      data: { userId: 'some-uid', eventId, reason: 'test' },
    });
    expect(res.status()).toBe(403);
  });

  test('regular user calling delete API gets 403', async ({ request }) => {
    const userToken = await refreshToken(request, regularUser.email, regularUser.password);
    const res = await request.post(`${API_URL}/moderation/chat/${eventId}/delete`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      data: { messageId: 'some-msg-id', reason: 'test' },
    });
    expect(res.status()).toBe(403);
  });

  test('moderator calling unban API gets 403', async ({ request }) => {
    const modToken = await refreshToken(request, modUser.email, modUser.password);
    const res = await request.delete(`${API_URL}/moderation/ban/some-user-id`, {
      headers: { Authorization: `Bearer ${modToken}` },
    });
    expect(res.status()).toBe(403);
  });

  test('moderator calling logs API gets 403', async ({ request }) => {
    const modToken = await refreshToken(request, modUser.email, modUser.password);
    const res = await request.get(`${API_URL}/moderation/logs`, {
      headers: { Authorization: `Bearer ${modToken}` },
    });
    expect(res.status()).toBe(403);
  });
});
