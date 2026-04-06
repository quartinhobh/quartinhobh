import { test, expect, type Page } from '@playwright/test';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@quartinho.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'quartinho-dev-local-2026';
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3001';
const AUTH_EMULATOR = process.env.E2E_AUTH_EMULATOR_HOST ?? 'http://localhost:9099';

async function mintToken(page: Page): Promise<string> {
  const res = await page.request.post(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`,
    { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, returnSecureToken: true } },
  );
  return ((await res.json()) as { idToken: string }).idToken;
}

async function devLogin(page: Page, hash = '') {
  const next = `/admin${hash ? '#' + hash : ''}`;
  const qs = new URLSearchParams({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, next: '/admin' });
  await page.goto(`/__dev-login?${qs}`);
  await page.waitForURL((u) => u.pathname === '/admin', { timeout: 15_000 });
  if (hash) {
    await page.goto(`/admin#${hash}`);
  }
}

test.describe('admin tabs — all functional', () => {

  test('Events tab: create + delete event', async ({ page }) => {
    await devLogin(page, 'events');
    await expect(page.getByRole('heading', { name: /^eventos$/i })).toBeVisible({ timeout: 15_000 });

    // Create
    await page.getByRole('button', { name: /novo evento/i }).click();
    const title = `Tab Test ${Date.now()}`;
    await page.getByLabel('title').fill(title);
    await page.getByLabel('date').fill('2030-01-01');
    await page.getByLabel('startTime').fill('20:00');
    await page.getByLabel('endTime').fill('22:00');
    await page.getByRole('button', { name: /^criar$/ }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });

    // Delete
    const row = page.locator(`[data-testid]`).filter({ hasText: title });
    await row.getByRole('button', { name: /apagar/i }).click();
    await expect(page.getByText(title)).toHaveCount(0, { timeout: 10_000 });
  });

  test('Moderation tab: renders without errors', async ({ page }) => {
    await devLogin(page, 'moderation');
    await page.getByRole('tab', { name: /moderação/i }).click();
    await expect(page.getByText(/banimentos ativos/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/registo de moderação/i)).toBeVisible();
  });

  test('Lojinha tab: add + delete product', async ({ page }) => {
    await devLogin(page, 'lojinha');
    await page.getByRole('tab', { name: /lojinha/i }).click();
    await expect(page.getByText(/adicionar produto/i)).toBeVisible({ timeout: 10_000 });

    // Add product
    const prodName = `Admin Tab Prod ${Date.now()}`;
    await page.getByPlaceholder('emoji').fill('🎸');
    await page.getByPlaceholder('Nome').fill(prodName);
    await page.getByPlaceholder('Descrição').fill('test');
    await page.getByPlaceholder('Preço').fill('10,00');
    await page.getByRole('button', { name: /^adicionar$/ }).click();
    await expect(page.getByText(prodName)).toBeVisible({ timeout: 10_000 });

    // Delete product
    const prodRow = page.locator('li').filter({ hasText: prodName });
    await prodRow.getByRole('button', { name: /apagar/i }).click();
    await expect(page.getByText(prodName)).toHaveCount(0, { timeout: 10_000 });
  });

  test('PIX tab: save config', async ({ page }) => {
    await devLogin(page, 'pix');
    await page.getByRole('tab', { name: /pix/i }).click();
    await expect(page.getByText(/configuração pix/i)).toBeVisible({ timeout: 10_000 });

    await page.getByPlaceholder(/chave pix/i).fill('e2e-tab@pix.test');
    await page.getByPlaceholder(/nome beneficiário/i).fill('E2E Tab');
    await page.getByPlaceholder(/cidade/i).fill('BH');

    // Accept the alert dialog
    page.on('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: /salvar pix/i }).click();

    // Verify: reload and check values persisted
    await page.goto('/admin#pix');
    await page.getByRole('tab', { name: /pix/i }).click();
    await expect(page.getByPlaceholder(/chave pix/i)).toHaveValue('e2e-tab@pix.test', { timeout: 10_000 });
  });

  test('Photos tab: renders event selector', async ({ page }) => {
    await devLogin(page, 'photos');
    await page.getByRole('tab', { name: /fotos/i }).click();
    await expect(page.getByLabel('photos-event-select')).toBeVisible({ timeout: 10_000 });
  });
});
