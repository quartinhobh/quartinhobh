import { useParams } from 'react-router-dom';
import { useBarDetail } from '@/hooks/useBarDetail';
import { useSessionStore } from '@/store/sessionStore';
import { useIdToken } from '@/hooks/useIdToken';
import BarCard from '@/components/bares/BarCard';
import SuggestionComments from '@/components/bares/SuggestionComments';
import ZineFrame from '@/components/common/ZineFrame';
import { LoadingState } from '@/components/common/LoadingState';

export default function BarDetail() {
  const { id } = useParams<{ id: string }>();
  const { bar, loading, notFound } = useBarDetail(id ?? '');
  const firebaseUid = useSessionStore((s) => s.firebaseUid);
  const idToken = useIdToken();

  if (loading) return <LoadingState />;
  if (notFound || !bar) {
    return (
      <ZineFrame bg="periwinkle">
        <p className="font-body text-zine-burntOrange">bar nao encontrado</p>
      </ZineFrame>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <BarCard bar={bar} idToken={idToken} firebaseUid={firebaseUid} asDetail={true} />
      <SuggestionComments barId={bar.id} idToken={idToken} firebaseUid={firebaseUid} />
    </div>
  );
}
