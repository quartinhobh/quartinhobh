import { useEffect, useState, useCallback } from 'react';
import { fetchAlbumSuggestions } from '@/services/api';
import type { AlbumSuggestion, SuggestionStatus } from '@/types';

export interface UseAlbumSuggestionsResult {
  albums: AlbumSuggestion[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useAlbumSuggestions(
  status: SuggestionStatus | undefined,
  idToken: string | null,
): UseAlbumSuggestionsResult {
  const [albums, setAlbums] = useState<AlbumSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!idToken) { setAlbums([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    fetchAlbumSuggestions(status, idToken)
      .then((data) => { if (!cancelled) { setAlbums(data); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err instanceof Error ? err.message : 'error'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [status, idToken, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { albums, loading, error, refresh };
}
