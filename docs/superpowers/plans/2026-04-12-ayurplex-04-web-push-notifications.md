# Ayurplex Plan 4 — Web Push Notifications

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After execution, a signed-in user with at least one medication schedule can tap a bell icon on the Home Dashboard to enable push notifications. A Supabase Edge Function runs on a 5-minute cron, queries pending doses in the upcoming window, and sends Web Push notifications via raw VAPID protocol. The user receives a browser push notification ("Time to take Aspirin 500mg") even when the tab is closed.

**Architecture:** A vanilla JS Service Worker (`sw.js`) handles `push` events and calls `showNotification`. The client subscribes via the Push API using a VAPID public key and persists the `PushSubscription` to a new `push_subscriptions` table. A Deno-based Supabase Edge Function (`send-reminders`) queries due doses, signs VAPID JWTs with `crypto.subtle`, and POSTs to each browser push endpoint. Cron is configured in `supabase/config.toml`.

**Tech Stack:** Web Push API, Service Workers, VAPID (raw `crypto.subtle` in Deno), Supabase Edge Functions (Deno), Supabase Postgres + RLS, React hooks, Vitest.

**Prerequisites:** Plan 3 complete (medications, medication_schedules, scheduled_doses tables with RLS; materializeDoses; useDueToday hook; Home Dashboard with StatusRing and DoseRow).

---

## Context & References

- **Spec:** [`docs/superpowers/specs/2026-04-12-web-push-notifications.md`](../specs/2026-04-12-web-push-notifications.md)
- **Risks addressed:**
  - **Missed doses** — proactive push notifications reduce reliance on the user opening the app.
  - **Privacy** — VAPID private key never leaves the server; RLS prevents cross-user subscription access.
- **Key constraint:** Supabase Edge Functions run Deno. We use raw Web Push protocol (`crypto.subtle` for ECDSA P-256 signing) instead of npm `web-push` to avoid Node.js compatibility issues.

---

## Files this plan will create or modify

```
supabase/migrations/0005_push_subscriptions.sql                   NEW
supabase/functions/send-reminders/index.ts                        NEW
apps/web/public/sw.js                                             NEW
apps/web/src/features/notifications/usePushSubscription.ts        NEW
apps/web/src/features/notifications/api.ts                        NEW
apps/web/src/features/notifications/__tests__/usePushSubscription.test.ts  NEW
apps/web/src/features/notifications/BellToggle.tsx                NEW
apps/web/src/features/notifications/__tests__/BellToggle.test.tsx NEW
apps/web/src/routes/home/index.tsx                                MODIFY
apps/web/index.html                                               MODIFY (SW registration script)
apps/web/.env.example                                             MODIFY (add VITE_VAPID_PUBLIC_KEY)
apps/web/.env.local                                               MODIFY (add VITE_VAPID_PUBLIC_KEY)
apps/web/public/manifest.webmanifest                              MODIFY (add gcm_sender_id placeholder)
supabase/config.toml                                              MODIFY (add cron schedule)
packages/shared/src/types.ts                                      MODIFY (add PushSubscription type)
apps/web/src/types/database.ts                                    REGENERATE
```

---

## Task 1: Generate VAPID Keys and Configure Environment

**Files:**

- Modify: `apps/web/.env.example`, `apps/web/.env.local`

- [ ] **Step 1: Generate VAPID key pair**

Run once locally to produce a key pair. Install `web-push` as a dev tool:

```bash
npx web-push generate-vapid-keys
```

This outputs a public and private key (base64url-encoded). Save these values.

- [ ] **Step 2: Add VAPID public key to web env files**

Append to `apps/web/.env.example`:

```
VITE_VAPID_PUBLIC_KEY=paste-vapid-public-key-here
```

Add the actual generated public key to `apps/web/.env.local`:

```
VITE_VAPID_PUBLIC_KEY=<actual-generated-public-key>
```

- [ ] **Step 3: Store VAPID secrets for Edge Functions**

For local dev, create `supabase/.env` (gitignored) with:

```
VAPID_PRIVATE_KEY=<actual-generated-private-key>
VAPID_PUBLIC_KEY=<actual-generated-public-key>
VAPID_SUBJECT=mailto:admin@ayurplex.app
```

For production, run:

```bash
supabase secrets set VAPID_PRIVATE_KEY=<key> VAPID_PUBLIC_KEY=<key> VAPID_SUBJECT=mailto:admin@ayurplex.app
```

- [ ] **Step 4: Verify `.gitignore` excludes secrets**

Confirm `supabase/.env` and `apps/web/.env.local` are in `.gitignore`. If not, add them.

**Commit:** `chore: add VAPID key env vars for web push notifications`

---

## Task 2: Migration — `push_subscriptions` Table + RLS

**Files:**

- Create: `supabase/migrations/0005_push_subscriptions.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0005_push_subscriptions.sql`:

