import { useEffect, useRef, useCallback } from 'react';
import { useOfflineQueue } from '@/store/offlineQueue';
import { postVote } from '@/services/api';

/**
 * Sincroniza votos pendentes quando o app volta online.
 * Chamar uma vez no App.tsx ou layout raiz.
 */
export function useOfflineSync(idToken: string | null): void {
  const { pendingVotes } = useOfflineQueue();
  const syncing = useRef(false);
  const idTokenRef = useRef(idToken);
  idTokenRef.current = idToken;

  const flush = useCallback(async () => {
    const token = idTokenRef.current;
    if (!token || syncing.current) return;
    const votes = useOfflineQueue.getState().pendingVotes;
    if (votes.length === 0) return;

    syncing.current = true;
    for (const vote of votes) {
      try {
        await postVote(vote.eventId, token, vote.favoriteTrackId, vote.leastLikedTrackId);
        useOfflineQueue.getState().removeVote(vote.id);
      } catch {
        break;
      }
    }
    syncing.current = false;
  }, []);

  // Flush when coming online (register once, not on every pendingVotes change)
  useEffect(() => {
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [flush]);

  // Flush when idToken becomes available or votes change
  useEffect(() => {
    if (idToken && pendingVotes.length > 0) void flush();
  }, [idToken, pendingVotes.length, flush]);
}
