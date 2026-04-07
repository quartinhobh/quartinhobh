import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * Profile feature E2E tests.
 *
 * Covers:
 *   1. Username (set, persist, reflect on public profile)
 *   2. Public profile page (/u/:username)
 *   3. Favorite albums (search, add, remove, max 4)
 *   4. Password change (validation + happy path)
 *   5. Avatar upload (client-side validation + success)
 *   6. Profile save resilience (avatar failure does not block bio/links save)
 *
 * Preconditions:
 *   1. `bun run emulators:up`           — Firebase emulator suite
 *   2. `bun run --filter=api dev`       — Express API in emulator mode
 *   3. `bun run seed`                   — creates the admin user in .env.seed
 *   4. Playwright browsers installed    — `bun run --filter=web e2e:install`
 *
 * MusicBrainz search (album picker) is mocked via page.route() — all other
 * network traffic goes through the real API + Firebase emulator.
 *
 * Workers: 1 (serial). Tests that mutate global state (username, favorites)
 * clean up via API after themselves so later tests start from a known state.
 */

// ── Constants ────────────────────────────────────────────────────────────────

const ADMIN_EMAIL    = process.env.SEED_ADMIN_EMAIL    ?? 'admin@quartinho.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'quartinho-dev-local-2026';
const API_URL        = process.env.E2E_API_URL          ?? 'http://localhost:3001';
const AUTH_EMULATOR_HOST =
  process.env.E2E_AUTH_EMULATOR_HOST ?? 'http://localhost:9099';

// ── Inline helpers ───────────────────────────────────────────────────────────

async function devLoginUi(page: Page, next: string): Promise<void> {
  const qs = new URLSearchParams({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, next });
  await page.goto(`/__dev-login?${qs.toString()}`);
  await page.waitForURL((url) => url.pathname === next, { timeout: 15_000 });
}

/**
 * Mints a raw idToken from the Firebase Auth emulator REST API.
 * Uses page.request for in-test usage.
 */
async function mintIdTokenViaRest(page: Page): Promise<string> {
  const url =
    `${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword` +
    `?key=fake-e2e-key`;
  const res = await page.request.post(url, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, returnSecureToken: true },
  });
  if (!res.ok()) throw new Error(`auth emulator failed: ${res.status()} ${await res.text()}`);
  const body = (await res.json()) as { idToken: string };
  return body.idToken;
}

/**
 * Mints a raw idToken using a specific password (for password change tests).
 */
async function mintIdTokenWithPassword(page: Page, password: string): Promise<string> {
  const url =
    `${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword` +
    `?key=fake-e2e-key`;
  const res = await page.request.post(url, {
    data: { email: ADMIN_EMAIL, password, returnSecureToken: true },
  });
  if (!res.ok()) throw new Error(`auth emulator failed: ${res.status()} ${await res.text()}`);
  const body = (await res.json()) as { idToken: string };
  return body.idToken;
}

async function resetProfileViaApi(page: Page, idToken: string): Promise<void> {
  await page.request.put(`${API_URL}/users/me/profile`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    data: { displayName: 'Admin', username: null, bio: '', socialLinks: [], favoriteAlbums: [] },
  });
}

function buildMbSearchMock(albums: Array<{ id: string; title: string; artistCredit: string; coverUrl?: string }>) {
  return albums.map((a) => ({
    id: a.id,
    title: a.title,
    artistCredit: a.artistCredit,
    coverUrl: a.coverUrl ?? null,
  }));
}

async function mockAlbumSearch(
  page: Page,
  mockAlbums: Array<{ id: string; title: string; artistCredit: string; coverUrl?: string }>,
): Promise<void> {
  await page.route(/\/mb\/search/, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: buildMbSearchMock(mockAlbums) }),
    }),
  );
}

// ── Test data ────────────────────────────────────────────────────────────────

const MOCK_ALBUMS = [
  { id: 'e2e-album-1', title: 'Album One',   artistCredit: 'Artist A' },
  { id: 'e2e-album-2', title: 'Album Two',   artistCredit: 'Artist B' },
  { id: 'e2e-album-3', title: 'Album Three', artistCredit: 'Artist C' },
  { id: 'e2e-album-4', title: 'Album Four',  artistCredit: 'Artist D' },
  { id: 'e2e-album-5', title: 'Album Five',  artistCredit: 'Artist E' },
];

const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAgAAUivebwAAAAASUVORK5CYII=';

// ── 1. Username ───────────────────────────────────────────────────────────────

