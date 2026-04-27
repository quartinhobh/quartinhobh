import { useEffect, useState, useCallback } from 'react';
import { fetchBarSuggestions } from '@/services/api';
import type { PublicBarSuggestion } from '@/types';

export interface UseBarSuggestionsResult {
  bars: PublicBarSuggestion[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useBarSuggestions(): UseBarSuggestionsResult {
  const [bars, setBars] = useState<PublicBarSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchBarSuggestions()
      .then((data) => { if (!cancelled) { setBars(data); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err instanceof Error ? err.message : 'error'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return { bars, loading, error, refresh };
}
