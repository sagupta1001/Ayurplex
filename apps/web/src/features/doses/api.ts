import type { ScheduledDose, TakenVia } from '@ayurplex/shared';
import { supabase } from '../../lib/supabase';
import { startOfLocalDay, addDays } from '../../lib/date';

export interface ListDueTodayOptions {
  timezone: string;
  now?: Date;
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}

export async function listDueToday(options: ListDueTodayOptions): Promise<ScheduledDose[]> {
  const userId = await requireUserId();
  const now = options.now ?? new Date();
  const startLocal = startOfLocalDay(now, options.timezone);
  const endLocal = addDays(startLocal, 1);

  const { data, error } = await supabase
    .from('scheduled_doses')
    .select('*')
    .eq('user_id', userId)
    .gte('scheduled_for', startLocal.toISOString())
    .lt('scheduled_for', endLocal.toISOString())
    .order('scheduled_for', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ScheduledDose[];
}

export interface MarkTakenOptions {
  at?: Date;
  via?: TakenVia;
}

export async function markTaken(
  doseId: string,
  options: MarkTakenOptions = {},
): Promise<ScheduledDose> {
  const at = options.at ?? new Date();
  const via: TakenVia = options.via ?? 'manual';
  const { data, error } = await supabase
    .from('scheduled_doses')
    .update({
      status: 'taken',
      taken_at: at.toISOString(),
      taken_via: via,
    })
    .eq('id', doseId)
    .select('*')
    .single();
  if (error) throw error;
  return data as unknown as ScheduledDose;
}

export async function markSkipped(doseId: string): Promise<ScheduledDose> {
  const { data, error } = await supabase
    .from('scheduled_doses')
    .update({ status: 'skipped' })
    .eq('id', doseId)
    .select('*')
    .single();
  if (error) throw error;
  return data as unknown as ScheduledDose;
}
