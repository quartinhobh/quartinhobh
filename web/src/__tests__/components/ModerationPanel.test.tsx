import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModerationPanel } from '@/components/admin/ModerationPanel';

type FetchCall = { ok?: boolean; status?: number; body: unknown };

function queueFetch(responses: FetchCall[]): ReturnType<typeof vi.fn> {
  const queue = [...responses];
  const fn = vi.fn(async () => {
    const next = queue.shift();
    if (!next) throw new Error('unexpected extra fetch');
    return {
      ok: next.ok ?? true,
      status: next.status ?? 200,
      json: async () => next.body,
    } as unknown as Response;
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('ModerationPanel', () => {
  it('renders empty state when no bans/logs', async () => {
    queueFetch([
      { body: { bans: [] } },
      { body: { logs: [] } },
    ]);
    render(<ModerationPanel idToken="tok" />);
    await waitFor(() =>
      expect(screen.getByText(/Nenhum banimento ativo/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/Sem entradas/)).toBeInTheDocument();
  });

  it('lists bans and logs', async () => {
    queueFetch([
      {
        body: {
          bans: [
            {
              userId: 'u1',
              bannedBy: 'm',
              reason: 'abuse',
              createdAt: 1,
              expiresAt: null,
            },
          ],
        },
      },
      {
        body: {
          logs: [
            {
              id: 'l1',
              action: 'ban_user',
              targetUserId: 'u1',
              performedBy: 'm',
              eventId: null,
              messageId: null,
              reason: 'abuse',
              createdAt: 1,
            },
          ],
        },
      },
    ]);
    render(<ModerationPanel idToken="tok" />);
    await waitFor(() =>
      expect(screen.getByTestId('ban-row-u1')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('log-row-l1')).toBeInTheDocument();
    expect(screen.getByText('ban_user')).toBeInTheDocument();
  });

  it('unban button triggers DELETE and refetches', async () => {
    const fn = queueFetch([
      {
        body: {
          bans: [
            {
              userId: 'u1',
              bannedBy: 'm',
              reason: null,
              createdAt: 1,
              expiresAt: null,
            },
          ],
        },
      },
      { body: { logs: [] } },
      { body: { ok: true } },
      { body: { bans: [] } },
      { body: { logs: [] } },
    ]);
    render(<ModerationPanel idToken="tok" />);
    await waitFor(() =>
      expect(screen.getByTestId('ban-row-u1')).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('button', { name: /unban/i }));
    await waitFor(() =>
      expect(screen.getByText(/Nenhum banimento ativo/)).toBeInTheDocument(),
    );
    const unbanCall = fn.mock.calls[2]!;
    expect(unbanCall[0]).toContain('/moderation/ban/u1');
    expect((unbanCall[1] as RequestInit).method).toBe('DELETE');
  });
});
