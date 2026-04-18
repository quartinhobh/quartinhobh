import React, { useState } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import type { Photo, PhotoCategory } from '@/types';

interface PhotoGalleryProps {
  photos: Photo[];
}

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({ photos }) => {
  const [tab, setTab] = useState<PhotoCategory>('category1');

  if (photos.length === 0) {
    return (
      <ZineFrame bg="periwinkle" borderColor="cream">
        <p className="font-body text-zine-cream text-center py-8">
          Nenhuma foto disponível ainda.
        </p>
      </ZineFrame>
    );
  }

  const visible = photos.filter((p) => p.category === tab);

  return (
    <ZineFrame bg="periwinkle" borderColor="cream">
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
  );
};

export default PhotoGallery;