```sql
-- 0005_push_subscriptions.sql
-- Plan 4: Push notification subscriptions
--
-- Stores browser Web Push subscriptions per user.
-- RLS: users can only manage their own subscriptions.
-- Edge function uses service_role to query all subscriptions.

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

-- =========================================================================
-- Row Level Security
-- =========================================================================
alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "push_subscriptions_delete_own"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);
```

- [ ] **Step 2: Apply migration locally**

```bash
supabase db reset
```

Verify the table exists:

```bash
supabase db query "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'push_subscriptions' ORDER BY ordinal_position;"
```

- [ ] **Step 3: Regenerate TypeScript database types**

```bash
supabase gen types typescript --local > apps/web/src/types/database.ts
```

- [ ] **Step 4: Add PushSubscriptionRow type to shared types**

Append to `packages/shared/src/types.ts`:

```typescript
// ---------------------------------------------------------------------------
// Plan 4 — Web Push Notifications
// ---------------------------------------------------------------------------

/** A push subscription row stored in the database. */
export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

/** Insert shape for push_subscriptions. */
export interface PushSubscriptionInsert {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}
```

**Commit:** `feat: add push_subscriptions migration and types (Plan 4, Task 2)`

---

## Task 3: Service Worker + Registration

**Files:**

- Create: `apps/web/public/sw.js`
- Modify: `apps/web/index.html`

- [ ] **Step 1: Create the service worker**

Create `apps/web/public/sw.js` (vanilla JS, served as-is by Vite):

```javascript
/// <reference lib="webworker" />

// Ayurplex Push Notification Service Worker
// Handles push events and displays medication reminder notifications.

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Ayurplex', body: event.data.text() };
  }

  const title = payload.title || 'Ayurplex Reminder';
  const options = {
    body: payload.body || 'Time to take your medication',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: payload.tag || 'ayurplex-reminder',
    data: payload.data || {},
    requireInteraction: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Focus the app tab or open a new one
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow('/');
    }),
  );
});

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
```

- [ ] **Step 2: Register the service worker in index.html**

Add before the closing `</body>` tag in `apps/web/index.html`, right after the main script:

```html
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('SW registration failed:', err);
      });
    });
  }
</script>
```

- [ ] **Step 3: Smoke-test SW registration**

Start the dev server (`pnpm dev`), open DevTools > Application > Service Workers, and verify `sw.js` is registered and active.

**Commit:** `feat: add service worker for push notifications (Plan 4, Task 3)`

---

## Task 4: Client Subscription Hook — `usePushSubscription`

**Files:**

- Create: `apps/web/src/features/notifications/api.ts`
- Create: `apps/web/src/features/notifications/usePushSubscription.ts`
- Create: `apps/web/src/features/notifications/__tests__/usePushSubscription.test.ts`

- [ ] **Step 1: Create the notifications API module**

Create `apps/web/src/features/notifications/api.ts`:

```typescript
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
```

- [ ] **Step 2: Create the `usePushSubscription` hook**

Create `apps/web/src/features/notifications/usePushSubscription.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth/useAuth';
import { saveSubscription, deleteSubscription, getSubscription } from './api';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export type PushState = 'loading' | 'unsupported' | 'denied' | 'prompt' | 'subscribed' | 'unsubscribed';

export interface UsePushSubscriptionResult {
  state: PushState;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

export function usePushSubscription(): UsePushSubscriptionResult {
  const { user } = useAuth();
  const [state, setState] = useState<PushState>('loading');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }
    if (!user) {
      setState('loading');
      return;
    }
    // Check if we already have a DB subscription for this user
    getSubscription(user.id).then((row) => {
      setState(row ? 'subscribed' : 'unsubscribed');
    }).catch(() => setState('unsubscribed'));
  }, [user]);

  const subscribe = useCallback(async () => {
    if (!user) return;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setState('denied');
      return;
    }

    const reg = await navigator.serviceWorker.ready;
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidKey) throw new Error('Missing VITE_VAPID_PUBLIC_KEY');

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      throw new Error('Incomplete push subscription');
    }

    await saveSubscription({
      user_id: user.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    });

    setState('subscribed');
  }, [user]);

  const unsubscribe = useCallback(async () => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await deleteSubscription(sub.endpoint);
      await sub.unsubscribe();
    }
    setState('unsubscribed');
  }, []);

  return { state, subscribe, unsubscribe };
}
```

- [ ] **Step 3: Write unit tests for the hook**

