import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChatRoom } from '@/components/chat/ChatRoom';
import type { ChatMessage } from '@/types';

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

// Mock scrollIntoView which jsdom doesn't implement
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    writable: true,
    value: vi.fn(),
  });
});

describe('ChatRoom', () => {
  const mkMsg = (i: number, text: string): ChatMessage & { id: string } => ({
    id: `m${i}`,
    uid: `u${i}`,
    displayName: `User ${i}`,
    text,
    timestamp: i * 1000,
    isDeleted: false,
  });

  it('renders each message', () => {
    const messages = [mkMsg(1, 'first'), mkMsg(2, 'second'), mkMsg(3, 'third')];
    render(<ChatRoom messages={messages} />, { wrapper: Wrapper });
    expect(screen.getByText('first')).toBeInTheDocument();
    expect(screen.getByText('second')).toBeInTheDocument();
    expect(screen.getByText('third')).toBeInTheDocument();
  });

  it('scrolls to bottom when a new message arrives', () => {
    const messages = [mkMsg(1, 'one')];
    const { rerender } = render(<Wrapper><ChatRoom messages={messages} /></Wrapper>);
    const spy = HTMLElement.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
    spy.mockClear();
    rerender(<Wrapper><ChatRoom messages={[...messages, mkMsg(2, 'two')]} /></Wrapper>);
    expect(spy).toHaveBeenCalled();
  });

  it('renders inside a ZineFrame (cream background)', () => {
    const { container } = render(<ChatRoom messages={[]} />, { wrapper: Wrapper });
    expect(container.innerHTML).toMatch(/bg-zine-cream/);
  });
});
