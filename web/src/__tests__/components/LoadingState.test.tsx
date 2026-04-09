import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingState, SkeletonPulse } from '@/components/common/LoadingState';

describe('LoadingState', () => {
  it('renders skeleton with data-testid="loading-skeleton"', () => {
    render(<LoadingState />);
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  it('contains animated pulse elements', () => {
    const { container } = render(<LoadingState />);
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });
});

describe('SkeletonPulse', () => {
  it('renders with animate-pulse class', () => {
    const { container } = render(<SkeletonPulse />);
    expect(container.firstChild).toHaveClass('animate-pulse');
  });

  it('applies additional className', () => {
    const { container } = render(<SkeletonPulse className="w-48 h-48" />);
    expect(container.firstChild).toHaveClass('w-48', 'h-48');
  });
});
