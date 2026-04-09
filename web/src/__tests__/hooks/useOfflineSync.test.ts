import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOfflineQueue } from '@/store/offlineQueue';

vi.mock('@/services/api', () => ({
  postVote: vi.fn(),
}));

import { postVote } from '@/services/api';
import { useOfflineSync } from '@/hooks/useOfflineSync';

const mockPostVote = postVote as unknown as ReturnType<typeof vi.fn>;

const pendingVote = {
  id: 'evt-1:123',
  eventId: 'evt-1',
  favoriteTrackId: 'track-a',
  leastLikedTrackId: 'track-b',
  createdAt: Date.now(),
};

describe('useOfflineSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useOfflineQueue.setState({ pendingVotes: [] });
  });

  afterEach(() => {
    useOfflineQueue.setState({ pendingVotes: [] });
  });

  it('does not flush when idToken is null', async () => {
    useOfflineQueue.setState({ pendingVotes: [pendingVote] });
    renderHook(() => useOfflineSync(null));
    // Wait a tick to ensure no async flush runs
    await act(async () => {});
    expect(mockPostVote).not.toHaveBeenCalled();
  });

  it('does not flush when there are no pending votes', async () => {
    mockPostVote.mockResolvedValue({});
    renderHook(() => useOfflineSync('token-123'));
    await act(async () => {});
    expect(mockPostVote).not.toHaveBeenCalled();
  });

  it('flushes pending votes when idToken becomes available', async () => {
    useOfflineQueue.setState({ pendingVotes: [pendingVote] });
    mockPostVote.mockResolvedValue({});

    renderHook(() => useOfflineSync('token-abc'));

    await waitFor(() => {
      expect(mockPostVote).toHaveBeenCalledWith(
        'evt-1',
        'token-abc',
        'track-a',
        'track-b',
      );
    });
  });

  it('removes vote from queue after successful post', async () => {
    useOfflineQueue.setState({ pendingVotes: [pendingVote] });
    mockPostVote.mockResolvedValue({});

    renderHook(() => useOfflineSync('token-abc'));

    await waitFor(() => {
      expect(useOfflineQueue.getState().pendingVotes).toHaveLength(0);
    });
  });

  it('stops flushing on postVote failure and keeps vote in queue', async () => {
    useOfflineQueue.setState({ pendingVotes: [pendingVote] });
    mockPostVote.mockRejectedValue(new Error('network error'));

    renderHook(() => useOfflineSync('token-abc'));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(useOfflineQueue.getState().pendingVotes).toHaveLength(1);
  });

  it('flushes when "online" event fires', async () => {
    useOfflineQueue.setState({ pendingVotes: [pendingVote] });
    mockPostVote.mockResolvedValue({});

    renderHook(() => useOfflineSync('token-xyz'));

    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(mockPostVote).toHaveBeenCalled();
    });
  });
});
