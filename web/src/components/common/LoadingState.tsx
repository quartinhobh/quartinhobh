import { useEffect, useState } from 'react';
import ZineFrame from './ZineFrame';

export function LoadingState() {
  const [text, setText] = useState('carregando');
  useEffect(() => {
    const str = 'carregando';
    let i = 0;
    const tick = () => {
      setText(
        str
          .split('')
          .map((c, j) => (j % 2 === i % 2 ? c.toUpperCase() : c.toLowerCase()))
          .join(''),
      );
      i++;
      setTimeout(tick, 300 + Math.random() * 400);
    };
    const id = setTimeout(tick, 300 + Math.random() * 400);
    return () => clearTimeout(id);
  }, []);
  return (
    <ZineFrame bg="mint">
      <div className="text-center py-8">
        <h2 className="font-display text-2xl text-zine-cream mb-2">{text}…</h2>
      </div>
    </ZineFrame>
  );
}
