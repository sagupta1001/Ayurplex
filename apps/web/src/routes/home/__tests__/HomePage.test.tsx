import * as React from 'react';
import type { ReactNode, ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HomePage } from '../index';

vi.mock('@/features/doses/api', () => ({
  listDueToday: vi.fn(),
  markTaken: vi.fn(),
  markSkipped: vi.fn(),
}));
vi.mock('@/features/medications/api', () => ({
  listActiveMedications: vi.fn(),
  createMedication: vi.fn(),
  deactivateMedication: vi.fn(),
  getMedicationById: vi.fn(),
}));
vi.mock('@/features/profiles/useProfile', () => ({
  useProfile: () => ({
    data: { display_name: 'Test User', timezone: 'America/Toronto' },
    isLoading: false,
    error: null,
  }),
  useUpdateProfile: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/features/auth/SignOutButton', () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));

import { listDueToday } from '@/features/doses/api';
import { listActiveMedications } from '@/features/medications/api';

function Wrap({ children }: { children: ReactNode }): ReactElement {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MemoryRouter initialEntries={['/']}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('HomePage', () => {
  it('renders greeting, StatusRing counts, DoseRow entries, and Add link', async () => {
    (listDueToday as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
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
      },
    ]);
    (listActiveMedications as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'med-1',
        user_id: 'user-1',
        name: 'Metformin',
        dosage_amount: 500,
        dosage_unit: 'mg',
        form: 'tablet',
        instructions: null,
        meal_relationship: 'with',
        start_date: '2026-04-11',
        end_date: null,
        prescription_id: null,
        active: true,
        created_at: '2026-04-11T00:00:00Z',
        updated_at: '2026-04-11T00:00:00Z',
      },
    ]);

    render(
      <Wrap>
        <HomePage />
      </Wrap>,
    );

    expect(screen.getByRole('heading', { level: 1, name: /hello, test user/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('0/1')).toBeInTheDocument());
    expect(screen.getAllByText('Metformin').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /add medication/i })).toHaveAttribute('href', '/add-med');
  });
});
