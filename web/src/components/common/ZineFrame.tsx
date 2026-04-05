import React from 'react';

type ZineBg = 'mint' | 'periwinkle' | 'cream' | 'burntYellow';

export interface ZineFrameProps {
  bg?: ZineBg;
  borderColor?: ZineBg;
  wobble?: boolean;
  className?: string;
  children: React.ReactNode;
}

const bgClassMap: Record<ZineBg, string> = {
  mint: 'bg-zine-mint',
  periwinkle: 'bg-zine-periwinkle',
  cream: 'bg-zine-cream',
  burntYellow: 'bg-zine-burntYellow',
};

const borderClassMap: Record<ZineBg, string> = {
  mint: 'border-zine-mint',
  periwinkle: 'border-zine-periwinkle',
  cream: 'border-zine-cream',
  burntYellow: 'border-zine-burntYellow',
};

/**
 * ZineFrame — core compositional primitive (Section 13.3).
 * Colored background + hand-drawn cream border via SVG feTurbulence
 * displacement filter. Supports frame-within-frame nesting.
 */
export const ZineFrame: React.FC<ZineFrameProps> = ({
  bg = 'mint',
  borderColor = 'cream',
  wobble = false,
  className = '',
  children,
}) => {
  return (
    <>
      {/* Inline SVG filter definition — feTurbulence + feDisplacementMap
          gives the organic "giz/xerox" border wobble. Safe to mount more
          than once; ids are scoped by browser dedup on matching defs. */}
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
      <div
        className={[
          bgClassMap[bg],
          borderClassMap[borderColor],
          'border-4 p-4 relative',
          wobble ? 'hover:wobble' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ filter: 'url(#zine-wobble)' }}
      >
        {children}
      </div>
    </>
  );
};

export default ZineFrame;
