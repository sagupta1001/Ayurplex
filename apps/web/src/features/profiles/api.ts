import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Not signed in');
  return data.user.id;
}

export async function getProfile(): Promise<ProfileRow | null> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as ProfileRow | null;
}

export async function updateProfile(partial: ProfileUpdate): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase.from('profiles').update(partial).eq('user_id', userId);
  if (error) throw error;
}
