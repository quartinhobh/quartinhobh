import { useIdToken } from '@/hooks/useIdToken';
import AlbumSuggestionForm from '@/components/bares/AlbumSuggestionForm';

export default function SugerirDisco() {
  const idToken = useIdToken();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-3xl text-zine-burntOrange">sugerir disco</h1>
      <AlbumSuggestionForm idToken={idToken} />
    </div>
  );
}
