import React, { useState } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import SuggestionStatusTabs from '@/components/bares/SuggestionStatusTabs';
import BarCard from '@/components/bares/BarCard';
import { useBarSuggestions } from '@/hooks/useBarSuggestions';
import {
  createBarSuggestion,
  updateBarSuggestionStatus,
  deleteBarSuggestion,
} from '@/services/api';
import type { SuggestionStatus } from '@/types';

const inputClass =
  'border-4 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream font-body p-2 focus:outline-none focus:border-zine-burntOrange w-full';

export interface BarSuggestionsPanelProps {
  idToken: string;
}

export const BarSuggestionsPanel: React.FC<BarSuggestionsPanelProps> = ({ idToken }) => {
  // TODO: Use admin endpoint when available for status-filtered listing
  const { bars, loading, error, refresh } = useBarSuggestions();
  const [activeStatus, setActiveStatus] = useState<SuggestionStatus>('suggested');
  const [newBarName, setNewBarName] = useState('');
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newBarName.trim()) return;
    setBusy(true);
    setCreateError(null);
    try {
      await createBarSuggestion({ name: newBarName.trim() }, idToken);
      setNewBarName('');
      refresh();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'erro ao adicionar bar');
    } finally {
      setBusy(false);
    }
  }

  async function handleMoveStatus(id: string, status: SuggestionStatus) {
    try {
      await updateBarSuggestionStatus(id, status, idToken);
      refresh();
    } catch {
      // silently ignore — user can retry
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteBarSuggestion(id, idToken);
      refresh();
    } catch {
      // silently ignore — user can retry
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ZineFrame bg="cream">
        <h2 className="font-display text-xl text-zine-burntOrange mb-3">Bares sugeridos</h2>
        <form onSubmit={(e) => void handleCreate(e)} className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={newBarName}
              onChange={(e) => setNewBarName(e.target.value)}
              placeholder="nome do bar"
              className={inputClass}
            />
            <Button type="submit" disabled={busy || !newBarName.trim()}>
              {busy ? 'adicionando...' : 'adicionar bar'}
            </Button>
          </div>
          {createError && (
            <p className="font-body text-xs text-red-500">{createError}</p>
          )}
        </form>
      </ZineFrame>

      <SuggestionStatusTabs activeStatus={activeStatus} onChange={setActiveStatus} />

      {loading && (
        <p className="font-body italic text-zine-burntOrange/70">carregando...</p>
      )}
      {error && (
        <p className="font-body text-xs text-red-500">{error}</p>
      )}

      <div className="flex flex-col gap-3">
        {bars.map((bar) => (
          <BarCard
            key={bar.id}
            bar={bar}
            idToken={idToken}
            firebaseUid="admin"
            asDetail={false}
            onMoveStatus={(id, status) => void handleMoveStatus(id, status)}
            onDelete={(id) => void handleDelete(id)}
          />
        ))}
      </div>
    </div>
  );
};

export default BarSuggestionsPanel;