test.describe('username', () => {
  test.afterEach(async ({ page }) => {
    const idToken = await mintIdTokenViaRest(page);
    await resetProfileViaApi(page, idToken);
  });

  test('username input is pre-populated with current value after page load', async ({ page }) => {
    // Setup: set a known username via API
    const idToken = await mintIdTokenViaRest(page);
    await page.request.put(`${API_URL}/users/me/profile`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      data: { username: 'e2etestuser' },
    });

    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });

    const usernameInput = page.getByPlaceholder('seu-username');
    await expect(usernameInput).toHaveValue('e2etestuser', { timeout: 10_000 });

    const profileLink = page.getByRole('link', { name: 'Ver meu perfil' });
    await expect(profileLink).toBeVisible();
    await expect(profileLink).toHaveAttribute('href', '/u/e2etestuser');
  });

  test('user can set a new username and save it successfully', async ({ page }) => {
    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });

    const usernameInput = page.getByPlaceholder('seu-username');
    await usernameInput.fill('novohandle');
    await page.getByRole('button', { name: 'Salvar' }).click();

    await expect(page.getByRole('alert')).toContainText('Perfil salvo!', { timeout: 10_000 });

    await page.reload();
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });
    await expect(usernameInput).toHaveValue('novohandle', { timeout: 10_000 });
  });

  test('username field strips invalid characters on input', async ({ page }) => {
    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });

    const usernameInput = page.getByPlaceholder('seu-username');
    await usernameInput.fill('');
    await usernameInput.pressSequentially('Hello World!');

    await expect(usernameInput).toHaveValue('helloworld');
  });

  test('duplicate username shows inline error', async ({ page }) => {
    await page.route(/\/users\/me\/profile/, (route: Route) => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'username_taken', code: 'username_taken' }),
        });
      }
      return route.continue();
    });

    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });

    const usernameInput = page.getByPlaceholder('seu-username');
    await usernameInput.fill('taken');
    await page.getByRole('button', { name: 'Salvar' }).click();

    await expect(page.getByText('Esse username já está em uso.')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Salvar' })).toBeEnabled();
  });

  test('invalid format username shows inline error', async ({ page }) => {
    await page.route(/\/users\/me\/profile/, (route: Route) => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'username_invalid', code: 'username_invalid' }),
        });
      }
      return route.continue();
    });

    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });

    const usernameInput = page.getByPlaceholder('seu-username');
    await usernameInput.fill('ab');
    await page.getByRole('button', { name: 'Salvar' }).click();

    await expect(page.getByText('3-20 caracteres: letras minúsculas, números, _ ou -')).toBeVisible({ timeout: 10_000 });
  });

  test('empty username clears the field and saves null', async ({ page }) => {
    // Setup: set username first
    const idToken = await mintIdTokenViaRest(page);
    await page.request.put(`${API_URL}/users/me/profile`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      data: { username: 'e2etestuser' },
    });

    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });

    const usernameInput = page.getByPlaceholder('seu-username');
    await usernameInput.fill('');
    await page.getByRole('button', { name: 'Salvar' }).click();

    await expect(page.getByRole('alert')).toContainText('Perfil salvo!', { timeout: 10_000 });
    await expect(page.getByRole('link', { name: 'Ver meu perfil' })).toBeHidden();
  });
});

// ── 2. Public Profile ─────────────────────────────────────────────────────────

