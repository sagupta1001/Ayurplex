/**
 * Seed a local dev user for signInWithPassword. Run via:
 *   pnpm --filter @ayurplex/web seed:dev
 *
 * This is ONLY for local development. Never run against staging/prod.
 */
const SUPABASE_URL =
  process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const DEV_USER_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-000000000001';
const DEV_USER_EMAIL = 'dev@ayurplex.test';
const DEV_USER_PASSWORD = 'dev-password-123';
const DEV_USER_NAME = 'Dev User';

await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${DEV_USER_ID}`, {
  method: 'DELETE',
  headers: {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  },
}).catch(() => undefined);

const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
  method: 'POST',
  headers: {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    id: DEV_USER_ID,
    email: DEV_USER_EMAIL,
    password: DEV_USER_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: DEV_USER_NAME },
  }),
});

if (!res.ok) {
  const body = await res.text();
  console.error(`Failed: ${res.status} ${body}`);
  process.exit(1);
}

console.log(`✅ Dev user seeded: ${DEV_USER_EMAIL} / ${DEV_USER_PASSWORD}`);
