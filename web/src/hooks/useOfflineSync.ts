import { useEffect, useRef } from 'react';
import { useOfflineQueue } from '@/store/offlineQueue';
import { postVote } from '@/services/api';

/**
 * Sincroniza votos pendentes quando o app volta online.
 * Chamar uma vez no App.tsx ou layout raiz.
 */
export function useOfflineSync(idToken: string | null): void {
  const { pendingVotes, removeVote } = useOfflineQueue();
  const syncing = useRef(false);

  useEffect(() => {
    if (!idToken || pendingVotes.length === 0 || syncing.current) return;

    async function flush() {
      if (syncing.current) return;
      syncing.current = true;

      // Cópia para iterar — evita race condition se estado mudar
      const toSync = [...pendingVotes];

      for (const vote of toSync) {
        try {
          await postVote(vote.eventId, idToken!, vote.favoriteTrackId, vote.leastLikedTrackId);
          removeVote(vote.id);
        } catch {
          // Ainda offline ou erro — para e tenta de novo depois
          break;
        }
      }

      syncing.current = false;
    }

    // Tenta enviar agora (pode já estar online)
    void flush();

    // Escuta quando volta online
    const handler = () => void flush();
    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  }, [idToken, pendingVotes, removeVote]);
}
