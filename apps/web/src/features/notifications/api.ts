import { supabase } from '@/lib/supabase';
import type { PushSubscriptionInsert, PushSubscriptionRow } from '@ayurplex/shared';

export async function saveSubscription(sub: PushSubscriptionInsert): Promise<PushSubscriptionRow> {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert(sub, { onConflict: 'endpoint' })
    .select()
    .single();
  if (error) throw error;
  return data as PushSubscriptionRow;
}

export async function deleteSubscription(endpoint: string): Promise<void> {
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint);
  if (error) throw error;
}

export async function getSubscription(userId: string): Promise<PushSubscriptionRow | null> {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as PushSubscriptionRow | null;
}
