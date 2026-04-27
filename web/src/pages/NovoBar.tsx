import { Link, useNavigate } from 'react-router-dom';
import { useIdToken } from '@/hooks/useIdToken';
import BarSuggestionForm from '@/components/bares/BarSuggestionForm';

export default function NovoBar() {
  const idToken = useIdToken();
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-3xl text-zine-burntOrange">indicar bar</h1>

      <aside className="flex items-start gap-2 border-2 border-dashed border-zine-burntYellow/70 bg-zine-burntYellow/10 p-3 rounded">
        <span className="text-xl leading-none mt-0.5" aria-hidden>🍻</span>
        <div className="font-body text-sm text-zine-burntOrange/90 leading-relaxed">
          o quartinho é itinerante — toda edição rola num lugar diferente. tamo
          organizando uma <strong>baratona</strong> pra descobrir bares novos
          que combinem com a vibe. quer ajudar? indica um bar que voce curte,
          ou{' '}
          <Link to="/bares" className="underline hover:text-zine-burntOrange">
            passa nos ja indicados
          </Link>{' '}
          pra dar seu feedback (curti / não gostei + comentário).
        </div>
      </aside>

      <BarSuggestionForm idToken={idToken} onSuccess={() => navigate('/bares')} />
    </div>
  );
}
