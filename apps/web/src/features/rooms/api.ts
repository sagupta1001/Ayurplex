import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type RoomRow = Database['public']['Tables']['rooms']['Row'];

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}

/** List all rooms for the current user, ordered by name. */
export async function listRooms(): Promise<RoomRow[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface CreateRoomInput {
  name: string;
  icon?: string;
}

/** Insert a new room for the current user. `icon` defaults to 'home'. */
export async function createRoom(input: CreateRoomInput): Promise<RoomRow> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('rooms')
    .insert({
      user_id: userId,
      name: input.name,
      icon: input.icon ?? 'home',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