test.describe('public profile (/u/:username)', () => {
  test.beforeEach(async ({ page }) => {
    const idToken = await mintIdTokenViaRest(page);
    await page.request.put(`${API_URL}/users/me/profile`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      data: {
        username: 'e2epublic',
        bio: 'Bio de teste E2E',
        socialLinks: [{ platform: 'instagram', url: 'https://instagram.com/e2etest' }],
        favoriteAlbums: [{ mbId: 'e2e-album-1', title: 'Album One', artistCredit: 'Artist A', coverUrl: null }],
      },
    });
  });

  test.afterEach(async ({ page }) => {
    const idToken = await mintIdTokenViaRest(page);
    await resetProfileViaApi(page, idToken);
  });

  test('renders displayName and @username on /u/:username', async ({ page }) => {
    await page.goto('/u/e2epublic');
    await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('@e2epublic')).toBeVisible();
  });

  test('renders bio on public profile', async ({ page }) => {
    await page.goto('/u/e2epublic');
    await expect(page.getByText('Bio de teste E2E')).toBeVisible({ timeout: 10_000 });
  });

  test('renders social links on public profile', async ({ page }) => {
    await page.goto('/u/e2epublic');
    const link = page.getByRole('link', { name: 'Instagram' });
    await expect(link).toBeVisible({ timeout: 10_000 });
    await expect(link).toHaveAttribute('href', 'https://instagram.com/e2etest');
  });

  test('renders favorite albums section on public profile', async ({ page }) => {
    await page.goto('/u/e2epublic');
    await expect(page.getByText('Álbuns Favoritos')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Album One')).toBeVisible();
    await expect(page.getByText('Artist A')).toBeVisible();
  });

  test('shows "Usuário não encontrado" for unknown username', async ({ page }) => {
    await page.goto('/u/this-user-does-not-exist-e2e');
    await expect(page.getByText('Usuário não encontrado')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: 'Voltar ao início' })).toBeVisible();
  });

  test('empty profile (no bio, no links, no albums) renders without errors', async ({ page }) => {
    await page.route(/\/users\/username\/emptye2euser/, (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'fake-id',
          displayName: 'Empty User',
          username: 'emptye2euser',
          avatarUrl: null,
          bio: null,
          socialLinks: [],
          favoriteAlbums: [],
          role: 'user',
        }),
      }),
    );

    await page.goto('/u/emptye2euser');
    await expect(page.getByRole('heading', { name: 'Empty User' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Álbuns Favoritos')).toBeHidden();
    await expect(page.getByRole('link', { name: 'Instagram' })).toBeHidden();
  });

  test('"Ver meu perfil" link on /profile navigates to public profile', async ({ page }) => {
    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });

    const profileLink = page.getByRole('link', { name: 'Ver meu perfil' });
    await expect(profileLink).toBeVisible({ timeout: 10_000 });
    await profileLink.click();

    await page.waitForURL(/\/u\/e2epublic/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible({ timeout: 10_000 });
  });
});

// ── 3. Favorite Albums ────────────────────────────────────────────────────────

