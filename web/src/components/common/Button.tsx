import React from 'react';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

/**
 * Button — single zine variant (Section 13.5).
 * Solid burntYellow bg, cream text, cream hand-drawn border.
 * Hover: wobble + shift to burntOrange. No primary/secondary ladder.
 */
export const Button: React.FC<ButtonProps> = ({
  children,
  className = '',
  ...rest
}) => {
  return (
    <button
      {...rest}
      className={[
        'inline-block',
        'font-body font-bold',
        'px-5 py-2',
        'border-4 border-zine-cream',
        'bg-zine-burntYellow text-zine-cream',
        'hover:bg-zine-burntOrange hover:wobble',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-zine-burntOrange',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        'transition-colors',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  );
};

export default Button;
