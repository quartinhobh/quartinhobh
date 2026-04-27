import { useEffect, useState } from 'react';
import { fetchBarSuggestion } from '@/services/api';
import type { PublicBarSuggestion } from '@/types';

export interface UseBarDetailResult {
  bar: PublicBarSuggestion | null;
  loading: boolean;
  error: string | null;
  notFound: boolean;
}

export function useBarDetail(id: string): UseBarDetailResult {
  const [bar, setBar] = useState<PublicBarSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) { setLoading(false); setNotFound(true); return; }
    let cancelled = false;
    setLoading(true);
    fetchBarSuggestion(id)
      .then((data) => { if (!cancelled) { setBar(data); setLoading(false); } })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('404')) { setNotFound(true); }
        else { setError(msg); }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  return { bar, loading, error, notFound };
}
