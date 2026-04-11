import type { FullConfig } from '@playwright/test';

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

export const TEST_USER_ID = '00000000-0000-4000-8000-000000000001';
export const TEST_USER_EMAIL = 'e2e@ayurplex.test';
export const TEST_USER_NAME = 'E2E User';

async function deleteUserIfExists(): Promise<void> {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${TEST_USER_ID}`, {
    method: 'DELETE',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  }).catch(() => undefined);
}

async function createUser(): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      email_confirm: true,
      user_metadata: { full_name: TEST_USER_NAME },
      app_metadata: { provider: 'google', providers: ['google'] },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to create test user: ${res.status} ${body}`);
  }
}

// Reset profile so prior runs don't leak onboarding_complete=true
async function resetProfile(): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${TEST_USER_ID}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        home_lat: null,
        home_lng: null,
        home_radius_m: null,
        notification_prefs: {},
      }),
    },
  );
  if (!res.ok && res.status !== 404) {
    const body = await res.text();
    throw new Error(`Failed to reset profile: ${res.status} ${body}`);
  }
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  await deleteUserIfExists();
  await createUser();
  await resetProfile();
}
