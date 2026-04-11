import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScheduleStep } from '../steps/ScheduleStep';

describe('ScheduleStep', () => {
  it('emits times_of_day and days_of_week on submit', () => {
    const onNext = vi.fn();
    render(<ScheduleStep data={{}} onNext={onNext} onBack={() => undefined} />);

    fireEvent.change(screen.getByLabelText(/window start/i), { target: { value: '08:00' } });
    fireEvent.change(screen.getByLabelText(/window end/i), { target: { value: '10:00' } });
    fireEvent.click(screen.getByLabelText(/^monday$/i));
    fireEvent.click(screen.getByLabelText(/^wednesday$/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(onNext).toHaveBeenCalledWith({
      frequency: 'daily',
      times_of_day: [{ window_start: '08:00', window_end: '10:00' }],
      days_of_week: [1, 3],
    });
  });

  it('shows an error when no days are selected', () => {
    const onNext = vi.fn();
    render(<ScheduleStep data={{}} onNext={onNext} onBack={() => undefined} />);
    fireEvent.change(screen.getByLabelText(/window start/i), { target: { value: '08:00' } });
    fireEvent.change(screen.getByLabelText(/window end/i), { target: { value: '10:00' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/at least one day/i)).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });
});
