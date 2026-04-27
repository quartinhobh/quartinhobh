import React from 'react';
import { Link } from 'react-router-dom';

export interface BaratonaIntroProps {
  variant?: 'full' | 'short';
}

export const BaratonaIntro: React.FC<BaratonaIntroProps> = ({ variant = 'full' }) => {
  return (
    <p className="font-body text-sm text-zine-burntOrange/80 dark:text-zine-cream/80 leading-relaxed italic">
      🍻{' '}
      {variant === 'full' ? (
        <>
          o quartinho é itinerante — toda edição rola num lugar diferente. Estamos
          organizando uma "<strong className="not-italic">baratona</strong>" pra descobrir locais
          novos que combinem com a vibe. quer ajudar?{' '}
          <Link to="/novo-local" className="underline font-bold not-italic hover:text-zine-burntOrange">
            indica um local
          </Link>{' '}
          que voce curte, ou se já foi em algum dos indicados? deixa seu feedback (❤️ / 💀 + comentário) clicando em "ver comentários →" no card.
        </>
      ) : (
        <>
          indica um local pra baratona — sua sugestão ajuda a gente a achar lugares novos. ja foi em algum?{' '}
          <Link to="/locais" className="underline font-bold not-italic hover:text-zine-burntOrange">
            ajuda avaliando
          </Link>.
        </>
      )}
    </p>
  );
};

export default BaratonaIntro;
