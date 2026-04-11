import * as React from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useMedications } from '../useMedications';

vi.mock('../api', () => ({
  listActiveMedications: vi.fn(),
  createMedication: vi.fn(),
  deactivateMedication: vi.fn(),
}));

import { listActiveMedications } from '../api';

function makeWrapper(): ({ children }: { children: ReactNode }) => React.ReactElement {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useMedications', () => {
  it('returns an empty list while loading, then the fetched rows', async () => {
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

    const { result } = renderHook(() => useMedications(), { wrapper: makeWrapper() });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.medications).toEqual([]);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.medications).toHaveLength(1);
    expect(result.current.medications[0].name).toBe('Metformin');
  });
});
