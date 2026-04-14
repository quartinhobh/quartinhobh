// Cover art fetching service — implements a waterfall approach:
// 1. Cover Art Archive (Release MBID)
// 2. Deezer (no API key required)
// 3. Last.fm (optional API key)
// 4. null (fallback to placeholder)
//
// After finding a valid URL, generates a blur placeholder.

import { generateBlurPlaceholder } from './blurPlaceholder';

interface CoverArtResult {
  coverUrl: string | null;
  coverBlurDataUrl: string | null;
}

interface CacheEntry {
  result: CoverArtResult;
  expiresAt: number;
}

// In-memory cache: MBID → { result, expiresAt }
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCached(mbid: string): CoverArtResult | null {
  const entry = cache.get(mbid);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(mbid);
    return null;
  }
  return entry.result;
}

function setCached(mbid: string, result: CoverArtResult): void {
  cache.set(mbid, {
    result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * Level 1: Cover Art Archive (Release MBID)
 * Tries both front-500 and front-250 as fallback.
 */
async function fetchFromCAA(mbid: string): Promise<string | null> {
  const urls = [
    `https://coverartarchive.org/release/${mbid}/front-500`,
    `https://coverartarchive.org/release/${mbid}/front-250`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        return url;
      }
    } catch {
      // Network error or timeout — continue to next
    }
  }

  return null;
}

/**
 * Level 2: Deezer API (no authentication required)
 * Searches for the album and returns the cover_big URL.
 */
async function fetchFromDeezer(
  artistCredit: string,
  albumTitle: string,
): Promise<string | null> {
  try {
    const query = `${artistCredit} ${albumTitle}`;
    const url = `https://api.deezer.com/search/album?q=${encodeURIComponent(query)}`;
    const res = await fetch(url);

    if (!res.ok) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as any;
    if (!data.data || data.data.length === 0) return null;

    const album = data.data[0];
    return album.cover_big || album.cover_medium || null;
  } catch {
    return null;
  }
}

/**
 * Level 3: Last.fm API (requires optional API key)
 * If LASTFM_API_KEY is not set, this level is skipped.
 */
async function fetchFromLastFm(
  artistCredit: string,
  albumTitle: string,
): Promise<string | null> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return null; // Skip if key not configured

  try {
    // Parse first artist name from artistCredit (e.g., "Artist1; Artist2" → "Artist1")
    const artistName = artistCredit.split(';')[0]?.trim() || artistCredit;

    const url = new URL('https://ws.audioscrobbler.com/2.0/');
    url.searchParams.set('method', 'album.getInfo');
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('artist', artistName);
    url.searchParams.set('album', albumTitle);
    url.searchParams.set('format', 'json');

    const res = await fetch(url.toString());
    if (!res.ok) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as any;
    if (!data.album || !data.album.image) return null;

    // Find "extralarge" image
    const images = data.album.image as Array<{ size?: string; '#text'?: string }>;
    const extraLarge = images.find((img) => img.size === 'extralarge');
    return extraLarge?.['#text'] || null;
  } catch {
    return null;
  }
}

/**
 * Main waterfall function.
 * Tries CAA → Deezer → Last.fm → null.
 * After finding a valid URL, generates a blur placeholder.
 */
export async function fetchCoverArt(params: {
  mbid: string;
  artistCredit: string;
  albumTitle: string;
}): Promise<CoverArtResult> {
  const { mbid, artistCredit, albumTitle } = params;

  // Check cache first
  const cached = getCached(mbid);
  if (cached) return cached;

  // Level 1: Cover Art Archive
  let coverUrl = await fetchFromCAA(mbid);

  // Level 2: Deezer
  if (!coverUrl) {
    coverUrl = await fetchFromDeezer(artistCredit, albumTitle);
  }

  // Level 3: Last.fm
  if (!coverUrl) {
    coverUrl = await fetchFromLastFm(artistCredit, albumTitle);
  }

  // Level 4: Generate blur placeholder if we found a URL
  let coverBlurDataUrl: string | null = null;
  if (coverUrl) {
    try {
      coverBlurDataUrl = await generateBlurPlaceholder(coverUrl);
    } catch {
      // If blur generation fails, still return the valid cover URL
      // The frontend will show the fallback if the image fails to load
    }
  }

  const result: CoverArtResult = { coverUrl, coverBlurDataUrl };
  setCached(mbid, result);
  return result;
}
