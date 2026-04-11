import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ScheduledDose } from '@ayurplex/shared';
import { DoseRow } from '../DoseRow';

const pending: ScheduledDose = {
  id: 'dose-1',
  user_id: 'user-1',
  medication_id: 'med-1',
  schedule_id: 'sch-1',
  scheduled_for: '2026-04-11T13:00:00.000Z',
  adjusted_for: '2026-04-11T13:00:00.000Z',
  adjustment_reason: 'none',
  status: 'pending',
  taken_at: null,
  taken_via: null,
  created_at: '2026-04-11T00:00:00Z',
  updated_at: '2026-04-11T00:00:00Z',
};

describe('DoseRow', () => {
  it('renders med name, local time, and Mark as taken button when pending', () => {
    const onMarkTaken = vi.fn();
    render(
      <DoseRow
        dose={pending}
        medicationName="Metformin"
        timezone="America/Toronto"
        onMarkTaken={onMarkTaken}
      />,
    );
    expect(screen.getByText('Metformin')).toBeInTheDocument();
    expect(screen.getByText(/9:00/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /mark as taken/i }));
    expect(onMarkTaken).toHaveBeenCalledWith('dose-1');
  });

  it('shows a checkmark and no button when status is taken', () => {
    render(
      <DoseRow
        dose={{ ...pending, status: 'taken' }}
        medicationName="Metformin"
        timezone="America/Toronto"
        onMarkTaken={() => undefined}
      />,
    );
    expect(screen.getByLabelText(/taken/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mark as taken/i })).toBeNull();
  });
});
