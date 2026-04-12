# Spec: Web Push Notifications for Medication Reminders

## Goal

Deliver browser push notifications for upcoming medication doses even when the Ayurplex tab is closed. Minimal viable path: Service Worker + VAPID Web Push + Supabase Edge Function cron.

## Architecture

```
Browser (closed tab)          Supabase
  |                             |
  |  SW registered at /sw.js    |
  |  PushSubscription saved --> | push_subscriptions table
  |                             |
  |                             | [cron: every 5 min]
  |                             | Edge Function: send-reminders
  |                             |   1. Query scheduled_doses due in next 5 min
  |                             |      JOIN medications (name, dosage)
  |                             |      JOIN push_subscriptions (endpoint, keys)
  |                             |   2. For each: sign VAPID JWT, POST to push endpoint
  |                             |
  | <--- HTTP/2 Push --------- | Push service (browser vendor)
  |                             |
  | SW push event -> showNotification("Time to take Aspirin 500mg")
```

## Data Model

```sql
-- 0005_push_subscriptions.sql
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

-- RLS: users can only read/write their own subscriptions
-- service_role bypasses RLS for the edge function
```

## User Flow

1. Home page shows a bell icon button ("Enable reminders")
2. Click -> browser permission prompt (`Notification.requestPermission()`)
3. If granted -> `pushManager.subscribe({ applicationServerKey: VAPID_PUBLIC_KEY })` -> save subscription JSON to `push_subscriptions`
4. Bell icon toggles to filled state; click again to unsubscribe (deletes row)
5. Edge function cron fires every 5 min, sends push for doses due in the window
6. Service Worker receives `push` event, calls `showNotification` with med name/dosage

## Security

- VAPID private key stored as Supabase Edge Function secret (never exposed to client)
- `push_subscriptions` RLS: `auth.uid() = user_id` for all operations
- Edge function uses `service_role` key to bypass RLS for cross-user dose queries
- Subscription endpoint is per-browser; user cannot push to other users' endpoints
- HTTPS required for Service Workers (enforced by browsers)

## Testing Approach

- **Unit:** `usePushSubscription` hook tested with mocked `navigator.serviceWorker` and `PushManager`
- **Integration:** Edge function tested via `curl` against local Supabase with seeded data
- **E2E:** Playwright cannot intercept real push events; verify subscription flow (permission grant, DB row created) and edge function HTTP response
- **Manual:** Full loop -- add med, enable notifications, wait for cron window, receive push
