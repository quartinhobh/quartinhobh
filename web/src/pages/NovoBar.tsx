import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useIdToken } from '@/hooks/useIdToken';
import BarSuggestionForm from '@/components/bares/BarSuggestionForm';
import BaratonaIntro from '@/components/bares/BaratonaIntro';
import Button from '@/components/common/Button';

export default function NovoBar() {
  const idToken = useIdToken();
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="flex flex-col gap-4" style={{ filter: 'url(#zine-wobble)' }}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-display text-3xl text-zine-burntOrange" style={{ filter: 'url(#zine-wobble)' }}>indicar local</h1>
        <Link
          to="/locais"
          className="font-body text-sm font-bold text-zine-burntOrange underline hover:text-zine-burntOrange/70"
          style={{ filter: 'url(#zine-wobble)' }}
        >
          ver locais ja indicados →
        </Link>
      </div>

      <BaratonaIntro variant="short" />

      {submitted ? (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col gap-3 border-2 border-zine-burntYellow p-4 bg-zine-burntYellow/10"
          style={{ filter: 'url(#zine-wobble)' }}
        >
          <p className="font-body text-sm text-zine-burntOrange">local indicado com sucesso!</p>
          <Button type="button" onClick={() => navigate('/locais')}>
            ver locais
          </Button>
        </div>
      ) : (
        <BarSuggestionForm idToken={idToken} onSuccess={() => setSubmitted(true)} />
      )}
    </div>
  );
}
