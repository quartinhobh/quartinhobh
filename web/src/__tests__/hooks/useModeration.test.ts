import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useModeration } from '@/hooks/useModeration';

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

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('useModeration', () => {
  it('returns empty lists when idToken is null', async () => {
    const { result } = renderHook(() => useModeration(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.bans).toEqual([]);
    expect(result.current.logs).toEqual([]);
  });

  it('fetches bans + logs on mount', async () => {
    queueFetch([
      { body: { bans: [{ userId: 'u1', bannedBy: 'm', reason: null, createdAt: 1, expiresAt: null }] } },
      { body: { logs: [{ id: 'l1', action: 'ban_user', targetUserId: 'u1', performedBy: 'm', eventId: null, messageId: null, reason: null, createdAt: 1 }] } },
    ]);
    const { result } = renderHook(() => useModeration('tok'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.bans).toHaveLength(1);
    expect(result.current.logs).toHaveLength(1);
  });

  it('swallows 403 on logs (moderator sees bans only)', async () => {
    queueFetch([
      { body: { bans: [] } },
      { ok: false, status: 403, body: { error: 'forbidden' } },
    ]);
    const { result } = renderHook(() => useModeration('tok'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.logs).toEqual([]);
  });

  it('deleteMessage calls endpoint and refetches', async () => {
    const fn = queueFetch([
      { body: { bans: [] } },
      { body: { logs: [] } },
      { body: { ok: true } }, // delete
      { body: { bans: [] } }, // refetch
      { body: { logs: [] } },
    ]);
    const { result } = renderHook(() => useModeration('tok'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.deleteMessage('evt1', 'm1', 'spam');
    });
    const deleteCall = fn.mock.calls[2]![0] as string;
    expect(deleteCall).toContain('/moderation/chat/evt1/delete');
    expect(fn).toHaveBeenCalledTimes(5);
  });

  it('banUser calls endpoint and refetches', async () => {
    const fn = queueFetch([
      { body: { bans: [] } },
      { body: { logs: [] } },
      { body: { ban: { userId: 'x', bannedBy: 'm', reason: null, createdAt: 1, expiresAt: null } } },
      { body: { bans: [{ userId: 'x', bannedBy: 'm', reason: null, createdAt: 1, expiresAt: null }] } },
      { body: { logs: [] } },
    ]);
    const { result } = renderHook(() => useModeration('tok'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.banUser('x');
    });
    expect(result.current.bans).toHaveLength(1);
    expect(fn).toHaveBeenCalledTimes(5);
  });

  it('unbanUser calls endpoint and refetches', async () => {
    const fn = queueFetch([
      { body: { bans: [{ userId: 'x', bannedBy: 'm', reason: null, createdAt: 1, expiresAt: null }] } },
      { body: { logs: [] } },
      { body: { ok: true } },
      { body: { bans: [] } },
      { body: { logs: [] } },
    ]);
    const { result } = renderHook(() => useModeration('tok'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.unbanUser('x');
    });
    expect(result.current.bans).toEqual([]);
    const unbanCall = fn.mock.calls[2]!;
    expect(unbanCall[0]).toContain('/moderation/ban/x');
    expect((unbanCall[1] as RequestInit).method).toBe('DELETE');
  });
});