test.describe('favorite albums', () => {
  test.afterEach(async ({ page }) => {
    const idToken = await mintIdTokenViaRest(page);
    await page.request.put(`${API_URL}/users/me/profile`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      data: { favoriteAlbums: [] },
    });
  });

  test('empty slots show "+" add buttons (4 slots total)', async ({ page }) => {
    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });

    const addButtons = page.locator('fieldset').filter({ hasText: 'Álbuns Favoritos' }).locator('button:has(span:text("+"))');
    await expect(addButtons).toHaveCount(4);
  });

  test('clicking "+" opens the search picker for that slot', async ({ page }) => {
    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });

    const addButtons = page.locator('fieldset').filter({ hasText: 'Álbuns Favoritos' }).locator('button:has(span:text("+"))');
    await addButtons.first().click();

    await expect(page.getByPlaceholder('Buscar álbum ou artista...')).toBeVisible();
    await expect(page.getByText('Cancelar').last()).toBeVisible();
  });

  test('album search shows results from mocked MusicBrainz', async ({ page }) => {
    await mockAlbumSearch(page, MOCK_ALBUMS);
    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });

    const addButtons = page.locator('fieldset').filter({ hasText: 'Álbuns Favoritos' }).locator('button:has(span:text("+"))');
    await addButtons.first().click();

    const searchInput = page.getByPlaceholder('Buscar álbum ou artista...');
    await searchInput.fill('test query');

    await expect(page.getByText('Album One')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Artist A')).toBeVisible();
  });

  test('selecting an album from results fills the slot', async ({ page }) => {
    await mockAlbumSearch(page, MOCK_ALBUMS);
    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });

    const addButtons = page.locator('fieldset').filter({ hasText: 'Álbuns Favoritos' }).locator('button:has(span:text("+"))');
    await addButtons.first().click();

    await page.getByPlaceholder('Buscar álbum ou artista...').fill('test');
    await expect(page.getByText('Album One')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Album One').click();

    // Picker dismissed
    await expect(page.getByPlaceholder('Buscar álbum ou artista...')).toBeHidden();
    // Slot shows album
    await expect(page.locator('img[alt="Album One"]')).toBeVisible();
    // Remove button present
    await expect(page.locator('button[title="Remover"]').first()).toBeVisible();
  });

  test('selecting an album and saving persists it to the API', async ({ page }) => {
    await mockAlbumSearch(page, MOCK_ALBUMS);
    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });

    const addButtons = page.locator('fieldset').filter({ hasText: 'Álbuns Favoritos' }).locator('button:has(span:text("+"))');
    await addButtons.first().click();
    await page.getByPlaceholder('Buscar álbum ou artista...').fill('test');
    await expect(page.getByText('Album One')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Album One').click();

    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('alert')).toContainText('Perfil salvo!', { timeout: 10_000 });

    await page.reload();
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });
    await expect(page.locator('img[alt="Album One"]')).toBeVisible({ timeout: 10_000 });
  });

  test('removing an album hides it from the slot', async ({ page }) => {
    // Seed one album
    const idToken = await mintIdTokenViaRest(page);
    await page.request.put(`${API_URL}/users/me/profile`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      data: { favoriteAlbums: [{ mbId: 'e2e-album-1', title: 'Album One', artistCredit: 'Artist A', coverUrl: null }] },
    });

    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });
    await expect(page.locator('img[alt="Album One"]')).toBeVisible({ timeout: 10_000 });

    await page.locator('button[title="Remover"]').first().click();

    // Slot reverts to "+"
    const addButtons = page.locator('fieldset').filter({ hasText: 'Álbuns Favoritos' }).locator('button:has(span:text("+"))');
    await expect(addButtons).toHaveCount(4);
  });

  test('cannot add more than 4 albums (fifth "+" slot is absent)', async ({ page }) => {
    // Seed 4 albums
    const idToken = await mintIdTokenViaRest(page);
    await page.request.put(`${API_URL}/users/me/profile`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      data: {
        favoriteAlbums: [
          { mbId: 'e2e-album-1', title: 'Album One', artistCredit: 'Artist A', coverUrl: null },
          { mbId: 'e2e-album-2', title: 'Album Two', artistCredit: 'Artist B', coverUrl: null },
          { mbId: 'e2e-album-3', title: 'Album Three', artistCredit: 'Artist C', coverUrl: null },
          { mbId: 'e2e-album-4', title: 'Album Four', artistCredit: 'Artist D', coverUrl: null },
        ],
      },
    });

    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });

    const addButtons = page.locator('fieldset').filter({ hasText: 'Álbuns Favoritos' }).locator('button:has(span:text("+"))');
    await expect(addButtons).toHaveCount(0);
  });

  test('already-added album does not appear in search results (de-duplicated)', async ({ page }) => {
    // Seed album with id 'e2e-album-1'
    const idToken = await mintIdTokenViaRest(page);
    await page.request.put(`${API_URL}/users/me/profile`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      data: { favoriteAlbums: [{ mbId: 'e2e-album-1', title: 'Album One', artistCredit: 'Artist A', coverUrl: null }] },
    });

    await mockAlbumSearch(page, MOCK_ALBUMS);
    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });

    // Click a second empty slot
    const addButtons = page.locator('fieldset').filter({ hasText: 'Álbuns Favoritos' }).locator('button:has(span:text("+"))');
    await addButtons.first().click();
    await page.getByPlaceholder('Buscar álbum ou artista...').fill('test');

    // Wait for results to appear
    await expect(page.getByText('Album Two')).toBeVisible({ timeout: 10_000 });
    // Album One should NOT be in the picker results list (it's already added)
    const pickerResults = page.locator('ul li');
    await expect(pickerResults.filter({ hasText: 'Album One' })).toHaveCount(0);
  });

  test('cancelling the picker closes it without selecting anything', async ({ page }) => {
    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });

    const addButtons = page.locator('fieldset').filter({ hasText: 'Álbuns Favoritos' }).locator('button:has(span:text("+"))');
    await addButtons.first().click();
    await expect(page.getByPlaceholder('Buscar álbum ou artista...')).toBeVisible();

    // Click Cancelar inside the album picker (last one on page to avoid password section)
    await page.locator('fieldset').filter({ hasText: 'Álbuns Favoritos' }).getByText('Cancelar').click();

    await expect(page.getByPlaceholder('Buscar álbum ou artista...')).toBeHidden();
    // All 4 slots still show "+"
    await expect(addButtons).toHaveCount(4);
  });

  test('albums appear on public profile after saving', async ({ page }) => {
    // Ensure admin has username
    const idToken = await mintIdTokenViaRest(page);
    await page.request.put(`${API_URL}/users/me/profile`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      data: { username: 'e2epublic' },
    });

    await mockAlbumSearch(page, MOCK_ALBUMS);
    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });

    const addButtons = page.locator('fieldset').filter({ hasText: 'Álbuns Favoritos' }).locator('button:has(span:text("+"))');
    await addButtons.first().click();
    await page.getByPlaceholder('Buscar álbum ou artista...').fill('test');
    await expect(page.getByText('Album One')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Album One').click();

    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('alert')).toContainText('Perfil salvo!', { timeout: 10_000 });

    await page.goto('/u/e2epublic');
    await expect(page.getByText('Álbuns Favoritos')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Album One')).toBeVisible();
  });
});

