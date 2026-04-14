import { useEffect, useState } from 'react';
import {
  fetchCurrentEvent,
  fetchEventById,
  fetchMusicBrainzAlbum,
  fetchMusicBrainzTracks,
} from '@/services/api';
import { useApiCache } from '@/store/apiCache';
import type { Event, MusicBrainzRelease, MusicBrainzTrack, RsvpSummary } from '@/types';

export interface UseEventResult {
  event: Event | null;
  album: MusicBrainzRelease | null;
  tracks: MusicBrainzTrack[];
  initialRsvpSummary: RsvpSummary | null;
  loading: boolean;
  error: string | null;
}

function buildEventCacheKey(eventId: string | null): string {
  return eventId ? `event:${eventId}` : 'event:current';
}

interface CachedEventData {
  event: Event | null;
  album: MusicBrainzRelease | null;
  tracks: MusicBrainzTrack[];
  initialRsvpSummary: RsvpSummary | null;
}

async function fetchEventData(
  eventId: string | null,
): Promise<CachedEventData> {
  let ev: Event | null;
  let initialRsvpSummary: RsvpSummary | null = null;

  // Retry with exponential backoff for rate limiting
  const fetchWithRetry = async <T,>(fn: () => Promise<T>, maxRetries = 3): Promise<T> => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (err) {
        const isRateLimited = err instanceof Error && err.message.includes('429');
        const isLastAttempt = i === maxRetries - 1;
        if (!isRateLimited || isLastAttempt) throw err;
        // Exponential backoff: 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
    throw new Error('Max retries exceeded');
  };

  if (eventId) {
    ev = await fetchWithRetry(() => fetchEventById(eventId));
  } else {
    const current = await fetchWithRetry(() => fetchCurrentEvent());
    ev = current?.event ?? null;
    initialRsvpSummary = current?.rsvpSummary ?? null;
  }

  let alb: MusicBrainzRelease | null = null;
  let trks: MusicBrainzTrack[] = [];

  if (ev?.album) {
    alb = {
      id: ev.mbAlbumId,
      title: ev.album.albumTitle,
      artistCredit: ev.album.artistCredit,
      date: ev.date,
      tracks: ev.album.tracks,
    };
    trks = ev.album.tracks;
  } else if (ev) {
    try {
      const [albumData, tracksData] = await Promise.all([
        fetchWithRetry(() => fetchMusicBrainzAlbum(ev!.mbAlbumId), 2),
        fetchWithRetry(() => fetchMusicBrainzTracks(ev!.mbAlbumId), 2),
      ]);
      alb = albumData;
      trks = tracksData.length > 0 ? tracksData : albumData.tracks;
    } catch {
      // MusicBrainz lookup failed silently — maybe 404, maybe network error
      // User still sees the event, just without album art/tracks
    }
  }

  return { event: ev, album: alb, tracks: trks, initialRsvpSummary };
}

export function useEvent(eventId: string | null): UseEventResult {
  const cacheKey = buildEventCacheKey(eventId);

  const cached = useApiCache.getState().get<CachedEventData>(cacheKey);
  const [data, setData] = useState<CachedEventData | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const result = await fetchEventData(eventId);
        if (cancelled) return;
        useApiCache.getState().set(cacheKey, result);
        setData(result);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'unknown_error');
        setLoading(false);
      }
    };

    // Se tem cache, mostra na hora e refetch ao fundo
    const cachedData = useApiCache.getState().get<CachedEventData>(cacheKey);
    if (cachedData) {
      setLoading(false);
      void run(); // Background refetch
    } else {
      void run();
    }

    return () => {
      cancelled = true;
    };
  }, [eventId, cacheKey]);

  return {
    event: data?.event ?? null,
    album: data?.album ?? null,
    tracks: data?.tracks ?? [],
    initialRsvpSummary: data?.initialRsvpSummary ?? null,
    loading,
    error,
  };
}
