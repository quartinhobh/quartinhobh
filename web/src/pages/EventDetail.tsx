import React, { useEffect, useState } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import { EventDetailSkeleton } from '@/components/common/LoadingState';
import AlbumDisplay from '@/components/events/AlbumDisplay';
import TrackList from '@/components/events/TrackList';
import VoteResults from '@/components/voting/VoteResults';
import {
  fetchEventById,
  fetchMusicBrainzAlbum,
  fetchPhotos,
  fetchTallies,
} from '@/services/api';
import type {
  Event,
  MusicBrainzRelease,
  Photo,
  PhotoCategory,
  VoteTallies,
} from '@/types';

export interface EventDetailProps {
  eventId: string;
}

/**
 * EventDetail — archived event view. Composes AlbumDisplay + TrackList +
 * VoteResults (read-only) + a zine-style photo gallery split by category.
 */
export const EventDetail: React.FC<EventDetailProps> = ({ eventId }) => {
  const [event, setEvent] = useState<Event | null>(null);
  const [album, setAlbum] = useState<MusicBrainzRelease | null>(null);
  const [tallies, setTallies] = useState<VoteTallies | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [tab, setTab] = useState<PhotoCategory>('category1');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const ev = await fetchEventById(eventId);
        if (cancelled) return;
        setEvent(ev);
        if (ev) {
          // Use snapshot if available (Branch 1), otherwise fetch from MB API (Branch 2)
          let rel: MusicBrainzRelease | null = null;
          if (ev.album) {
            // Snapshot exists — assemble from it without network call
            rel = {
              id: ev.mbAlbumId,
              title: ev.album.albumTitle,
              artistCredit: ev.album.artistCredit,
              date: ev.date,
              tracks: ev.album.tracks,
            };
          } else {
            // Snapshot is null — fetch from MB API as fallback
            rel = await fetchMusicBrainzAlbum(ev.mbAlbumId).catch(() => null);
          }

          const [tal, pics] = await Promise.all([
            fetchTallies(eventId).catch(() => null),
            fetchPhotos(eventId).catch(() => [] as Photo[]),
          ]);
          if (cancelled) return;
          setAlbum(rel);
          setTallies(tal);
          setPhotos(pics);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return (): void => {
      cancelled = true;
    };
  }, [eventId]);

  if (error) {
    return (
      <ZineFrame bg="cream">
        <p role="alert" className="font-body text-zine-burntOrange">
          erro: {error}
        </p>
      </ZineFrame>
    );
  }

  if (!event) {
    return <EventDetailSkeleton />;
  }

  const visible = photos.filter((p) => p.category === tab);

  return (
    <div className="flex flex-col gap-4">
      <AlbumDisplay event={event} album={album} coverUrl={event.album?.coverUrl} />
      <TrackList tracks={album?.tracks ?? []} artistCredit={album?.artistCredit} />
      <VoteResults tallies={tallies} tracks={album?.tracks ?? []} />

      {photos.length > 0 && (
        <ZineFrame bg="periwinkle" borderColor="cream">
          <h2 className="font-display text-2xl text-zine-cream mb-3">Fotos</h2>
          <div
            role="tablist"
            aria-label="photo-categories"
            className="flex gap-2 mb-3"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'category1'}
              aria-label="tab-category1"
              onClick={() => setTab('category1')}
              className={`font-body px-3 py-1 border-4 border-zine-cream ${
                tab === 'category1'
                  ? 'bg-zine-burntYellow text-zine-cream'
                  : 'bg-zine-periwinkle text-zine-cream'
              }`}
            >
              Fotos do evento
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'category2'}
              aria-label="tab-category2"
              onClick={() => setTab('category2')}
              className={`font-body px-3 py-1 border-4 border-zine-cream ${
                tab === 'category2'
                  ? 'bg-zine-burntYellow text-zine-cream'
                  : 'bg-zine-periwinkle text-zine-cream'
              }`}
            >
              Playlist
            </button>
          </div>
          <div
            aria-label="photo-mosaic"
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
          >
            {visible.map((p) => (
              <img
                key={p.id}
                src={p.url}
                alt={`photo-${p.id}`}
                className="w-full h-32 object-cover border-4 border-zine-cream"
              />
            ))}
          </div>
        </ZineFrame>
      )}
    </div>
  );
};

export default EventDetail;
