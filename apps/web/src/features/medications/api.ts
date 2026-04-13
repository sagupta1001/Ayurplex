import type { Medication, MedicationInput } from '@ayurplex/shared';
import { supabase } from '../../lib/supabase';

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}

/** List all active medications for the current user, newest first. */
export async function listActiveMedications(): Promise<Medication[]> {
  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Medication[];
}

/** Get a single medication by id (RLS ensures it belongs to the current user). */
export async function getMedicationById(id: string): Promise<Medication> {
  const { data, error } = await supabase.from('medications').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Medication;
}

/** Insert a medication owned by the current user and return the new row. */
export async function createMedication(input: MedicationInput): Promise<Medication> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('medications')
    .insert({ ...input, user_id: userId, active: true })
    .select('*')
    .single();
  if (error) throw error;
  return data as Medication;
}

/** Flip `active` to false; RLS allows only the owning user. */
export async function deactivateMedication(id: string): Promise<Medication> {
  const { data, error } = await supabase
    .from('medications')
    .update({ active: false })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Medication;
}

/** Update fields on an existing medication and return the updated row. */
export async function updateMedication(id: string, input: Partial<MedicationInput>): Promise<Medication> {
  const { data, error } = await supabase
    .from('medications')
    .update(input)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Medication;
}

/** Hard-delete a medication; FK cascade removes schedules and doses. */
export async function deleteMedication(id: string): Promise<void> {
  const { error } = await supabase.from('medications').delete().eq('id', id);
  if (error) throw error;
}
