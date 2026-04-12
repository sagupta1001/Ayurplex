// supabase/functions/send-reminders/index.ts
// Deno Edge Function: queries doses due in the next 5 minutes and sends
// Web Push notifications using raw VAPID protocol (crypto.subtle).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@ayurplex.app';

// --- VAPID / Web Push helpers (Deno-native, no npm dependency) ---

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlEncode(data: Uint8Array): string {
  let binary = '';
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function textEncode(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

async function importVapidKeys() {
  const privateKeyBytes = base64UrlDecode(VAPID_PRIVATE_KEY);
  const publicKeyBytes = base64UrlDecode(VAPID_PUBLIC_KEY);

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      d: base64UrlEncode(privateKeyBytes),
      x: base64UrlEncode(publicKeyBytes.slice(1, 33)),
      y: base64UrlEncode(publicKeyBytes.slice(33, 65)),
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  return { privateKey, publicKeyBytes };
}

async function createVapidAuthHeader(endpoint: string): Promise<{ authorization: string; cryptoKey: string }> {
  const { privateKey, publicKeyBytes } = await importVapidKeys();
  const audience = new URL(endpoint).origin;
  const expiry = Math.floor(Date.now() / 1000) + 12 * 60 * 60; // 12 hours

  const header = base64UrlEncode(textEncode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = base64UrlEncode(
    textEncode(JSON.stringify({ aud: audience, exp: expiry, sub: VAPID_SUBJECT })),
  );

  const unsignedToken = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    textEncode(unsignedToken),
  );

  // Convert DER-encoded signature to raw r||s (64 bytes)
  const sigBytes = new Uint8Array(signature);
  let r: Uint8Array, s: Uint8Array;
  if (sigBytes.length === 64) {
    r = sigBytes.slice(0, 32);
    s = sigBytes.slice(32, 64);
  } else {
    // Already raw format from crypto.subtle on most platforms
    r = sigBytes.slice(0, 32);
    s = sigBytes.slice(32, 64);
  }
  const rawSig = new Uint8Array(64);
  rawSig.set(r, 0);
  rawSig.set(s, 32);

  const token = `${unsignedToken}.${base64UrlEncode(rawSig)}`;
  return {
    authorization: `vapid t=${token}, k=${base64UrlEncode(publicKeyBytes)}`,
    cryptoKey: `p256ecdsa=${base64UrlEncode(publicKeyBytes)}`,
  };
}

// --- Encryption helpers (aes128gcm as per RFC 8291) ---

async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authSecret: string,
): Promise<{ body: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const subscriberPublicKeyBytes = base64UrlDecode(p256dhKey);
  const authSecretBytes = base64UrlDecode(authSecret);

  // Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  );

  const localPublicKeyRaw = await crypto.subtle.exportKey('raw', localKeyPair.publicKey);
  const localPublicKey = new Uint8Array(localPublicKeyRaw);

  // Import subscriber public key
  const subscriberKey = await crypto.subtle.importKey(
    'raw',
    subscriberPublicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  // ECDH shared secret
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: subscriberKey },
    localKeyPair.privateKey,
    256,
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  // Salt (16 random bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF-based key derivation per RFC 8291
  const ikm = await hkdf(authSecretBytes, sharedSecret, concatBytes(
    textEncode('WebPush: info\0'),
    subscriberPublicKeyBytes,
    localPublicKey,
  ), 32);

  const prk = await hkdf(salt, ikm, textEncode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, textEncode('Content-Encoding: nonce\0'), 12);

  // Encrypt with AES-128-GCM
  const contentKey = await crypto.subtle.importKey('raw', prk, 'AES-GCM', false, ['encrypt']);
  const padded = concatBytes(new Uint8Array([2]), textEncode(payload)); // padding delimiter
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    contentKey,
    padded,
  );

  // Build aes128gcm body: salt(16) + rs(4) + idlen(1) + keyid(65) + encrypted
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  const body = concatBytes(salt, rs, new Uint8Array([65]), localPublicKey, new Uint8Array(encrypted));

  return { body, salt, localPublicKey };
}

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

async function sendPushNotification(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: object,
): Promise<boolean> {
  try {
    const payloadStr = JSON.stringify(payload);
    const { body } = await encryptPayload(payloadStr, p256dh, auth);
    const vapidHeaders = await createVapidAuthHeader(endpoint);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        Authorization: vapidHeaders.authorization,
        TTL: '86400',
      },
      body,
    });

    if (response.status === 410 || response.status === 404) {
      // Subscription expired — clean up
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
      return false;
    }

    return response.ok;
  } catch (err) {
    console.error(`Push failed for ${endpoint}:`, err);
    return false;
  }
}

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

      const payload = {
        title: 'Ayurplex Reminder',
        body: `Time to take ${med.name} ${med.dosage_amount}${med.dosage_unit}`,
        tag: `dose-${dose.id}`,
        data: { doseId: dose.id },
      };

      for (const sub of userSubs) {
        const ok = await sendPushNotification(sub.endpoint, sub.p256dh, sub.auth, payload);
        if (ok) sent++;
      }
    }

    return new Response(JSON.stringify({ sent, total_doses: doses.length }), { status: 200 });
  } catch (err) {
    console.error('send-reminders error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
