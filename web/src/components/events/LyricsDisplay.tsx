import React from 'react';
import { ZineFrameNoWobble } from '@/components/common/ZineFrame';

export interface LyricsDisplayProps {
  lyrics: string | null;
  loading?: boolean;
}

/**
 * LyricsDisplay — renders lyrics inside a periwinkle ZineFrame with
 * whitespace preserved. Shows "Letra não encontrada" when lyrics are null.
 */
export const LyricsDisplay: React.FC<LyricsDisplayProps> = ({
  lyrics,
  loading = false,
}) => {
  return (
    <ZineFrameNoWobble bg="periwinkle">
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
    </ZineFrameNoWobble>
  );
};

export default LyricsDisplay;
