import type { Event } from '@/types';

export type ChatWindowFields = Pick<
  Event,
  'chatEnabled' | 'chatOpensAt' | 'chatClosesAt'
>;

function normalizeEnabled(event: ChatWindowFields): boolean {
  // default: chat is enabled unless explicitly set to false.
  return event.chatEnabled !== false;
}

export function isChatAvailable(event: ChatWindowFields, now: number = Date.now()): boolean {
  if (!normalizeEnabled(event)) return false;
  // Chat abre automaticamente no dia do evento (sem chatOpensAt)
  if (event.chatClosesAt != null && now > event.chatClosesAt) return false;
  return true;
}

export function chatStatusText(
  event: ChatWindowFields,
  now: number = Date.now(),
): string | null {
  if (!normalizeEnabled(event)) return 'chat desativado';
  if (event.chatClosesAt != null && now > event.chatClosesAt) {
    return 'chat fechado';
  }
  return null;
}

function formatHour(ts: number): string {
  const d = new Date(ts);
  const hh = d.getHours();
  const mm = d.getMinutes();
  return mm === 0 ? `${hh}h` : `${hh}h${mm.toString().padStart(2, '0')}`;
}

export function formatChatWindow(event: ChatWindowFields): string | null {
  if (!normalizeEnabled(event)) return null;
  if (event.chatClosesAt == null) return null;
  return `fecha às ${formatHour(event.chatClosesAt)}`;
}
