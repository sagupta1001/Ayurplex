import { describe, it, expect, expectTypeOf } from 'vitest';
import type { UserId } from './types';
import type {
  MealRelationship,
  Medication,
  MedicationSchedule,
  ScheduledDose,
  ScheduledDoseInsert,
  TimeWindow,
  DayOfWeek,
  DoseStatus,
} from './types';
import { makeUserId } from './types';

describe('UserId branded type', () => {
  it('constructs a UserId from a uuid string', () => {
    const id: UserId = makeUserId('3f4c1d84-2b0f-4c9a-8f5e-7b1b9e5b0a11');
    expect(typeof id).toBe('string');
    expect(id).toBe('3f4c1d84-2b0f-4c9a-8f5e-7b1b9e5b0a11');
  });
});

describe('Plan 3 shared domain types', () => {
  it('MealRelationship accepts the 4 spec values', () => {
    expectTypeOf<'before'>().toMatchTypeOf<MealRelationship>();
    expectTypeOf<'with'>().toMatchTypeOf<MealRelationship>();
    expectTypeOf<'after'>().toMatchTypeOf<MealRelationship>();
    expectTypeOf<'any'>().toMatchTypeOf<MealRelationship>();
  });

  it('Medication has the spec fields', () => {
    expectTypeOf<Medication['meal_relationship']>().toEqualTypeOf<MealRelationship>();
    expectTypeOf<Medication['active']>().toEqualTypeOf<boolean>();
    expectTypeOf<Medication['end_date']>().toEqualTypeOf<string | null>();
  });

  it('MedicationSchedule uses TimeWindow[] and DayOfWeek[]', () => {
    expectTypeOf<MedicationSchedule['times_of_day']>().toEqualTypeOf<TimeWindow[]>();
    expectTypeOf<MedicationSchedule['days_of_week']>().toEqualTypeOf<DayOfWeek[]>();
  });

  it('ScheduledDose status is a DoseStatus', () => {
    expectTypeOf<ScheduledDose['status']>().toEqualTypeOf<DoseStatus>();
  });

  it('ScheduledDoseInsert always carries adjustment_reason and status', () => {
    expectTypeOf<ScheduledDoseInsert['adjustment_reason']>().not.toBeNullable();
    expectTypeOf<ScheduledDoseInsert['status']>().not.toBeNullable();
  });
});
