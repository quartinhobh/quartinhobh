import React from 'react';

type ZineBg = 'mint' | 'periwinkle' | 'cream' | 'burntYellow';

/**
 * ZineWobbleFilter — renders the global SVG filter definition once.
 * Mount this ONCE at the app root so any element using
 * `filter: url(#zine-wobble)` always finds it in the document.
 */
export const ZineWobbleFilter: React.FC = () => (
  <svg
    aria-hidden="true"
    width="0"
    height="0"
    style={{ position: 'absolute' }}
  >
    <defs>
      <filter id="zine-wobble">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.02"
          numOctaves="2"
          seed="4"
        />
        <feDisplacementMap in="SourceGraphic" scale="3" />
      </filter>
    </defs>
  </svg>
);

export interface ZineFrameProps {
  bg?: ZineBg;
  borderColor?: ZineBg;
  wobble?: boolean;
  noFilter?: boolean;
  /** When false, removes the internal p-4 padding so content touches the border. Default true. */
  padded?: boolean;
  className?: string;
  children: React.ReactNode;
}

// Light → dark background mapping. Dark variants preserve hue but lower
// luminance so the zine identity reads like "candlelit print".
const bgClassMap: Record<ZineBg, string> = {
  mint: 'bg-zine-mint dark:bg-zine-mint-dark',
  periwinkle: 'bg-zine-periwinkle dark:bg-zine-periwinkle-dark',
  cream: 'bg-zine-cream dark:bg-zine-surface-dark',
  burntYellow: 'bg-zine-burntYellow dark:bg-zine-burntYellow-bright',
};

// Borders stay light (cream) in both modes — they're the "paper" outlines.
// In dark mode they switch to a muted variant so they don't blow out.
const borderClassMap: Record<ZineBg, string> = {
  mint: 'border-zine-mint dark:border-zine-mint-dark',
  periwinkle: 'border-zine-periwinkle dark:border-zine-periwinkle-dark',
  cream: 'border-zine-cream dark:border-zine-cream/30',
  burntYellow: 'border-zine-burntYellow dark:border-zine-burntYellow-bright',
};

const ZineFrameBase: React.FC<ZineFrameProps> = ({
  bg = 'mint',
  borderColor = 'cream',
  wobble = false,
  noFilter = false,
  padded = true,
  className = '',
  children,
}) => {
  return (
    <div
      className={[
        bgClassMap[bg],
        borderClassMap[borderColor],
        'border-4 relative min-w-0 max-w-full overflow-hidden',
        padded ? 'p-4' : 'p-0',
        wobble ? 'hover:wobble' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={!noFilter ? { filter: 'url(#zine-wobble)' } : undefined}
    >
      {children}
    </div>
  );
};

export const ZineFrame: React.FC<ZineFrameProps> = (props) => (
  <ZineFrameBase {...props} />
);

export const ZineFrameNoWobble: React.FC<Omit<ZineFrameProps, 'noFilter'>> = (props) => (
  <ZineFrameBase {...props} noFilter />
);

/**
 * ZineBorder — apenas a borda wobble, sem padding interno.
 * Use quando voce quiser apenas o "papel rasgado" ao redor sem afastamento
 * do conteudo. Equivalente a `<ZineFrame padded={false}>`.
 */
export const ZineBorder: React.FC<Omit<ZineFrameProps, 'padded'>> = (props) => (
  <ZineFrameBase {...props} padded={false} />
);

export default ZineFrame;
