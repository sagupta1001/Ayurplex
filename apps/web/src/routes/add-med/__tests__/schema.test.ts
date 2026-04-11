import { describe, expect, it } from 'vitest';
import {
  nameStepSchema,
  dosageStepSchema,
  mealStepSchema,
  scheduleStepSchema,
  roomStepSchema,
  dateRangeStepSchema,
  addMedFormSchema,
} from '../schema';

describe('Add Med schemas', () => {
  it('nameStepSchema requires a non-empty name', () => {
    expect(nameStepSchema.safeParse({ name: 'Metformin' }).success).toBe(true);
    expect(nameStepSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('dosageStepSchema requires positive amount and allowed form', () => {
    expect(
      dosageStepSchema.safeParse({
        dosage_amount: 500,
        dosage_unit: 'mg',
        form: 'tablet',
        instructions: 'with food',
      }).success,
    ).toBe(true);
    expect(
      dosageStepSchema.safeParse({
        dosage_amount: 0,
        dosage_unit: 'mg',
        form: 'tablet',
        instructions: null,
      }).success,
    ).toBe(false);
    expect(
      dosageStepSchema.safeParse({
        dosage_amount: 10,
        dosage_unit: 'mg',
        form: 'gummy',
        instructions: null,
      }).success,
    ).toBe(false);
  });

  it('mealStepSchema accepts the 4 meal_relationship values', () => {
    for (const m of ['before', 'with', 'after', 'any'] as const) {
      expect(mealStepSchema.safeParse({ meal_relationship: m }).success).toBe(true);
    }
    expect(mealStepSchema.safeParse({ meal_relationship: 'later' }).success).toBe(false);
  });

  it('scheduleStepSchema requires at least one window with end >= start', () => {
    expect(
      scheduleStepSchema.safeParse({
        frequency: 'daily',
        times_of_day: [{ window_start: '08:00', window_end: '10:00' }],
        days_of_week: [1, 2, 3, 4, 5],
      }).success,
    ).toBe(true);
    expect(
      scheduleStepSchema.safeParse({
        frequency: 'daily',
        times_of_day: [],
        days_of_week: [1],
      }).success,
    ).toBe(false);
    expect(
      scheduleStepSchema.safeParse({
        frequency: 'daily',
        times_of_day: [{ window_start: '10:00', window_end: '08:00' }],
        days_of_week: [1],
      }).success,
    ).toBe(false);
  });

  it('roomStepSchema allows null room', () => {
    expect(roomStepSchema.safeParse({ preferred_room_id: null }).success).toBe(true);
    // valid uuid
    expect(
      roomStepSchema.safeParse({ preferred_room_id: '550e8400-e29b-41d4-a716-446655440000' })
        .success,
    ).toBe(true);
  });

  it('dateRangeStepSchema requires start_date and allows null end', () => {
    expect(
      dateRangeStepSchema.safeParse({
        start_date: '2026-04-11',
        end_date: null,
      }).success,
    ).toBe(true);
    expect(
      dateRangeStepSchema.safeParse({
        start_date: '2026-04-11',
        end_date: '2026-04-10',
      }).success,
    ).toBe(false);
  });

  it('addMedFormSchema parses the full payload', () => {
    const parsed = addMedFormSchema.parse({
      name: 'Metformin',
      dosage_amount: 500,
      dosage_unit: 'mg',
      form: 'tablet',
      instructions: 'with food',
      meal_relationship: 'with',
      frequency: 'daily',
      times_of_day: [{ window_start: '08:00', window_end: '10:00' }],
      days_of_week: [1, 2, 3, 4, 5],
      preferred_room_id: null,
      start_date: '2026-04-11',
      end_date: null,
    });
    expect(parsed.name).toBe('Metformin');
  });
});
