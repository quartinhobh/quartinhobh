import React from 'react';
import { ZineBorderDecorative } from '@/components/common/ZineFrame';

export interface LyricsDisplayProps {
  lyrics: string | null;
  loading?: boolean;
}

/**
 * LyricsDisplay — renders lyrics inside a periwinkle frame with wobble border
 * but text inside is NOT wobbled (legibility). Uses ZineBorderDecorative
 * which applies the wobble filter only to the border layer.
 */
export const LyricsDisplay: React.FC<LyricsDisplayProps> = ({
  lyrics,
  loading = false,
}) => {
  return (
    <ZineBorderDecorative bg="periwinkle" borderColor="periwinkle">
      {loading ? (
        <p className="font-body text-zine-cream opacity-70">
          Carregando letra...
        </p>
      ) : lyrics ? (
        <pre
          className="font-body text-lg text-zine-cream whitespace-pre-wrap max-h-96 overflow-y-auto leading-normal tracking-wider antialiased"
          aria-label="lyrics"
          style={{ textRendering: 'optimizeLegibility' }}
        >
          {lyrics}
        </pre>
      ) : (
        <p className="font-body text-zine-cream">Letra não encontrada</p>
      )}
    </ZineBorderDecorative>
  );
};

export default LyricsDisplay;
