import React from 'react';
import { LoadingState } from '@/components/common/LoadingState';
import BarCard from '@/components/bares/BarCard';
import { useBarSuggestions } from '@/hooks/useBarSuggestions';

export interface BarListProps {
  idToken: string | null;
  firebaseUid: string | null;
}

export const BarList: React.FC<BarListProps> = ({ idToken, firebaseUid }) => {
  const { bars, loading, error } = useBarSuggestions();

  if (loading) return <LoadingState />;

  if (error) {
    return (
      <p className="font-body text-sm text-red-500">erro ao carregar bares</p>
    );
  }

  if (bars.length === 0) {
    return (
      <p className="font-body text-sm text-zine-burntOrange/70">nenhum bar indicado ainda</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {bars.map((bar) => (
        <BarCard
          key={bar.id}
          bar={bar}
          idToken={idToken}
          firebaseUid={firebaseUid}
          asDetail={false}
        />
      ))}
    </div>
  );
};

export default BarList;
