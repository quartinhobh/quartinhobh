// useModeration — P3-F.
// Thin wrapper around moderation API endpoints. Refetches bans after any
// mutation so ModerationPanel stays in sync.

import { useCallback, useEffect, useState } from 'react';
import {
  banUser as apiBanUser,
  deleteChatMessage as apiDeleteMessage,
  fetchBans,
  fetchModerationLogs,
  unbanUser as apiUnbanUser,
} from '@/services/api';
import type { Ban, ModerationLog } from '@/types';

export interface UseModerationResult {
  bans: Ban[];
  logs: ModerationLog[];
  loading: boolean;
  error: string | null;
  deleteMessage: (
    eventId: string,
    messageId: string,
    reason?: string,
  ) => Promise<void>;
  banUser: (userId: string, eventId?: string, reason?: string) => Promise<void>;
  unbanUser: (userId: string) => Promise<void>;
}

export function useModeration(idToken: string | null): UseModerationResult {
  const [bans, setBans] = useState<Ban[]>([]);
  const [logs, setLogs] = useState<ModerationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    if (!idToken) {
      setBans([]);
      setLogs([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const b = await fetchBans(idToken);
      setBans(b);
      try {
        const l = await fetchModerationLogs(idToken);
        setLogs(l);
      } catch {
        // logs are admin-only; moderator gets 403 — not an error for UI.
        setLogs([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'moderation_fetch_failed');
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const deleteMessage = useCallback(
    async (eventId: string, messageId: string, reason?: string) => {
      if (!idToken) throw new Error('not_authenticated');
      await apiDeleteMessage(eventId, messageId, idToken, reason);
      await refetch();
    },
    [idToken, refetch],
  );

  const banUser = useCallback(
    async (userId: string, eventId?: string, reason?: string) => {
      if (!idToken) throw new Error('not_authenticated');
      await apiBanUser(userId, idToken, eventId, reason);
      await refetch();
    },
    [idToken, refetch],
  );

  const unbanUser = useCallback(
    async (userId: string) => {
      if (!idToken) throw new Error('not_authenticated');
      await apiUnbanUser(userId, idToken);
      await refetch();
    },
    [idToken, refetch],
  );

  return { bans, logs, loading, error, deleteMessage, banUser, unbanUser };
}
