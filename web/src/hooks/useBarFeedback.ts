import { useCallback, useEffect, useState } from 'react';
import { fetchBarFeedback, postBarFeedback, deleteBarFeedback } from '@/services/api';

export interface UseBarFeedbackResult {
  likedCount: number;
  dislikedCount: number;
  userVote: 'liked' | 'disliked' | null;
  handleVote: (vote: 'liked' | 'disliked') => Promise<void>;
  handleRemoveVote: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function useBarFeedback(
  barId: string,
  idToken: string | null,
  firebaseUid: string | null,
): UseBarFeedbackResult {
  const [likedCount, setLikedCount] = useState(0);
  const [dislikedCount, setDislikedCount] = useState(0);
  const [userVote, setUserVote] = useState<'liked' | 'disliked' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchBarFeedback(barId, idToken)
      .then((data) => {
        if (cancelled) return;
        setLikedCount(data.liked);
        setDislikedCount(data.disliked);
        setUserVote(data.userVote ?? null);
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) { setError(err instanceof Error ? err.message : 'error'); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [barId, idToken, tick]);

  const handleVote = useCallback(async (vote: 'liked' | 'disliked') => {
    if (!firebaseUid || !idToken) throw new Error('not_authenticated');
    const prev = { liked: likedCount, disliked: dislikedCount, userVote };
    if (vote === 'liked') setLikedCount((c) => c + 1);
    else setDislikedCount((c) => c + 1);
    setUserVote(vote);
    try {
      await postBarFeedback(barId, vote, idToken);
      setTick((t) => t + 1);
    } catch (err) {
      setLikedCount(prev.liked); setDislikedCount(prev.disliked); setUserVote(prev.userVote);
      throw err;
    }
  }, [barId, idToken, firebaseUid, likedCount, dislikedCount, userVote]);

  const handleRemoveVote = useCallback(async () => {
    if (!firebaseUid || !idToken) throw new Error('not_authenticated');
    const prev = { liked: likedCount, disliked: dislikedCount, userVote };
    if (userVote === 'liked') setLikedCount((c) => Math.max(0, c - 1));
    else if (userVote === 'disliked') setDislikedCount((c) => Math.max(0, c - 1));
    setUserVote(null);
    try {
      await deleteBarFeedback(barId, idToken);
      setTick((t) => t + 1);
    } catch (err) {
      setLikedCount(prev.liked); setDislikedCount(prev.disliked); setUserVote(prev.userVote);
      throw err;
    }
  }, [barId, idToken, firebaseUid, likedCount, dislikedCount, userVote]);

  return { likedCount, dislikedCount, userVote, handleVote, handleRemoveVote, loading, error };
}
