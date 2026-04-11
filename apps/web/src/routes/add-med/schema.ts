import { z } from 'zod';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const nameStepSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
});

export const dosageStepSchema = z.object({
  dosage_amount: z.number().positive('Must be greater than 0'),
  dosage_unit: z.string().min(1).max(20),
  form: z.enum(['tablet', 'capsule', 'liquid']),
  instructions: z.string().max(500).nullable(),
});

export const mealStepSchema = z.object({
  meal_relationship: z.enum(['before', 'with', 'after', 'any']),
});

const timeWindowSchema = z
  .object({
    window_start: z.string().regex(TIME_RE, 'Use HH:MM 24h format'),
    window_end: z.string().regex(TIME_RE, 'Use HH:MM 24h format'),
  })
  .refine((w) => w.window_end >= w.window_start, {
    message: 'End must be after start',
    path: ['window_end'],
  });

export const scheduleStepSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'as_needed']),
  times_of_day: z.array(timeWindowSchema).min(1, 'Add at least one time window'),
  days_of_week: z
    .array(
      z.union([
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
        z.literal(5),
        z.literal(6),
        z.literal(7),
      ]),
    )
    .min(1, 'Select at least one day'),
});

export const roomStepSchema = z.object({
  preferred_room_id: z.string().uuid().nullable(),
});

export const dateRangeStepSchema = z
  .object({
    start_date: z.string().regex(ISO_DATE_RE, 'Use YYYY-MM-DD'),
    end_date: z.string().regex(ISO_DATE_RE).nullable(),
  })
  .refine((v) => v.end_date === null || v.end_date >= v.start_date, {
    message: 'End date must be on or after start date',
    path: ['end_date'],
  });

export const addMedFormSchema = z.object({
  name: z.string().min(1),
  dosage_amount: z.number().positive(),
  dosage_unit: z.string().min(1),
  form: z.enum(['tablet', 'capsule', 'liquid']),
  instructions: z.string().nullable(),
  meal_relationship: z.enum(['before', 'with', 'after', 'any']),
  frequency: z.enum(['daily', 'weekly', 'as_needed']),
  times_of_day: z.array(timeWindowSchema).min(1),
  days_of_week: z
    .array(
      z.union([
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
        z.literal(5),
        z.literal(6),
        z.literal(7),
      ]),
    )
    .min(1),
  preferred_room_id: z.string().uuid().nullable(),
  start_date: z.string().regex(ISO_DATE_RE),
  end_date: z.string().regex(ISO_DATE_RE).nullable(),
});

export type AddMedFormData = z.infer<typeof addMedFormSchema>;
