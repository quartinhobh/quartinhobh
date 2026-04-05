import React from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import { useModeration } from '@/hooks/useModeration';

export interface ModerationPanelProps {
  idToken: string | null;
}

/**
 * ModerationPanel — admin/mod view.
 * Lists active bans with unban actions, plus the moderation log.
 * Composes ZineFrame + common/Button per Section 13 primitives.
 */
export const ModerationPanel: React.FC<ModerationPanelProps> = ({ idToken }) => {
  const { bans, logs, loading, error, unbanUser } = useModeration(idToken);

  return (
    <div className="flex flex-col gap-4">
      <ZineFrame bg="cream">
        <h2 className="font-display text-2xl text-zine-burntOrange mb-3">
          Banimentos ativos
        </h2>
        {loading && (
          <p className="font-body text-zine-burntOrange/70">carregando…</p>
        )}
        {error && (
          <p className="font-body text-zine-burntOrange">erro: {error}</p>
        )}
        {!loading && bans.length === 0 && (
          <p className="font-body text-zine-burntOrange/70 italic">
            Nenhum banimento ativo.
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {bans.map((b) => (
            <li
              key={b.userId}
              data-testid={`ban-row-${b.userId}`}
              className="flex items-center justify-between gap-3 border-b border-zine-burntOrange/30 pb-2"
            >
              <div className="flex flex-col">
                <span className="font-display text-zine-burntOrange">
                  {b.userId}
                </span>
                <span className="font-body text-xs text-zine-burntOrange/70">
                  {b.reason ?? 'sem motivo'}
                </span>
              </div>
              <Button onClick={() => void unbanUser(b.userId)}>unban</Button>
            </li>
          ))}
        </ul>
      </ZineFrame>

      <ZineFrame bg="cream">
        <h2 className="font-display text-2xl text-zine-burntOrange mb-3">
          Registo de moderação
        </h2>
        {logs.length === 0 ? (
          <p className="font-body text-zine-burntOrange/70 italic">
            Sem entradas.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {logs.map((l) => (
              <li
                key={l.id}
                data-testid={`log-row-${l.id}`}
                className="font-body text-sm text-zine-burntOrange"
              >
                <span className="font-display text-zine-burntYellow mr-2">
                  {l.action}
                </span>
                {l.targetUserId}
                {l.reason ? ` — ${l.reason}` : ''}
              </li>
            ))}
          </ul>
        )}
      </ZineFrame>
    </div>
  );
};

export default ModerationPanel;
