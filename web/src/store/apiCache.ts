import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface ApiCacheState {
  cache: Record<string, CacheEntry<unknown>>;
  get: <T>(key: string, ttl?: number) => T | null;
  set: <T>(key: string, data: T) => void;
  invalidate: (key: string) => void;
  invalidatePrefix: (prefix: string) => void;
}

// TTL padrão: 3 horas — cobre a duração de um evento.
// Dados que mudam frequentemente (votos, moderação) passam TTL próprio.
const DEFAULT_TTL = 3 * 60 * 60 * 1000; // 3 hours
const MAX_ENTRIES = 100;

export const useApiCache = create<ApiCacheState>()(
  persist(
    (set, get) => ({
      cache: {},

      get: <T>(key: string, ttl: number = DEFAULT_TTL): T | null => {
        const entry = get().cache[key];
        if (!entry) return null;
        if (Date.now() - entry.timestamp > ttl) {
          set((s) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [key]: _removed, ...rest } = s.cache;
            return { cache: rest };
          });
          return null;
        }
        return entry.data as T;
      },

      set: <T>(key: string, data: T) => {
        set((s) => {
          const next = {
            ...s.cache,
            [key]: { data, timestamp: Date.now() },
          };
          // LRU eviction: remove oldest if over limit
          const keys = Object.keys(next);
          if (keys.length > MAX_ENTRIES) {
            let oldestKey = keys[0]!;
            let oldestTs = next[oldestKey]!.timestamp;
            for (const k of keys) {
              if (next[k]!.timestamp < oldestTs) {
                oldestKey = k;
                oldestTs = next[k]!.timestamp;
              }
            }
            delete next[oldestKey];
          }
          return { cache: next };
        });
      },

      invalidate: (key: string) => {
        set((s) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [key]: _removed, ...rest } = s.cache;
          return { cache: rest };
        });
      },

      invalidatePrefix: (prefix: string) => {
        set((s) => {
          const next = { ...s.cache };
          for (const key of Object.keys(next)) {
            if (key.startsWith(prefix)) delete next[key];
          }
          return { cache: next };
        });
      },
    }),
    {
      name: 'quartinho:api-cache',
      partialize: (s) => ({ cache: s.cache }),
    },
  ),
);