// ── 4. Password change ────────────────────────────────────────────────────────

test.describe('password change', () => {
  test('password section is visible for email users', async ({ page }) => {
    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });

    await expect(page.getByText('Senha')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Trocar senha' })).toBeVisible();
    await expect(page.getByPlaceholder('Mínimo 6 caracteres')).toBeHidden();
  });

  test('"Trocar senha" reveals the password form fields', async ({ page }) => {
    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Trocar senha' }).click();

    await expect(page.getByPlaceholder('Mínimo 6 caracteres')).toBeVisible();
    await expect(page.getByPlaceholder('Repita a senha')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Salvar senha' })).toBeVisible();
    // Cancelar in password section
    await expect(page.locator('button').filter({ hasText: 'Cancelar' }).last()).toBeVisible();
  });

  test('shows error when password is too short (< 6 chars)', async ({ page }) => {
    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Trocar senha' }).click();
    await page.getByPlaceholder('Mínimo 6 caracteres').fill('abc');
    await page.getByPlaceholder('Repita a senha').fill('abc');
    await page.getByRole('button', { name: 'Salvar senha' }).click();

    await expect(page.getByRole('alert').filter({ hasText: 'A senha precisa ter pelo menos 6 caracteres.' })).toBeVisible({ timeout: 10_000 });
  });

  test('shows error when passwords do not match', async ({ page }) => {
    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Trocar senha' }).click();
    await page.getByPlaceholder('Mínimo 6 caracteres').fill('senha123');
    await page.getByPlaceholder('Repita a senha').fill('senha456');
    await page.getByRole('button', { name: 'Salvar senha' }).click();

    await expect(page.getByRole('alert').filter({ hasText: 'As senhas não coincidem.' })).toBeVisible({ timeout: 10_000 });
  });

  test('successful password change shows success message and hides form', async ({ page }) => {
    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Trocar senha' }).click();
    await page.getByPlaceholder('Mínimo 6 caracteres').fill('novasenha123');
    await page.getByPlaceholder('Repita a senha').fill('novasenha123');
    await page.getByRole('button', { name: 'Salvar senha' }).click();

    await expect(page.getByRole('alert').filter({ hasText: 'Senha alterada!' })).toBeVisible({ timeout: 10_000 });
    // Form hidden
    await expect(page.getByPlaceholder('Mínimo 6 caracteres')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Trocar senha' })).toBeVisible();

    // Restore original password via Auth emulator REST API
    // Sign in with new password to get idToken
    const idToken = await mintIdTokenWithPassword(page, 'novasenha123');
    // Use the emulator update endpoint to reset password
    const updateUrl =
      `${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:update` +
      `?key=fake-e2e-key`;
    await page.request.post(updateUrl, {
      data: { idToken, password: ADMIN_PASSWORD, returnSecureToken: true },
    });
  });

  test('"Cancelar" hides the form without changing anything', async ({ page }) => {
    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Trocar senha' }).click();
    await page.getByPlaceholder('Mínimo 6 caracteres').fill('something');
    await page.getByPlaceholder('Repita a senha').fill('something');

    // Click the Cancelar in the password section
    await page.locator('button').filter({ hasText: 'Cancelar' }).last().click();

    await expect(page.getByPlaceholder('Mínimo 6 caracteres')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Trocar senha' })).toBeVisible();
    // No alert visible
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});

// ── 5. Avatar upload ──────────────────────────────────────────────────────────

test.describe('avatar upload', () => {
  test('selecting a valid image shows a preview before saving', async ({ page }) => {
    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });

    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(TINY_PNG_B64, 'base64'),
    });

    // Avatar img should have a blob: URL
    const avatarImg = page.locator('img').first();
    await expect(avatarImg).toHaveAttribute('src', /^blob:/, { timeout: 5_000 });
  });

  test('client-side rejects a file with invalid MIME type', async ({ page }) => {
    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });

    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles({
      name: 'test.gif',
      mimeType: 'image/gif',
      buffer: Buffer.from(TINY_PNG_B64, 'base64'),
    });

    await page.getByRole('button', { name: 'Salvar' }).click();

    await expect(page.getByRole('alert')).toContainText('Foto: formato inválido. Use JPG, PNG ou WebP.', { timeout: 10_000 });
  });

  test('client-side rejects a file larger than 2 MB', async ({ page }) => {
    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });

    // Create a ~2.1 MB buffer
    const bigBuffer = Buffer.alloc(2.1 * 1024 * 1024, 0);

    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles({
      name: 'big.png',
      mimeType: 'image/png',
      buffer: bigBuffer,
    });

    await page.getByRole('button', { name: 'Salvar' }).click();

    await expect(page.getByRole('alert')).toContainText('Foto: arquivo muito grande', { timeout: 10_000 });
    await expect(page.getByRole('alert')).toContainText('Máximo 2 MB', { timeout: 10_000 });
  });

  test('successful avatar upload updates the preview and shows "Perfil salvo!"', async ({ page }) => {
    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });

    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(TINY_PNG_B64, 'base64'),
    });

    await page.getByRole('button', { name: 'Salvar' }).click();

    await expect(page.getByRole('alert')).toContainText('Perfil salvo!', { timeout: 10_000 });
  });
});

