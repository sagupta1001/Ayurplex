import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReviewStep } from '../ReviewStep';

const fullData = {
  name: 'Metformin',
  dosage_amount: 500,
  dosage_unit: 'mg',
  form: 'tablet' as const,
  instructions: 'with food',
  meal_relationship: 'with' as const,
  frequency: 'daily' as const,
  times_of_day: [{ window_start: '08:00', window_end: '10:00' }],
  days_of_week: [1, 2, 3, 4, 5] as (1 | 2 | 3 | 4 | 5 | 6 | 7)[],
  preferred_room_id: null,
  start_date: '2026-04-11',
  end_date: null,
};

describe('ReviewStep', () => {
  it('renders a summary of all entered data', () => {
    render(<ReviewStep data={fullData} onSubmit={() => undefined} onBack={() => undefined} />);
    expect(screen.getByText(/metformin/i)).toBeInTheDocument();
    expect(screen.getByText(/500 mg/i)).toBeInTheDocument();
    expect(screen.getByText(/with meal/i)).toBeInTheDocument();
    expect(screen.getByText(/08:00 – 10:00/)).toBeInTheDocument();
    expect(screen.getByText(/2026-04-11/)).toBeInTheDocument();
  });

  it('invokes onSubmit when Save medication is clicked', () => {
    const onSubmit = vi.fn();
    render(<ReviewStep data={fullData} onSubmit={onSubmit} onBack={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /save medication/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
