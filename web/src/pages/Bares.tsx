import { Link } from 'react-router-dom';
import { useSessionStore } from '@/store/sessionStore';
import { useIdToken } from '@/hooks/useIdToken';
import BarList from '@/components/bares/BarList';
import Button from '@/components/common/Button';

export default function Bares() {
  const firebaseUid = useSessionStore((s) => s.firebaseUid);
  const idToken = useIdToken();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-3xl text-zine-burntOrange">bares</h1>

      <aside className="flex items-start gap-2 border-2 border-dashed border-zine-burntYellow/70 bg-zine-burntYellow/10 p-3 rounded">
        <span className="text-xl leading-none mt-0.5" aria-hidden>🍻</span>
        <div className="font-body text-sm text-zine-burntOrange/90 leading-relaxed">
          o quartinho é itinerante — toda edição rola num lugar diferente. tamo
          organizando uma <strong>baratona</strong> pra descobrir bares novos
          que combinem com a vibe. quer ajudar?{' '}
          <Link to="/novo-bar" className="underline hover:text-zine-burntOrange">indica um bar</Link>{' '}
          que voce curte, ou passa nos ja indicados pra dar seu feedback (curti
          / não gostei + comentário).
        </div>
      </aside>

      <div className="flex items-center justify-end">
        <Link to="/novo-bar"><Button>indicar bar</Button></Link>
      </div>
      <BarList idToken={idToken} firebaseUid={firebaseUid} />
    </div>
  );
}
