import type { ReactNode } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AddMedRoute } from '../index';

vi.mock('@/features/medications/api', () => ({
  listActiveMedications: vi.fn(async () => []),
  createMedication: vi.fn(async (input: Record<string, unknown>) => ({
    id: 'med-new',
    user_id: 'user-1',
    active: true,
    created_at: '',
    updated_at: '',
    prescription_id: null,
    ...input,
  })),
  deactivateMedication: vi.fn(),
  getMedicationById: vi.fn(),
}));

vi.mock('@/features/schedules/api', () => ({
  createSchedule: vi.fn(async () => ({ id: 'sch-new' })),
}));

vi.mock('@/features/rooms/api', () => ({
  listRooms: vi.fn(async () => []),
  createRoom: vi.fn(),
}));

vi.mock('@/features/profiles/useProfile', () => ({
  useProfile: () => ({
    data: { display_name: 'Test', timezone: 'America/Toronto' },
    isLoading: false,
  }),
}));

import { createMedication } from '@/features/medications/api';
import { createSchedule } from '@/features/schedules/api';

function wrap(children: ReactNode): ReactNode {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <MemoryRouter initialEntries={['/add-med']}>
      <QueryClientProvider client={client}>
        <Routes>
          <Route path="/" element={<div>home</div>} />
          <Route path="/add-med" element={children} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AddMedRoute', () => {
  it('saves by calling createMedication then createSchedule', async () => {
    render(wrap(<AddMedRoute />));

    // Step 1: name
    fireEvent.change(screen.getByLabelText(/medication name/i), {
      target: { value: 'Metformin' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 2: dosage
    await waitFor(() => expect(screen.getByLabelText(/amount/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText(/unit/i), { target: { value: 'mg' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 3: meal
    await waitFor(() => expect(screen.getByLabelText(/with meal/i)).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/with meal/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 4: schedule
    fireEvent.change(screen.getByLabelText(/window start/i), { target: { value: '08:00' } });
    fireEvent.change(screen.getByLabelText(/window end/i), { target: { value: '10:00' } });
    fireEvent.click(screen.getByLabelText(/^monday$/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 5: room (skip)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 6: dates
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-04-11' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 7: review
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /save medication/i })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /save medication/i }));

    await waitFor(() => expect(createMedication).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(createSchedule).toHaveBeenCalledTimes(1));
  });
});
