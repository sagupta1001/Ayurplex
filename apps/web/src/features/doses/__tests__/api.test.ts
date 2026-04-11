import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScheduledDose } from '@ayurplex/shared';
import { listDueToday, markTaken, markSkipped } from '../api';
import { supabase } from '../../../lib/supabase';

interface MockChain {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
}

vi.mock('../../../lib/supabase', () => {
  const chain: MockChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };
  return {
    supabase: {
      from: vi.fn(() => chain),
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: 'user-1' } },
          error: null,
        })),
      },
      __chain: chain,
    },
  };
});

interface MockedSupabase {
  from: ReturnType<typeof vi.fn>;
  auth: { getUser: ReturnType<typeof vi.fn> };
  __chain: MockChain;
}
const mocked = supabase as unknown as MockedSupabase;

const sampleDose: ScheduledDose = {
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('doses/api', () => {
  it('listDueToday queries scheduled_doses by UTC day range for current user', async () => {
    mocked.__chain.order.mockResolvedValueOnce({ data: [sampleDose], error: null });

    const result = await listDueToday({
      timezone: 'America/Toronto',
      now: new Date('2026-04-11T18:00:00Z'),
    });

    expect(supabase.from).toHaveBeenCalledWith('scheduled_doses');
    expect(mocked.__chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mocked.__chain.gte).toHaveBeenCalled();
    expect(mocked.__chain.lt).toHaveBeenCalled();
    expect(result).toEqual([sampleDose]);
  });

  it('markTaken updates status, taken_at, taken_via', async () => {
    mocked.__chain.single.mockResolvedValueOnce({
      data: { ...sampleDose, status: 'taken', taken_via: 'manual' },
      error: null,
    });

    const result = await markTaken('dose-1', {
      at: new Date('2026-04-11T13:05:00Z'),
      via: 'manual',
    });

    expect(mocked.__chain.update).toHaveBeenCalledWith({
      status: 'taken',
      taken_at: '2026-04-11T13:05:00.000Z',
      taken_via: 'manual',
    });
    expect(mocked.__chain.eq).toHaveBeenCalledWith('id', 'dose-1');
    expect(result.status).toBe('taken');
  });

  it('markSkipped updates status to skipped', async () => {
    mocked.__chain.single.mockResolvedValueOnce({
      data: { ...sampleDose, status: 'skipped' },
      error: null,
    });

    const result = await markSkipped('dose-1');
    expect(mocked.__chain.update).toHaveBeenCalledWith({ status: 'skipped' });
    expect(result.status).toBe('skipped');
  });
});
