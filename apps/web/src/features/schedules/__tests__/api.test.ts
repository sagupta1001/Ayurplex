import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Medication, MedicationScheduleInput, MedicationSchedule } from '@ayurplex/shared';
import { createSchedule } from '../api';
import { supabase } from '../../../lib/supabase';

interface MockChain {
  insert: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
}

vi.mock('../../../lib/supabase', () => {
  const schedulesChain: MockChain = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
  };
  const dosesChain: MockChain = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn(),
    single: vi.fn(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
  };
  return {
    supabase: {
      from: vi.fn((table: string) =>
        table === 'medication_schedules' ? schedulesChain : dosesChain,
      ),
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: 'user-1' } },
          error: null,
        })),
      },
      __schedulesChain: schedulesChain,
      __dosesChain: dosesChain,
    },
  };
});

interface MockedSupabase {
  from: ReturnType<typeof vi.fn>;
  __schedulesChain: MockChain;
  __dosesChain: MockChain;
}
const mocked = supabase as unknown as MockedSupabase;

const sampleMed: Medication = {
  id: 'med-1',
  user_id: 'user-1',
  name: 'Metformin',
  dosage_amount: 500,
  dosage_unit: 'mg',
  form: 'tablet',
  instructions: null,
  meal_relationship: 'with',
  start_date: '2026-04-13',
  end_date: null,
  prescription_id: null,
  active: true,
  created_at: '2026-04-11T00:00:00Z',
  updated_at: '2026-04-11T00:00:00Z',
};

const sampleInput: MedicationScheduleInput = {
  frequency: 'daily',
  times_of_day: [{ window_start: '08:00', window_end: '10:00' }],
  days_of_week: [1, 2, 3, 4, 5, 6, 7],
  preferred_room_id: null,
};

const sampleSchedule: MedicationSchedule = {
  id: 'sch-1',
  medication_id: 'med-1',
  user_id: 'user-1',
  frequency: 'daily',
  times_of_day: sampleInput.times_of_day,
  days_of_week: sampleInput.days_of_week,
  preferred_room_id: null,
  created_at: '2026-04-11T00:00:00Z',
  updated_at: '2026-04-11T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createSchedule', () => {
  it('inserts schedule row then bulk-inserts 7 materialized doses', async () => {
    mocked.__schedulesChain.single.mockResolvedValueOnce({
      data: sampleSchedule,
      error: null,
    });
    mocked.__dosesChain.select.mockResolvedValueOnce({
      data: new Array(7).fill({}),
      error: null,
    });

    const result = await createSchedule(sampleMed, sampleInput, {
      timezone: 'America/Toronto',
      startDate: '2026-04-13',
      days: 7,
    });

    expect(supabase.from).toHaveBeenCalledWith('medication_schedules');
    expect(mocked.__schedulesChain.insert).toHaveBeenCalledWith({
      medication_id: 'med-1',
      user_id: 'user-1',
      frequency: 'daily',
      times_of_day: sampleInput.times_of_day,
      days_of_week: sampleInput.days_of_week,
      preferred_room_id: null,
    });
    expect(supabase.from).toHaveBeenCalledWith('scheduled_doses');
    const doseInsertCall = mocked.__dosesChain.insert.mock.calls[0];
    const doseInsertArg = doseInsertCall?.[0] as unknown[];
    expect(Array.isArray(doseInsertArg)).toBe(true);
    expect(doseInsertArg).toHaveLength(7);
    const firstDose = doseInsertArg[0] as { schedule_id: string };
    expect(firstDose.schedule_id).toBe('sch-1');
    expect(result).toEqual(sampleSchedule);
  });

  it('rolls back the schedule row if dose insert fails', async () => {
    mocked.__schedulesChain.single.mockResolvedValueOnce({
      data: sampleSchedule,
      error: null,
    });
    mocked.__dosesChain.select.mockResolvedValueOnce({
      data: null,
      error: { message: 'boom' },
    });

    await expect(
      createSchedule(sampleMed, sampleInput, {
        timezone: 'America/Toronto',
        startDate: '2026-04-13',
        days: 7,
      }),
    ).rejects.toThrow(/boom/);

    expect(mocked.__schedulesChain.delete).toHaveBeenCalled();
    expect(mocked.__schedulesChain.eq).toHaveBeenCalledWith('id', 'sch-1');
  });
});
