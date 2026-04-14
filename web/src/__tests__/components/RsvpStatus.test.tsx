import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RsvpStatus } from '@/components/rsvp/RsvpStatus';
import type { RsvpSummary } from '@/types';

describe('RsvpStatus', () => {
  it('shows "5/30 confirmados" with capacity', () => {
    const summary: RsvpSummary = {
      confirmedCount: 5,
      waitlistCount: 0,
      capacity: 30,
      confirmedAvatars: [],
    };
    render(<RsvpStatus summary={summary} isAdmin />);
    expect(screen.getByText('5/30 confirmados')).toBeInTheDocument();
  });

  it('shows "5 confirmados" without capacity', () => {
    const summary: RsvpSummary = {
      confirmedCount: 5,
      waitlistCount: 0,
      capacity: null,
      confirmedAvatars: [],
    };
    render(<RsvpStatus summary={summary} isAdmin />);
    expect(screen.getByText('5 confirmados')).toBeInTheDocument();
  });

  it('shows "25 vagas restantes" when spots available', () => {
    const summary: RsvpSummary = {
      confirmedCount: 5,
      waitlistCount: 0,
      capacity: 30,
      confirmedAvatars: [],
    };
    render(<RsvpStatus summary={summary} isAdmin />);
    expect(screen.getByText(/25 vagas restantes/i)).toBeInTheDocument();
  });

  it('shows "esgotado" when confirmedCount >= capacity', () => {
    const summary: RsvpSummary = {
      confirmedCount: 30,
      waitlistCount: 0,
      capacity: 30,
      confirmedAvatars: [],
    };
    render(<RsvpStatus summary={summary} isAdmin />);
    expect(screen.getByText('esgotado')).toBeInTheDocument();
  });

  it('shows waitlist count when > 0', () => {
    const summary: RsvpSummary = {
      confirmedCount: 5,
      waitlistCount: 3,
      capacity: 30,
      confirmedAvatars: [],
    };
    render(<RsvpStatus summary={summary} isAdmin />);
    expect(screen.getByText(/3 na fila de espera/i)).toBeInTheDocument();
  });

  it('renders avatar initials when no avatarUrl', () => {
    const summary: RsvpSummary = {
      confirmedCount: 2,
      waitlistCount: 0,
      capacity: 30,
      confirmedAvatars: [
        { id: 'u1', displayName: 'Alice', avatarUrl: null },
        { id: 'u2', displayName: 'Bruno', avatarUrl: null },
      ],
    };
    render(<RsvpStatus summary={summary} isAdmin />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('shows "+N" overflow when confirmedCount > confirmedAvatars.length', () => {
    const summary: RsvpSummary = {
      confirmedCount: 10,
      waitlistCount: 0,
      capacity: 30,
      confirmedAvatars: [
        { id: 'u1', displayName: 'Alice', avatarUrl: null },
      ],
    };
    render(<RsvpStatus summary={summary} isAdmin />);
    expect(screen.getByText('+9')).toBeInTheDocument();
  });

  it('shows progress bar only when capacity is set', () => {
    const withCapacity: RsvpSummary = {
      confirmedCount: 5,
      waitlistCount: 0,
      capacity: 30,
      confirmedAvatars: [],
    };
    const { container: c1 } = render(<RsvpStatus summary={withCapacity} isAdmin />);
    // Progress bar has inline width style
    expect(c1.querySelector('[style*="width"]')).toBeTruthy();

    const withoutCapacity: RsvpSummary = {
      confirmedCount: 5,
      waitlistCount: 0,
      capacity: null,
      confirmedAvatars: [],
    };
    const { container: c2 } = render(<RsvpStatus summary={withoutCapacity} isAdmin />);
    expect(c2.querySelector('[style*="width"]')).toBeFalsy();
  });
});
