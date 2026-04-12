import type { Prescription, PrescriptionStatus, VisionParsed } from '@ayurplex/shared';
import { supabase } from '@/lib/supabase';

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}

/** Upload a prescription image to Supabase Storage. */
export async function uploadPrescriptionImage(
  file: File,
): Promise<{ storagePath: string }> {
  const userId = await requireUserId();
  const ext = file.name.split('.').pop() ?? 'jpg';
  const storagePath = `${userId}/prescriptions/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from('prescriptions')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) throw error;
  return { storagePath };
}

/** Insert a prescription row in the database. */
export async function createPrescription(
  storagePath: string,
): Promise<Prescription> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('prescriptions')
    .insert({
      user_id: userId,
      storage_path: storagePath,
      status: 'pending_review',
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as Prescription;
}

/** Call the parse-prescription edge function. */
export async function parsePrescription(
  prescriptionId: string,
): Promise<VisionParsed> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Not authenticated');

  const response = await supabase.functions.invoke('parse-prescription', {
    body: { prescription_id: prescriptionId },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.error) throw response.error;
  return response.data as VisionParsed;
}

/** Fetch a single prescription by ID. */
export async function getPrescription(id: string): Promise<Prescription> {
  const { data, error } = await supabase
    .from('prescriptions')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Prescription;
}

/** Update prescription status. */
export async function updatePrescriptionStatus(
  id: string,
  status: PrescriptionStatus,
): Promise<void> {
  const { error } = await supabase
    .from('prescriptions')
    .update({ status })
    .eq('id', id);

  if (error) throw error;
}
