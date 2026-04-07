import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PendingVote {
  id: string;
  eventId: string;
  favoriteTrackId: string;
  leastLikedTrackId: string;
  createdAt: number;
}

interface OfflineQueueState {
  pendingVotes: PendingVote[];
  addVote: (vote: Omit<PendingVote, 'id' | 'createdAt'>) => void;
  removeVote: (id: string) => void;
  clear: () => void;
}

export const useOfflineQueue = create<OfflineQueueState>()(
  persist(
    (set) => ({
      pendingVotes: [],

      addVote: (vote) =>
        set((s) => ({
          pendingVotes: [
            // Substituir voto pendente do mesmo evento (último voto vale)
            ...s.pendingVotes.filter((v) => v.eventId !== vote.eventId),
            { ...vote, id: `${vote.eventId}:${Date.now()}`, createdAt: Date.now() },
          ],
        })),

      removeVote: (id) =>
        set((s) => ({
          pendingVotes: s.pendingVotes.filter((v) => v.id !== id),
        })),

      clear: () => set({ pendingVotes: [] }),
    }),
    {
      name: 'quartinho:offline-votes',
    },
  ),
);