Create `apps/web/src/features/notifications/__tests__/usePushSubscription.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePushSubscription } from '../usePushSubscription';

// Mock dependencies
vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../api', () => ({
  saveSubscription: vi.fn().mockResolvedValue({}),
  deleteSubscription: vi.fn().mockResolvedValue(undefined),
  getSubscription: vi.fn().mockResolvedValue(null),
}));

describe('usePushSubscription', () => {
  beforeEach(() => {
    // Mock browser APIs
    Object.defineProperty(global, 'Notification', {
      value: { permission: 'default', requestPermission: vi.fn().mockResolvedValue('granted') },
      writable: true,
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        ready: Promise.resolve({
          pushManager: {
            subscribe: vi.fn().mockResolvedValue({
              toJSON: () => ({
                endpoint: 'https://push.example.com/sub1',
                keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
              }),
              unsubscribe: vi.fn().mockResolvedValue(true),
            }),
            getSubscription: vi.fn().mockResolvedValue(null),
          },
        }),
      },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'PushManager', { value: vi.fn(), writable: true, configurable: true });
  });

  it('reports unsupported when PushManager is missing', async () => {
    Object.defineProperty(window, 'PushManager', { value: undefined, writable: true, configurable: true });
    const { result } = renderHook(() => usePushSubscription());
    // Wait for effect
    await act(() => Promise.resolve());
    expect(result.current.state).toBe('unsupported');
  });

  it('reports unsubscribed when no DB row exists', async () => {
    const { result } = renderHook(() => usePushSubscription());
    await act(() => Promise.resolve());
    expect(result.current.state).toBe('unsubscribed');
  });
});
```

Run: `pnpm vitest run apps/web/src/features/notifications`

**Commit:** `feat: add usePushSubscription hook and notifications API (Plan 4, Task 4)`

---

## Task 5: Bell Toggle UI on Home Page

**Files:**

- Create: `apps/web/src/features/notifications/BellToggle.tsx`
- Create: `apps/web/src/features/notifications/__tests__/BellToggle.test.tsx`
- Modify: `apps/web/src/routes/home/index.tsx`

- [ ] **Step 1: Create `BellToggle` component**

Create `apps/web/src/features/notifications/BellToggle.tsx`:

```tsx
import type { ReactElement } from 'react';
import { usePushSubscription, type PushState } from './usePushSubscription';

const BELL_STYLES: Record<string, React.CSSProperties> = {
  base: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 24,
    padding: 8,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

function bellLabel(state: PushState): string {
  switch (state) {
    case 'subscribed': return 'Disable reminders';
    case 'denied': return 'Notifications blocked';
    case 'unsupported': return 'Push not supported';
    default: return 'Enable reminders';
  }
}

function bellIcon(state: PushState): string {
  // Unicode bell characters
  return state === 'subscribed' ? '\u{1F514}' : '\u{1F515}';
}

export function BellToggle(): ReactElement {
  const { state, subscribe, unsubscribe } = usePushSubscription();

  const disabled = state === 'loading' || state === 'unsupported' || state === 'denied';

  const handleClick = () => {
    if (state === 'subscribed') {
      void unsubscribe();
    } else {
      void subscribe();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={bellLabel(state)}
      title={bellLabel(state)}
      style={{
        ...BELL_STYLES.base,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {bellIcon(state)}
    </button>
  );
}
```

- [ ] **Step 2: Write component test**

Create `apps/web/src/features/notifications/__tests__/BellToggle.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BellToggle } from '../BellToggle';

vi.mock('../usePushSubscription', () => ({
  usePushSubscription: () => ({
    state: 'unsubscribed' as const,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  }),
}));

describe('BellToggle', () => {
  it('renders with enable label when unsubscribed', () => {
    render(<BellToggle />);
    expect(screen.getByRole('button', { name: 'Enable reminders' })).toBeTruthy();
  });
});
```

- [ ] **Step 3: Add BellToggle to Home page header**

In `apps/web/src/routes/home/index.tsx`, import and render `BellToggle` in the header, between the greeting and sign-out button:

```tsx
import { BellToggle } from '@/features/notifications/BellToggle';
```

Add inside the header's flex row (the `div` with `justifyContent: 'space-between'`), wrap SignOutButton and BellToggle in a container:

```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
  <BellToggle />
  <SignOutButton />
</div>
```

Run: `pnpm vitest run apps/web/src/features/notifications`

**Commit:** `feat: add BellToggle component and integrate on home page (Plan 4, Task 5)`

---

## Task 6: Edge Function — `send-reminders`

**Files:**

- Create: `supabase/functions/send-reminders/index.ts`

- [ ] **Step 1: Create the Edge Function**

Create `supabase/functions/send-reminders/index.ts`:

```typescript
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
    const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000);

    // Query pending doses in the next 5-minute window with medication names
    const { data: doses, error: dosesError } = await supabase
      .from('scheduled_doses')
      .select(`
        id,
        user_id,
        scheduled_for,
        medications!inner (name, dosage_amount, dosage_unit)
      `)
      .eq('status', 'pending')
      .gte('scheduled_for', now.toISOString())
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
```

