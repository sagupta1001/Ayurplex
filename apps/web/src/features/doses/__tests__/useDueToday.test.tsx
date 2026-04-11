import * as React from 'react';
import type { ReactNode, ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScheduledDose } from '@ayurplex/shared';
import { useDueToday } from '../useDueToday';

vi.mock('../api', () => ({
  listDueToday: vi.fn(),
  markTaken: vi.fn(),
  markSkipped: vi.fn(),
}));

import { listDueToday, markTaken } from '../api';

const pendingDose: ScheduledDose = {
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

function makeWrapper(): ({ children }: { children: ReactNode }) => ReactElement {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useDueToday', () => {
  it('returns fetched doses and computes taken/total counts', async () => {
    (listDueToday as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      pendingDose,
      { ...pendingDose, id: 'dose-2', status: 'taken' },
    ]);

    const { result } = renderHook(() => useDueToday({ timezone: 'America/Toronto' }), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.doses).toHaveLength(2);
    expect(result.current.takenCount).toBe(1);
    expect(result.current.totalCount).toBe(2);
  });

  it('optimistically flips status to taken on markTaken', async () => {
    (listDueToday as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([pendingDose]);
    (markTaken as unknown as ReturnType<typeof vi.fn>).mockImplementation(async () => ({
      ...pendingDose,
      status: 'taken',
    }));

    const { result } = renderHook(() => useDueToday({ timezone: 'America/Toronto' }), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.markTaken('dose-1');
    });

    expect(result.current.doses[0]?.status).toBe('taken');
    expect(result.current.takenCount).toBe(1);
  });
});
