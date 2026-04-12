import { describe, expect, it } from 'vitest';
import {
  isChatAvailable,
  chatStatusText,
  formatChatWindow,
} from '@/utils/chatAvailability';

const NOW = new Date('2026-04-11T20:00:00').getTime();
const ONE_HOUR = 60 * 60 * 1000;

describe('isChatAvailable', () => {
  it('returns false when chatEnabled is explicitly false', () => {
    expect(isChatAvailable({ chatEnabled: false }, NOW)).toBe(false);
    expect(chatStatusText({ chatEnabled: false }, NOW)).toBe('chat desativado');
  });

  it('returns false when chatClosesAt is in the past + status says closed', () => {
    const event = { chatEnabled: true, chatClosesAt: NOW - ONE_HOUR };
    expect(isChatAvailable(event, NOW)).toBe(false);
    expect(chatStatusText(event, NOW)).toBe('chat fechado');
  });

  it('returns true when chatClosesAt is in the future and chat is enabled', () => {
    const event = {
      chatEnabled: true,
      chatClosesAt: NOW + ONE_HOUR,
    };
    expect(isChatAvailable(event, NOW)).toBe(true);
    expect(chatStatusText(event, NOW)).toBeNull();
  });

  it('returns true when no chatClosesAt (always open)', () => {
    const event = { chatEnabled: true, chatClosesAt: null };
    expect(isChatAvailable(event, NOW)).toBe(true);
    expect(chatStatusText(event, NOW)).toBeNull();
  });

  it('defaults chatEnabled to true when undefined', () => {
    expect(isChatAvailable({}, NOW)).toBe(true);
  });
});

describe('formatChatWindow', () => {
  it('returns null when chatClosesAt is null', () => {
    expect(formatChatWindow({ chatEnabled: true, chatClosesAt: null })).toBeNull();
  });

  it('returns null when chat is disabled', () => {
    expect(formatChatWindow({ chatEnabled: false })).toBeNull();
  });

  it('formats close-only window "fecha às Yh"', () => {
    const closes = new Date('2026-04-11T23:00:00').getTime();
    expect(
      formatChatWindow({ chatEnabled: true, chatClosesAt: closes }),
    ).toBe('fecha às 23h');
  });

  it('formats close window with minutes "fecha às Xh"', () => {
    const closes = new Date('2026-04-11T19:30:00').getTime();
    expect(formatChatWindow({ chatEnabled: true, chatClosesAt: closes })).toBe(
      'fecha às 19h30',
    );
  });
});
