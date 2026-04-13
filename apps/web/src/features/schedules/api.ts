import type { Medication, MedicationSchedule, MedicationScheduleInput } from '@ayurplex/shared';
import { supabase } from '../../lib/supabase';
import type { Json } from '../../types/database';
import { materializeDoses, type MaterializeDosesContext } from './materializeDoses';

export interface CreateScheduleOptions {
  timezone: string;
  startDate?: string;
  days?: number;
}

/** Fetch the schedule for a given medication, or null if none exists. */
export async function getScheduleByMedicationId(medicationId: string): Promise<MedicationSchedule | null> {
  const { data, error } = await supabase
    .from('medication_schedules')
    .select('*')
    .eq('medication_id', medicationId)
    .maybeSingle();
  if (error) throw error;
  return data as MedicationSchedule | null;
}

/** Update an existing schedule, replace future pending doses, and return the updated schedule. */
export async function updateSchedule(
  scheduleId: string,
  medication: Medication,
  input: MedicationScheduleInput,
  options: CreateScheduleOptions,
): Promise<MedicationSchedule> {
  const { data: scheduleRow, error: scheduleError } = await supabase
    .from('medication_schedules')
    .update({
      frequency: input.frequency,
      times_of_day: input.times_of_day as unknown as Json,
      days_of_week: input.days_of_week,
      preferred_room_id: input.preferred_room_id,
    })
    .eq('id', scheduleId)
    .select('*')
    .single();

  if (scheduleError) throw scheduleError;
  const schedule = scheduleRow as unknown as MedicationSchedule;

  const { error: deleteError } = await supabase
    .from('scheduled_doses')
    .delete()
    .eq('schedule_id', scheduleId)
    .eq('status', 'pending')
    .gte('scheduled_for', new Date().toISOString());

  if (deleteError) throw deleteError;

  const today = new Date().toISOString().slice(0, 10);
  const ctx: MaterializeDosesContext = {
    userId: medication.user_id,
    medicationId: medication.id,
    scheduleId: schedule.id,
    timezone: options.timezone,
    startDate: options.startDate ?? today,
    days: options.days ?? 7,
  };

  const doses = materializeDoses(input, ctx);

  const { error: dosesError } = await supabase.from('scheduled_doses').insert(doses).select('id');

  if (dosesError) throw dosesError;

  return schedule;
}

export async function createSchedule(
  medication: Medication,
  input: MedicationScheduleInput,
  options: CreateScheduleOptions,
): Promise<MedicationSchedule> {
  const { data: scheduleRow, error: scheduleError } = await supabase
    .from('medication_schedules')
    .insert({
      medication_id: medication.id,
      user_id: medication.user_id,
      frequency: input.frequency,
      times_of_day: input.times_of_day as unknown as Json,
      days_of_week: input.days_of_week,
      preferred_room_id: input.preferred_room_id,
    })
    .select('*')
    .single();

  if (scheduleError) throw scheduleError;
  const schedule = scheduleRow as unknown as MedicationSchedule;

  const ctx: MaterializeDosesContext = {
    userId: medication.user_id,
    medicationId: medication.id,
    scheduleId: schedule.id,
    timezone: options.timezone,
    startDate: options.startDate ?? medication.start_date,
    days: options.days ?? 7,
  };

  const doses = materializeDoses(input, ctx);

  const { error: dosesError } = await supabase
    .from('scheduled_doses')
    .insert(doses)
    .select('id');

  if (dosesError) {
    await supabase.from('medication_schedules').delete().eq('id', schedule.id);
    throw dosesError;
  }

  return schedule;
}
