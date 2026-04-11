import type { Medication, MedicationSchedule, MedicationScheduleInput } from '@ayurplex/shared';
import { supabase } from '../../lib/supabase';
import type { Json } from '../../types/database';
import { materializeDoses, type MaterializeDosesContext } from './materializeDoses';

export interface CreateScheduleOptions {
  timezone: string;
  startDate?: string;
  days?: number;
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
