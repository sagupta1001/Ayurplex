import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusRing } from '../StatusRing';

describe('StatusRing', () => {
  it('renders "X/Y" and a teal progress circle', () => {
    const { container } = render(<StatusRing taken={2} total={5} />);
    expect(screen.getByText('2/5')).toBeInTheDocument();
    const progress = container.querySelector('circle[data-testid="ring-progress"]');
    expect(progress).not.toBeNull();
    expect(progress?.getAttribute('stroke')).toBe('#19AFA2');
  });

  it('uses stroke-dasharray proportional to taken/total', () => {
    const { container } = render(<StatusRing taken={1} total={4} />);
    const progress = container.querySelector('circle[data-testid="ring-progress"]');
    const dashArray = progress?.getAttribute('stroke-dasharray') ?? '';
    const parts = dashArray.split(' ').map(Number);
    const filled = parts[0] ?? 0;
    const gap = parts[1] ?? 0;
    expect(Math.abs(filled / (filled + gap) - 0.25)).toBeLessThan(0.001);
  });

  it('renders a full ring when total is 0', () => {
    render(<StatusRing taken={0} total={0} />);
    expect(screen.getByText('0/0')).toBeInTheDocument();
  });
});
