import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Medication, MedicationInput } from '@ayurplex/shared';
import {
  listActiveMedications,
  getMedicationById,
  createMedication,
  deactivateMedication,
} from '../api';
import { supabase } from '../../../lib/supabase';

vi.mock('../../../lib/supabase', () => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
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

const sampleRow: Medication = {
  id: 'med-1',
  user_id: 'user-1',
  name: 'Metformin',
  dosage_amount: 500,
  dosage_unit: 'mg',
  form: 'tablet',
  instructions: 'with food',
  meal_relationship: 'with',
  start_date: '2026-04-11',
  end_date: null,
  prescription_id: null,
  active: true,
  created_at: '2026-04-11T00:00:00.000Z',
  updated_at: '2026-04-11T00:00:00.000Z',
};

type MockedSupabase = typeof supabase & { __chain: Record<string, ReturnType<typeof vi.fn>> };
const mocked = supabase as unknown as MockedSupabase;

beforeEach(() => {
  for (const fn of Object.values(mocked.__chain)) fn.mockClear?.();
  (supabase.from as unknown as ReturnType<typeof vi.fn>).mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('medications/api', () => {
  it('listActiveMedications returns only active rows', async () => {
    mocked.__chain.order.mockResolvedValueOnce({ data: [sampleRow], error: null });
    const result = await listActiveMedications();
    expect(supabase.from).toHaveBeenCalledWith('medications');
    expect(mocked.__chain.select).toHaveBeenCalledWith('*');
    expect(mocked.__chain.eq).toHaveBeenCalledWith('active', true);
    expect(result).toEqual([sampleRow]);
  });

  it('getMedicationById returns a single row', async () => {
    mocked.__chain.single.mockResolvedValueOnce({ data: sampleRow, error: null });
    const result = await getMedicationById('med-1');
    expect(supabase.from).toHaveBeenCalledWith('medications');
    expect(mocked.__chain.eq).toHaveBeenCalledWith('id', 'med-1');
    expect(result).toEqual(sampleRow);
  });

  it('createMedication inserts and returns the new row', async () => {
    mocked.__chain.single.mockResolvedValueOnce({ data: sampleRow, error: null });
    const input: MedicationInput = {
      name: 'Metformin',
      dosage_amount: 500,
      dosage_unit: 'mg',
      form: 'tablet',
      instructions: 'with food',
      meal_relationship: 'with',
      start_date: '2026-04-11',
      end_date: null,
    };
    const result = await createMedication(input);
    expect(mocked.__chain.insert).toHaveBeenCalledWith({
      ...input,
      user_id: 'user-1',
      active: true,
    });
    expect(result).toEqual(sampleRow);
  });

  it('deactivateMedication flips active to false', async () => {
    mocked.__chain.single.mockResolvedValueOnce({
      data: { ...sampleRow, active: false },
      error: null,
    });
    const result = await deactivateMedication('med-1');
    expect(mocked.__chain.update).toHaveBeenCalledWith({ active: false });
    expect(mocked.__chain.eq).toHaveBeenCalledWith('id', 'med-1');
    expect(result.active).toBe(false);
  });

  it('createMedication throws if there is no authenticated user', async () => {
    (supabase.auth.getUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    await expect(
      createMedication({
        name: 'X',
        dosage_amount: 1,
        dosage_unit: 'mg',
        form: 'tablet',
        instructions: null,
        meal_relationship: 'any',
        start_date: '2026-04-11',
        end_date: null,
      }),
    ).rejects.toThrow(/not authenticated/i);
  });
});