// ── 6. Profile save resilience ────────────────────────────────────────────────

test.describe('profile save resilience', () => {
  test.afterEach(async ({ page }) => {
    const idToken = await mintIdTokenViaRest(page);
    await resetProfileViaApi(page, idToken);
  });

  test('avatar upload failure does not block profile data save', async ({ page }) => {
    // Intercept avatar upload to fail
    await page.route(/\/users\/me\/avatar/, (route: Route) => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'server_error' }),
        });
      }
      return route.continue();
    });

    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });

    // Set avatar file
    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(TINY_PNG_B64, 'base64'),
    });

    // Fill bio
    const bioTextarea = page.locator('textarea');
    await bioTextarea.fill('Bio que deve ser salva');

    await page.getByRole('button', { name: 'Salvar' }).click();

    const alert = page.getByRole('alert').first();
    await expect(alert).toContainText('Foto: falha no envio. Tente novamente.', { timeout: 10_000 });
    await expect(alert).toContainText('O restante do perfil foi salvo.');

    // Verify bio was saved via API
    const idToken = await mintIdTokenViaRest(page);
    const res = await page.request.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const me = (await res.json()) as { bio: string };
    expect(me.bio).toBe('Bio que deve ser salva');
  });

  test('profile data save failure shows error while avatar may still succeed', async ({ page }) => {
    // Intercept profile PUT to fail
    await page.route(/\/users\/me\/profile/, (route: Route) => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'server_error' }),
        });
      }
      return route.continue();
    });

    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Salvar' }).click();

    await expect(page.getByRole('alert')).toContainText('Perfil: falha ao salvar. Tente novamente.', { timeout: 10_000 });
    // Should NOT contain the avatar-only-failure message
    await expect(page.getByRole('alert')).not.toContainText('O restante do perfil foi salvo.');
  });

  test('both avatar and profile failures show combined error', async ({ page }) => {
    // Intercept both
    await page.route(/\/users\/me\/avatar/, (route: Route) => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'server_error' }),
        });
      }
      return route.continue();
    });
    await page.route(/\/users\/me\/profile/, (route: Route) => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'server_error' }),
        });
      }
      return route.continue();
    });

    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });

    // Set avatar
    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(TINY_PNG_B64, 'base64'),
    });

    await page.getByRole('button', { name: 'Salvar' }).click();

    const alert = page.getByRole('alert').first();
    await expect(alert).toContainText('Foto: falha no envio', { timeout: 10_000 });
    await expect(alert).toContainText('Perfil: falha ao salvar');
  });

  test('no avatar file selected — "Salvar" saves profile data only', async ({ page }) => {
    await devLoginUi(page, '/profile');
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 10_000 });

    const bioTextarea = page.locator('textarea');
    await bioTextarea.fill('Apenas bio');

    await page.getByRole('button', { name: 'Salvar' }).click();

    await expect(page.getByRole('alert')).toContainText('Perfil salvo!', { timeout: 10_000 });

    // Verify via API
    const idToken = await mintIdTokenViaRest(page);
    const res = await page.request.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const me = (await res.json()) as { bio: string };
    expect(me.bio).toBe('Apenas bio');
  });
});
