import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ZineFrame from '@/components/common/ZineFrame';

describe('ZineFrame', () => {
  it('renders children', () => {
    render(<ZineFrame><span>hello</span></ZineFrame>);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('applies mint bg class by default', () => {
    const { container } = render(<ZineFrame><span>content</span></ZineFrame>);
    // The inner div (second child after the svg) should have the mint bg class
    const frame = container.querySelector('div[class*="bg-zine-mint"]');
    expect(frame).toBeInTheDocument();
  });

  it('applies specified bg class when bg="periwinkle"', () => {
    const { container } = render(<ZineFrame bg="periwinkle"><span>content</span></ZineFrame>);
    const frame = container.querySelector('div[class*="bg-zine-periwinkle"]');
    expect(frame).toBeInTheDocument();
  });

  it('applies border color class', () => {
    const { container } = render(
      <ZineFrame borderColor="burntYellow"><span>content</span></ZineFrame>,
    );
    const frame = container.querySelector('div[class*="border-zine-burntYellow"]');
    expect(frame).toBeInTheDocument();
  });
});
