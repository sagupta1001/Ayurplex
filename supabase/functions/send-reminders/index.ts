// supabase/functions/send-reminders/index.ts
// Deno Edge Function: queries doses due in the next 5 minutes and sends
// Web Push notifications using the web-push npm library via npm: specifier.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@ayurplex.app';

// Configure VAPID details once at startup
// The keys are base64url-encoded raw bytes — web-push expects them in this format.
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// --- Main handler ---

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000);

    // Query pending doses in the window [now-30min, now+5min] to catch:
    // - doses due right now
    // - recently-due doses not yet taken
    // - upcoming doses in the next 5 minutes
    const { data: doses, error: dosesError } = await supabase
      .from('scheduled_doses')
      .select(`
        id,
        user_id,
        scheduled_for,
        medications!inner (name, dosage_amount, dosage_unit)
      `)
      .eq('status', 'pending')
      .gte('scheduled_for', thirtyMinutesAgo.toISOString())
      .lt('scheduled_for', fiveMinutesLater.toISOString());

    if (dosesError) {
      console.error('Dose query error:', dosesError);
      return new Response(JSON.stringify({ error: dosesError.message }), { status: 500 });
    }

    if (!doses || doses.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No doses due' }), { status: 200 });
    }

    // Get unique user IDs from due doses
    const userIds = [...new Set(doses.map((d: { user_id: string }) => d.user_id))];

    // Fetch push subscriptions for those users
    const { data: subs, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', userIds);

    if (subsError) {
      console.error('Subscription query error:', subsError);
      return new Response(JSON.stringify({ error: subsError.message }), { status: 500 });
    }

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions' }), { status: 200 });
    }

    // Group subscriptions by user_id
    const subsByUser = new Map<string, Array<{ endpoint: string; p256dh: string; auth: string }>>();
    for (const sub of subs) {
      const list = subsByUser.get(sub.user_id) ?? [];
      list.push({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth });
      subsByUser.set(sub.user_id, list);
    }

    // Send notifications
    let sent = 0;
    for (const dose of doses) {
      const userSubs = subsByUser.get(dose.user_id);
      if (!userSubs) continue;

      const med = (dose as Record<string, unknown>).medications as {
        name: string;
        dosage_amount: number;
        dosage_unit: string;
      };

      const payload = JSON.stringify({
        title: 'Ayurplex Reminder',
        body: `Time to take ${med.name} ${med.dosage_amount}${med.dosage_unit}`,
        tag: `dose-${dose.id}`,
        data: { doseId: dose.id },
      });

      for (const sub of userSubs) {
        try {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          };

          await webpush.sendNotification(pushSubscription, payload, { TTL: 86400 });
          sent++;
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 410 || status === 404) {
            // Subscription expired — clean up
            console.log(`Removing expired subscription: ${sub.endpoint}`);
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          } else {
            console.error(`Push failed for ${sub.endpoint}:`, err);
          }
        }
      }
    }

    return new Response(JSON.stringify({ sent, total_doses: doses.length }), { status: 200 });
  } catch (err) {
    console.error('send-reminders error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
