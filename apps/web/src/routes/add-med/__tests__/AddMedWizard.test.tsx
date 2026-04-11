import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AddMedWizard } from '../AddMedWizard';

vi.mock('../../../features/rooms/api', () => ({
  listRooms: vi.fn(async () => []),
  createRoom: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function renderWizard(props: { onSubmit?: (d: unknown) => void; onClose?: () => void } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AddMedWizard
        onSubmit={props.onSubmit ?? (() => undefined)}
        onClose={props.onClose ?? (() => undefined)}
      />
    </QueryClientProvider>,
  );
}

describe('AddMedWizard', () => {
  it('walks through the 7 steps and calls onSubmit with combined data', async () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    renderWizard({ onSubmit, onClose });

    // Step 1: name
    fireEvent.change(screen.getByLabelText(/medication name/i), {
      target: { value: 'Metformin' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 2: dosage
    await waitFor(() => expect(screen.getByLabelText(/amount/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText(/unit/i), { target: { value: 'mg' } });
    fireEvent.change(screen.getByLabelText(/^form$/i), { target: { value: 'tablet' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 3: meal
    await waitFor(() => expect(screen.getByLabelText(/with meal/i)).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/with meal/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 4: schedule
    fireEvent.change(screen.getByLabelText(/window start/i), {
      target: { value: '08:00' },
    });
    fireEvent.change(screen.getByLabelText(/window end/i), {
      target: { value: '10:00' },
    });
    fireEvent.click(screen.getByLabelText(/monday/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 5: room (skip — no rooms, wait for empty-list state to settle)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 6: date range
    fireEvent.change(screen.getByLabelText(/start date/i), {
      target: { value: '2026-04-11' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 7: review
    expect(screen.getByText(/review/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /save medication/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const firstCall = onSubmit.mock.calls[0];
    if (!firstCall) throw new Error('onSubmit not called');
    const payload = firstCall[0] as Record<string, unknown>;
    expect(payload.name).toBe('Metformin');
    expect(payload.dosage_amount).toBe(500);
    expect(payload.meal_relationship).toBe('with');
    expect(payload.times_of_day).toEqual([{ window_start: '08:00', window_end: '10:00' }]);
    expect(payload.days_of_week).toEqual([1]);
    expect(payload.start_date).toBe('2026-04-11');
  });

  it('Back button returns to the previous step', async () => {
    renderWizard();
    fireEvent.change(screen.getByLabelText(/medication name/i), {
      target: { value: 'Metformin' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => expect(screen.getByLabelText(/amount/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByLabelText(/medication name/i)).toBeInTheDocument();
  });
});