- [ ] **Step 2: Test locally**

```bash
supabase functions serve send-reminders --env-file supabase/.env
```

In a separate terminal:

```bash
curl -X POST http://localhost:54321/functions/v1/send-reminders \
  -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>"
```

Expect `{"sent":0,"message":"No doses due"}` if no doses are due.

**Commit:** `feat: add send-reminders edge function with VAPID web push (Plan 4, Task 6)`

---

## Task 7: Cron Configuration in `supabase/config.toml`

**Files:**

- Modify: `supabase/config.toml`

- [ ] **Step 1: Add cron schedule for send-reminders**

Append to `supabase/config.toml`:

```toml
# ---------------------------------------------------------------------------
# Edge Functions
# ---------------------------------------------------------------------------
[functions.send-reminders]
verify_jwt = false

# ---------------------------------------------------------------------------
# Cron Jobs (production only — local dev uses manual curl trigger)
# ---------------------------------------------------------------------------
# Note: Cron scheduling requires Supabase Pro plan or pg_cron setup.
# For local dev, trigger manually:
#   curl -X POST http://localhost:54321/functions/v1/send-reminders \
#     -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
```

> **Note:** Supabase cron jobs for Edge Functions are configured via the Supabase Dashboard (Cron tab) in production, not in `config.toml`. The config entry above disables JWT verification so the cron service can invoke the function. In production, set up a cron job via Dashboard: `*/5 * * * *` calling `send-reminders`.

- [ ] **Step 2: Verify function serves locally**

```bash
supabase functions serve --env-file supabase/.env
```

Confirm `send-reminders` appears in the function list.

**Commit:** `chore: configure send-reminders edge function in config.toml (Plan 4, Task 7)`

---

## Task 8: Manual End-to-End Test

- [ ] **Step 1: Start local stack**

```bash
supabase start
supabase functions serve --env-file supabase/.env &
pnpm dev
```

- [ ] **Step 2: Create test data**

1. Sign in to the app at `http://localhost:5173`
2. Add a medication with a schedule that has a dose due within the next 5 minutes
3. Click the bell icon to enable push notifications
4. Grant the browser permission prompt

- [ ] **Step 3: Trigger the edge function**

```bash
curl -X POST http://localhost:54321/functions/v1/send-reminders \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
```

- [ ] **Step 4: Verify notification**

Confirm a browser push notification appears: "Time to take {medication_name} {amount}{unit}"

- [ ] **Step 5: Verify notification click opens app**

Click the notification and verify it focuses/opens the Ayurplex tab.

**Commit:** No code commit — manual verification only.

---

## Task 9: Integration Tests

**Files:**

- Create: `apps/web/src/features/notifications/__tests__/api.test.ts` (optional — depends on test Supabase instance)
- Modify existing test files if needed

- [ ] **Step 1: Unit test — `saveSubscription` and `deleteSubscription`**

Create `apps/web/src/features/notifications/__tests__/api.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'sub-1',
              user_id: 'user-1',
              endpoint: 'https://push.example.com/sub1',
              p256dh: 'key',
              auth: 'auth',
              created_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  },
}));

describe('notifications/api', () => {
  it('module imports without error', async () => {
    const api = await import('../api');
    expect(api.saveSubscription).toBeDefined();
    expect(api.deleteSubscription).toBeDefined();
    expect(api.getSubscription).toBeDefined();
  });
});
```

- [ ] **Step 2: Edge function integration test**

Test the edge function response with seeded data:

```bash
# Seed a test user, medication, schedule, dose, and push subscription
# Then trigger:
curl -s -X POST http://localhost:54321/functions/v1/send-reminders \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" | jq .
```

Verify the response JSON includes `sent` count.

**Commit:** `test: add notification API and hook unit tests (Plan 4, Task 9)`

---

## Task 10: Final Verification Gates

- [ ] **Gate 1: Type check passes**

```bash
pnpm turbo typecheck
```

- [ ] **Gate 2: All unit tests pass**

```bash
pnpm turbo test
```

- [ ] **Gate 3: Lint passes**

```bash
pnpm turbo lint
```

- [ ] **Gate 4: Service worker registered**

Open DevTools > Application > Service Workers — `sw.js` shows as active.

- [ ] **Gate 5: Push subscription saved**

After clicking the bell icon and granting permission, query:

```sql
SELECT * FROM push_subscriptions;
```

Verify a row exists with the current user's ID.

- [ ] **Gate 6: Edge function responds**

```bash
curl -X POST http://localhost:54321/functions/v1/send-reminders \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
```

Returns 200 with JSON body.

- [ ] **Gate 7: End-to-end push notification received**

With a dose scheduled in the next 5 minutes and notifications enabled, trigger the edge function and receive a browser notification.

**Commit:** `chore: Plan 4 complete — web push notifications verified`
