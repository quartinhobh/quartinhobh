import React, { useState } from 'react';
import Button from '@/components/common/Button';
import Modal from '@/components/common/Modal';
import type { ChatMessage as ChatMessageType } from '@/types';

export interface ChatMessageProps {
  message: ChatMessageType & { id?: string };
  canModerate?: boolean;
  onDelete?: (messageId: string, reason?: string) => Promise<void> | void;
}

function formatRelative(ts: number): string {
  if (!ts || Number.isNaN(ts)) return '';
  const diff = Date.now() - ts;
  if (diff < 0) return 'agora';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return `${day}d`;
}

/**
 * ChatMessage — single row. Per P3-E spec: no per-message ZineFrame
 * (too heavy); a simple cream divider line instead. P3-F adds an
 * optional moderator-only delete affordance that opens a Modal prompt
 * for a reason before calling onDelete.
 */
export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  canModerate = false,
  onDelete,
}) => {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const showDelete = canModerate && !!onDelete && !!message.id && !message.isDeleted;

  const handleConfirm = async (): Promise<void> => {
    if (!onDelete || !message.id) return;
    await onDelete(message.id, reason.trim() ? reason.trim() : undefined);
    setConfirming(false);
    setReason('');
  };

  return (
    <div className="border-b border-zine-cream/40 py-2 px-1 flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-zine-burntYellow text-sm">
          {message.displayName}
        </span>
        <span
          data-testid="chat-message-time"
          className="font-body text-xs text-zine-burntOrange/70"
        >
          {formatRelative(message.timestamp)}
        </span>
        {showDelete && (
          <button
            type="button"
            data-testid="chat-delete-btn"
            onClick={() => setConfirming(true)}
            className="ml-auto font-body text-xs text-zine-burntOrange/80 underline hover:text-zine-burntOrange focus:outline-none focus-visible:ring-2 focus-visible:ring-zine-burntOrange"
          >
            apagar
          </button>
        )}
      </div>
      <p className="font-body text-zine-burntOrange break-words">
        {message.isDeleted ? (
          <em className="text-zine-burntOrange/50">[mensagem apagada]</em>
        ) : (
          message.text
        )}
      </p>
      {showDelete && (
        <Modal
          isOpen={confirming}
          onClose={() => setConfirming(false)}
          title="Apagar mensagem"
        >
          <div className="flex flex-col gap-3">
            <label className="font-body text-sm" style={{ color: '#1A1A1A' }}>
              Motivo (opcional)
            </label>
            <input
              data-testid="chat-delete-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="border-2 border-zine-burntOrange bg-zine-cream font-body px-2 py-1"
            />
            <div className="flex gap-2 justify-end">
              <Button onClick={() => setConfirming(false)}>cancelar</Button>
              <Button
                data-testid="chat-delete-confirm"
                onClick={() => void handleConfirm()}
              >
                apagar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ChatMessage;
