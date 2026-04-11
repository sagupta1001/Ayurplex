import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DateRangeStep } from '../DateRangeStep';

describe('DateRangeStep', () => {
  it('emits start_date and null end_date by default', () => {
    const onNext = vi.fn();
    render(<DateRangeStep data={{}} onNext={onNext} onBack={() => undefined} />);
    fireEvent.change(screen.getByLabelText(/start date/i), {
      target: { value: '2026-04-11' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onNext).toHaveBeenCalledWith({
      start_date: '2026-04-11',
      end_date: null,
    });
  });

  it('shows an error when end_date precedes start_date', () => {
    const onNext = vi.fn();
    render(<DateRangeStep data={{}} onNext={onNext} onBack={() => undefined} />);
    fireEvent.change(screen.getByLabelText(/start date/i), {
      target: { value: '2026-04-11' },
    });
    fireEvent.change(screen.getByLabelText(/end date/i), {
      target: { value: '2026-04-10' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/on or after/i)).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('shows an error when start date is empty', () => {
    const onNext = vi.fn();
    render(<DateRangeStep data={{}} onNext={onNext} onBack={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/start date is required/i)).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });
});
