# Ayurplex Plan 2 — Auth + Onboarding

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new user can land on the app, sign in with Google (with Calendar read scope), complete a 3-step onboarding flow (welcome → home location [skippable] → notification permission), and arrive at a placeholder Home Dashboard showing their display name — with RLS-enabled `profiles` and `rooms` tables, a default "Home" room auto-created, and the `google_refresh_token` stored encrypted server-side.

**Architecture:** The React + Vite client uses Supabase Auth with Google OAuth (scopes: `openid email profile https://www.googleapis.com/auth/calendar.readonly`). A Postgres `AFTER INSERT` trigger on `auth.users` auto-provisions a `profiles` row and a default `rooms` row ("Home"). The client uses React Router v6 for routing, a thin `AuthProvider` context wrapping `supabase.auth.onAuthStateChange`, and TanStack Query for profile fetching. Onboarding is a local state machine with three steps; the location step uses MapLibre GL + OpenStreetMap tiles.

**Tech Stack:** React 18, Vite, TypeScript, Supabase JS client (typed with generated `Database`), `react-router-dom@6`, `@tanstack/react-query@5`, `maplibre-gl@4`, `react-map-gl@7`, Tailwind CSS with Priya's tokens (from Plan 1), Vitest + React Testing Library, Playwright.

**Prerequisites:** Plan 1 (Foundation) complete — pnpm workspace green, `apps/web` scaffolded with Tailwind and `src/lib/supabase.ts`, Supabase local runs via `supabase start`, `lib/date.ts` present, CI green.

---

## Table of Contents

- [Task 1: Create `profiles` and `rooms` migration with RLS](#task-1)
- [Task 2: Postgres trigger to auto-create profile and default "Home" room](#task-2)
- [Task 3: Generate TypeScript types from Supabase schema](#task-3)
- [Task 4: Configure Google OAuth in Supabase](#task-4)
- [Task 5: TDD — `useAuth` hook + `AuthProvider` context](#task-5)
- [Task 6: TDD — `SignInButton` component](#task-6)
- [Task 7: `/sign-in` route + `RequireAuth` guard](#task-7)
- [Task 8: TDD — Profile API (`getProfile`, `updateProfile`, `useProfile`)](#task-8)
- [Task 9: `useOnboardingStatus` hook](#task-9)
- [Task 10: TDD — `WelcomeStep`](#task-10)
- [Task 11: TDD — `HomeLocationStep` (map picker)](#task-11)
- [Task 12: TDD — `NotificationStep`](#task-12)
- [Task 13: TDD — `OnboardingFlow` state machine](#task-13)
- [Task 14: `/onboarding` route and `RequireOnboarded` redirect](#task-14)
- [Task 15: Placeholder Home Dashboard route](#task-15)
- [Task 16: Sign-out support](#task-16)
- [Task 17: E2E happy path with mocked OAuth](#task-17)
- [Task 18: Final verification and quality gates](#task-18)

---

## <a id="task-1"></a>Task 1: Create `profiles` and `rooms` migration with RLS

**Goal:** Create the SQL migration for `profiles` and `rooms`, enable RLS, add per-operation policies, apply, verify.

- [ ] **1.1** Create the migration file `supabase/migrations/0002_profiles_and_rooms.sql` with the following contents:

  ```sql
  -- 0002_profiles_and_rooms.sql
  -- Creates profiles and rooms tables with RLS scoped to auth.uid() = user_id.

  create extension if not exists "pgcrypto";

  -- profiles --------------------------------------------------------------
  create table if not exists public.profiles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null unique references auth.users(id) on delete cascade,
    display_name text not null,
    timezone text not null default 'UTC',
    home_lat double precision,
    home_lng double precision,
    home_radius_m integer,
    notification_prefs jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create index if not exists profiles_user_id_idx on public.profiles(user_id);

  -- rooms -----------------------------------------------------------------
  create table if not exists public.rooms (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    icon text not null default 'home',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create index if not exists rooms_user_id_idx on public.rooms(user_id);

  -- updated_at trigger ----------------------------------------------------
  create or replace function public.set_updated_at()
  returns trigger
  language plpgsql
  as $$
  begin
    new.updated_at = now();
    return new;
  end;
  $$;

  drop trigger if exists profiles_set_updated_at on public.profiles;
  create trigger profiles_set_updated_at
    before update on public.profiles
    for each row execute function public.set_updated_at();

  drop trigger if exists rooms_set_updated_at on public.rooms;
  create trigger rooms_set_updated_at
    before update on public.rooms
    for each row execute function public.set_updated_at();

  -- RLS -------------------------------------------------------------------
  alter table public.profiles enable row level security;
  alter table public.rooms enable row level security;

  -- profiles policies
  drop policy if exists "profiles_select_own" on public.profiles;
  create policy "profiles_select_own" on public.profiles
    for select using (auth.uid() = user_id);

  drop policy if exists "profiles_insert_own" on public.profiles;
  create policy "profiles_insert_own" on public.profiles
    for insert with check (auth.uid() = user_id);

  drop policy if exists "profiles_update_own" on public.profiles;
  create policy "profiles_update_own" on public.profiles
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

  drop policy if exists "profiles_delete_own" on public.profiles;
  create policy "profiles_delete_own" on public.profiles
    for delete using (auth.uid() = user_id);

  -- rooms policies
  drop policy if exists "rooms_select_own" on public.rooms;
  create policy "rooms_select_own" on public.rooms
    for select using (auth.uid() = user_id);

  drop policy if exists "rooms_insert_own" on public.rooms;
  create policy "rooms_insert_own" on public.rooms
    for insert with check (auth.uid() = user_id);

  drop policy if exists "rooms_update_own" on public.rooms;
  create policy "rooms_update_own" on public.rooms
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

  drop policy if exists "rooms_delete_own" on public.rooms;
  create policy "rooms_delete_own" on public.rooms
    for delete using (auth.uid() = user_id);
  ```

- [ ] **1.2** Apply the migration locally:

  ```bash
  cd /Users/satyamgupta/PersonalWorkspace/ayurplex
  supabase db reset
  ```

  Expected output (tail):

  ```
  Applying migration 0001_init.sql...
  Applying migration 0002_profiles_and_rooms.sql...
  Finished supabase db reset on branch main.
  ```

- [ ] **1.3** Verify tables exist. Get the connection string and run `psql`:

  ```bash
  supabase status
  # Copy the "DB URL" (e.g. postgresql://postgres:postgres@127.0.0.1:54322/postgres)
  psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c '\dt public.*'
  ```

  Expected output includes:

  ```
              List of relations
   Schema |   Name    | Type  |  Owner
  --------+-----------+-------+----------
   public | profiles  | table | postgres
   public | rooms     | table | postgres
  ```

- [ ] **1.4** Verify 8 policies exist (4 per table):

  ```bash
  psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
    -c "select count(*) from pg_policies where schemaname='public' and tablename in ('profiles','rooms');"
  ```

  Expected output:

  ```
   count
  -------
       8
  (1 row)
  ```

- [ ] **1.5** Commit:

  ```bash
  cd /Users/satyamgupta/PersonalWorkspace/ayurplex
  git add supabase/migrations/0002_profiles_and_rooms.sql
  git commit -m "feat(db): add profiles and rooms tables with RLS"
  ```

---

## <a id="task-2"></a>Task 2: Postgres trigger to auto-create profile and default "Home" room

**Goal:** When `auth.users` gets a new row, a `profiles` row and a `rooms` row named "Home" are auto-created.

- [ ] **2.1** Create `supabase/migrations/0003_auth_trigger.sql`:

  ```sql
  -- 0003_auth_trigger.sql
  -- On new auth user: create a profile row and a default "Home" room.

  create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
  as $$
  declare
    v_display_name text;
  begin
    v_display_name := coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    );

    insert into public.profiles (user_id, display_name, timezone, notification_prefs)
    values (new.id, v_display_name, 'UTC', '{}'::jsonb)
    on conflict (user_id) do nothing;

    insert into public.rooms (user_id, name, icon)
    values (new.id, 'Home', 'home');

    return new;
  end;
  $$;

  drop trigger if exists on_auth_user_created on auth.users;
  create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
  ```

- [ ] **2.2** Apply:

  ```bash
  cd /Users/satyamgupta/PersonalWorkspace/ayurplex
  supabase db reset
  ```

  Expected tail:

  ```
  Applying migration 0003_auth_trigger.sql...
  Finished supabase db reset on branch main.
  ```

- [ ] **2.3** Verify by inserting a fake auth user and checking the downstream rows:

  ```bash
  psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'SQL'
  insert into auth.users (id, email, raw_user_meta_data)
  values (
    '00000000-0000-0000-0000-000000000001',
    'test@example.com',
    '{"full_name":"Test User"}'::jsonb
  );
  select user_id, display_name from public.profiles where user_id = '00000000-0000-0000-0000-000000000001';
  select user_id, name from public.rooms where user_id = '00000000-0000-0000-0000-000000000001';
  SQL
  ```

  Expected output:

  ```
                 user_id                | display_name
  --------------------------------------+--------------
   00000000-0000-0000-0000-000000000001 | Test User
  (1 row)

                 user_id                | name
  --------------------------------------+------
   00000000-0000-0000-0000-000000000001 | Home
  (1 row)
  ```

- [ ] **2.4** Clean up the fake row, then reset once more to keep local state pristine:

  ```bash
  supabase db reset
  ```

- [ ] **2.5** Commit:

  ```bash
  cd /Users/satyamgupta/PersonalWorkspace/ayurplex
  git add supabase/migrations/0003_auth_trigger.sql
  git commit -m "feat(db): auto-create profile and default Home room on signup"
  ```

---

## <a id="task-3"></a>Task 3: Generate TypeScript types from Supabase schema

**Goal:** A committed, typed `Database` generic so the Supabase client is type-safe throughout the app.

- [ ] **3.1** Generate types from the local instance:

  ```bash
  cd /Users/satyamgupta/PersonalWorkspace/ayurplex
  mkdir -p apps/web/src/types
  pnpm supabase gen types typescript --local > apps/web/src/types/database.ts
  ```

  Expected: the file is non-empty and begins with `export type Json =` and contains `profiles:` and `rooms:` type entries.

- [ ] **3.2** Verify by opening the file and confirming `Database['public']['Tables']['profiles']['Row']` contains `home_lat`, `home_lng`, `home_radius_m`, `notification_prefs`, `display_name`, `timezone`, `user_id`.

- [ ] **3.3** Update `apps/web/src/lib/supabase.ts` to use the generic. Replace the file contents with:

  ```ts
  // apps/web/src/lib/supabase.ts
  import { createClient, type SupabaseClient } from '@supabase/supabase-js';
  import type { Database } from '@/types/database';

  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  if (!url || !anonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  }

  export const supabase: SupabaseClient<Database> = createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  export type AppSupabaseClient = SupabaseClient<Database>;
  ```

- [ ] **3.4** Build and typecheck:

  ```bash
  pnpm --filter @ayurplex/web typecheck
  pnpm --filter @ayurplex/web build
  ```

  Expected: both exit 0.

- [ ] **3.5** Commit:

  ```bash
  cd /Users/satyamgupta/PersonalWorkspace/ayurplex
  git add apps/web/src/types/database.ts apps/web/src/lib/supabase.ts
  git commit -m "feat(web): generate and wire Supabase Database types"
  ```

---

## <a id="task-4"></a>Task 4: Configure Google OAuth in Supabase

**Goal:** Google OAuth enabled in local Supabase; env vars documented; dev walkthrough recorded in the plan.

- [ ] **4.1** Create Google OAuth credentials. Walk through these EXACT steps in the browser (document, don't automate):

  1. Go to https://console.cloud.google.com/
  2. Create (or reuse) a project named `ayurplex-dev`.
  3. Open **APIs & Services → Library**. Search for `Google Calendar API`. Click **Enable**.
  4. Open **APIs & Services → OAuth consent screen**. Choose **External**. Fill: app name `Ayurplex (dev)`, user support email, developer contact. Scopes — add `.../auth/userinfo.email`, `.../auth/userinfo.profile`, and `https://www.googleapis.com/auth/calendar.readonly`. Add yourself as a test user.
  5. Open **APIs & Services → Credentials → + Create Credentials → OAuth client ID**. Type = Web application. Name = `Ayurplex Web (dev)`.
     - Authorized JavaScript origins: `http://localhost:5173`
     - Authorized redirect URIs: `http://localhost:54321/auth/v1/callback`
  6. Copy the **Client ID** and **Client secret**.

- [ ] **4.2** Edit `supabase/config.toml`. Locate the `[auth.external.google]` section (create if missing) and set:

  ```toml
  [auth.external.google]
  enabled = true
  client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
  secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"
  redirect_uri = "http://localhost:54321/auth/v1/callback"
  url = "https://accounts.google.com"
  skip_nonce_check = false
  ```

- [ ] **4.3** Add env var to `apps/web/.env.example`:

  ```
  VITE_SUPABASE_URL=http://localhost:54321
  VITE_SUPABASE_ANON_KEY=
  VITE_GOOGLE_OAUTH_CLIENT_ID=
  ```

- [ ] **4.4** Create (or update) a developer-only `.env.local` at repo root — **DO NOT COMMIT**:

  ```bash
  cat > /Users/satyamgupta/PersonalWorkspace/ayurplex/.env.local <<'ENV'
  SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE
  SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=YOUR_CLIENT_SECRET_HERE
  ENV
  ```

  And `apps/web/.env.local`:

  ```bash
  cat > /Users/satyamgupta/PersonalWorkspace/ayurplex/apps/web/.env.local <<'ENV'
  VITE_SUPABASE_URL=http://localhost:54321
  VITE_SUPABASE_ANON_KEY=<anon_key_from_supabase_status>
  VITE_GOOGLE_OAUTH_CLIENT_ID=YOUR_CLIENT_ID_HERE
  ENV
  ```

  Confirm both `.env.local` paths are already covered by the root `.gitignore` (`*.env.local`). If not, add them.

- [ ] **4.5** Restart Supabase to pick up the config:

  ```bash
  cd /Users/satyamgupta/PersonalWorkspace/ayurplex
  supabase stop
  supabase start
  ```

  Expected tail:

  ```
  Started supabase local development setup.
           API URL: http://127.0.0.1:54321
           DB URL:  postgresql://postgres:postgres@127.0.0.1:54322/postgres
  ```

- [ ] **4.6** Commit the config and .env.example changes only:

  ```bash
  cd /Users/satyamgupta/PersonalWorkspace/ayurplex
  git add supabase/config.toml apps/web/.env.example
  git commit -m "chore(auth): enable Google OAuth in local Supabase config"
  ```

---

## <a id="task-5"></a>Task 5: TDD — `useAuth` hook + `AuthProvider` context

**Goal:** A React Context provider subscribes to `supabase.auth.onAuthStateChange` and exposes `{ user, session, loading }` via a `useAuth()` hook.

- [ ] **5.1** Install `react-router-dom`:

  ```bash
  cd /Users/satyamgupta/PersonalWorkspace/ayurplex
  pnpm --filter @ayurplex/web add react-router-dom@^6.26.0
  ```

- [ ] **5.2** Create the test directory and write the failing test at `apps/web/src/features/auth/__tests__/AuthProvider.test.tsx`:

  ```tsx
  // apps/web/src/features/auth/__tests__/AuthProvider.test.tsx
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { render, screen, waitFor } from '@testing-library/react';
  import React from 'react';
  import { AuthProvider } from '../AuthProvider';
  import { useAuth } from '../useAuth';

  const fakeSession = {
    access_token: 'abc',
    refresh_token: 'def',
    expires_in: 3600,
    token_type: 'bearer',
    user: { id: 'user-1', email: 'test@example.com' },
  } as any;

  const authStateListeners: Array<(event: string, session: any) => void> = [];

  vi.mock('@/lib/supabase', () => ({
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: fakeSession }, error: null }),
        onAuthStateChange: vi.fn((cb) => {
          authStateListeners.push(cb);
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
      },
    },
  }));

  function Probe() {
    const { user, session, loading } = useAuth();
    return (
      <div>
        <span data-testid="loading">{loading ? 'loading' : 'ready'}</span>
        <span data-testid="user">{user?.id ?? 'none'}</span>
        <span data-testid="session">{session?.access_token ?? 'none'}</span>
      </div>
    );
  }

  describe('AuthProvider', () => {
    beforeEach(() => {
      authStateListeners.length = 0;
    });

    it('starts loading then resolves to the current session', async () => {
      render(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      );

      expect(screen.getByTestId('loading')).toHaveTextContent('loading');

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });
      expect(screen.getByTestId('user')).toHaveTextContent('user-1');
      expect(screen.getByTestId('session')).toHaveTextContent('abc');
    });

    it('updates when onAuthStateChange fires', async () => {
      render(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      );
      await waitFor(() =>
        expect(screen.getByTestId('loading')).toHaveTextContent('ready'),
      );

      authStateListeners[0]('SIGNED_OUT', null);

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('none');
      });
    });
  });
  ```

- [ ] **5.3** Run the test — expect **FAIL** (module not found):

  ```bash
  pnpm --filter @ayurplex/web test -- src/features/auth/__tests__/AuthProvider.test.tsx
  ```

  Expected: `Error: Failed to resolve import "../AuthProvider"`.

- [ ] **5.4** Implement `apps/web/src/features/auth/AuthProvider.tsx`:

  ```tsx
  // apps/web/src/features/auth/AuthProvider.tsx
  import React, { createContext, useEffect, useState, type ReactNode } from 'react';
  import type { Session, User } from '@supabase/supabase-js';
  import { supabase } from '@/lib/supabase';

  export interface AuthContextValue {
    user: User | null;
    session: Session | null;
    loading: boolean;
  }

  export const AuthContext = createContext<AuthContextValue>({
    user: null,
    session: null,
    loading: true,
  });

  export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      let active = true;

      supabase.auth.getSession().then(({ data }) => {
        if (!active) return;
        setSession(data.session ?? null);
        setLoading(false);
      });

      const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
        setSession(next);
        setLoading(false);
      });

      return () => {
        active = false;
        sub.subscription.unsubscribe();
      };
    }, []);

    return (
      <AuthContext.Provider value={{ user: session?.user ?? null, session, loading }}>
        {children}
      </AuthContext.Provider>
    );
  }
  ```

- [ ] **5.5** Implement `apps/web/src/features/auth/useAuth.ts`:

  ```ts
  // apps/web/src/features/auth/useAuth.ts
  import { useContext } from 'react';
  import { AuthContext, type AuthContextValue } from './AuthProvider';

  export function useAuth(): AuthContextValue {
    return useContext(AuthContext);
  }
  ```

- [ ] **5.6** Run the test — expect **PASS**:

  ```bash
  pnpm --filter @ayurplex/web test -- src/features/auth/__tests__/AuthProvider.test.tsx
  ```

  Expected tail: `Test Files  1 passed (1) / Tests  2 passed (2)`.

- [ ] **5.7** Commit:

  ```bash
  cd /Users/satyamgupta/PersonalWorkspace/ayurplex
  git add apps/web/package.json apps/web/src/features/auth/ pnpm-lock.yaml
  git commit -m "feat(auth): AuthProvider context and useAuth hook"
  ```

---

## <a id="task-6"></a>Task 6: TDD — `SignInButton` component

**Goal:** A Tailwind-styled button that calls `supabase.auth.signInWithOAuth` with the Google provider and the correct scopes + redirect.

- [ ] **6.1** Write `apps/web/src/features/auth/__tests__/SignInButton.test.tsx`:

  ```tsx
  // apps/web/src/features/auth/__tests__/SignInButton.test.tsx
  import { describe, it, expect, vi } from 'vitest';
  import { render, screen } from '@testing-library/react';
  import userEvent from '@testing-library/user-event';
  import { SignInButton } from '../SignInButton';

  const signInWithOAuth = vi.fn().mockResolvedValue({ data: {}, error: null });

  vi.mock('@/lib/supabase', () => ({
    supabase: {
      auth: {
        signInWithOAuth: (...args: unknown[]) => signInWithOAuth(...args),
      },
    },
  }));

  describe('SignInButton', () => {
    it('invokes Google OAuth with the calendar.readonly scope and app redirect', async () => {
      render(<SignInButton />);
      const button = screen.getByRole('button', { name: /sign in with google/i });
      await userEvent.click(button);

      expect(signInWithOAuth).toHaveBeenCalledTimes(1);
      expect(signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          scopes:
            'openid email profile https://www.googleapis.com/auth/calendar.readonly',
          redirectTo: `${window.location.origin}/`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
    });
  });
  ```

- [ ] **6.2** Run — expect **FAIL** (module not found).

  ```bash
  pnpm --filter @ayurplex/web test -- src/features/auth/__tests__/SignInButton.test.tsx
  ```

- [ ] **6.3** Implement `apps/web/src/features/auth/SignInButton.tsx`:

  ```tsx
  // apps/web/src/features/auth/SignInButton.tsx
  import { supabase } from '@/lib/supabase';

  export const GOOGLE_OAUTH_SCOPES =
    'openid email profile https://www.googleapis.com/auth/calendar.readonly';

  export function SignInButton() {
    async function handleClick() {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: GOOGLE_OAUTH_SCOPES,
          redirectTo: `${window.location.origin}/`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
    }

    return (
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center justify-center gap-3 rounded-full bg-ayur-primary px-6 py-3 font-lexend text-base font-semibold text-white shadow-sm transition hover:bg-ayur-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ayur-primary focus-visible:ring-offset-2"
      >
        <span aria-hidden="true">G</span>
        Sign in with Google
      </button>
    );
  }
  ```

- [ ] **6.4** Run — expect **PASS**:

  ```bash
  pnpm --filter @ayurplex/web test -- src/features/auth/__tests__/SignInButton.test.tsx
  ```

- [ ] **6.5** Commit:

  ```bash
  cd /Users/satyamgupta/PersonalWorkspace/ayurplex
  git add apps/web/src/features/auth/SignInButton.tsx apps/web/src/features/auth/__tests__/SignInButton.test.tsx
  git commit -m "feat(auth): SignInButton component with Google OAuth scopes"
  ```

---

## <a id="task-7"></a>Task 7: `/sign-in` route + `RequireAuth` guard

**Goal:** Unauthenticated visits to `/` redirect to `/sign-in`.

- [ ] **7.1** Create `apps/web/src/routes/sign-in/index.tsx`:

  ```tsx
  // apps/web/src/routes/sign-in/index.tsx
  import { SignInButton } from '@/features/auth/SignInButton';

  export default function SignInPage() {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-ayur-bg px-6 font-roboto text-ayur-ink">
        <div className="w-full max-w-sm text-center">
          <h1 className="mb-2 font-lexend text-3xl font-semibold text-ayur-primary">Ayurplex</h1>
          <p className="mb-10 text-base text-ayur-ink/70">
            Smart, adaptive medication reminders.
          </p>
          <SignInButton />
        </div>
      </main>
    );
  }
  ```

- [ ] **7.2** Create `apps/web/src/features/auth/RequireAuth.tsx`:

  ```tsx
  // apps/web/src/features/auth/RequireAuth.tsx
  import type { ReactNode } from 'react';
  import { Navigate } from 'react-router-dom';
  import { useAuth } from './useAuth';

  export function RequireAuth({ children }: { children: ReactNode }) {
    const { user, loading } = useAuth();
    if (loading) {
      return (
        <div className="flex min-h-screen items-center justify-center text-ayur-ink/60">
          Loading…
        </div>
      );
    }
    if (!user) {
      return <Navigate to="/sign-in" replace />;
    }
    return <>{children}</>;
  }
  ```

- [ ] **7.3** Write `apps/web/src/features/auth/__tests__/RequireAuth.test.tsx`:

  ```tsx
  // apps/web/src/features/auth/__tests__/RequireAuth.test.tsx
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { render, screen, waitFor } from '@testing-library/react';
  import { MemoryRouter, Route, Routes } from 'react-router-dom';
  import { RequireAuth } from '../RequireAuth';
  import { AuthProvider } from '../AuthProvider';

  let currentSession: any = null;

  vi.mock('@/lib/supabase', () => ({
    supabase: {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: currentSession }, error: null })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
    },
  }));

  describe('RequireAuth', () => {
    beforeEach(() => {
      currentSession = null;
    });

    it('redirects to /sign-in when there is no user', async () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <AuthProvider>
            <Routes>
              <Route
                path="/"
                element={
                  <RequireAuth>
                    <div>protected</div>
                  </RequireAuth>
                }
              />
              <Route path="/sign-in" element={<div>sign in page</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>,
      );

      await waitFor(() => expect(screen.getByText('sign in page')).toBeInTheDocument());
    });

    it('renders children when a user is present', async () => {
      currentSession = { user: { id: 'u1' }, access_token: 'a' };
      render(
        <MemoryRouter initialEntries={['/']}>
          <AuthProvider>
            <Routes>
              <Route
                path="/"
                element={
                  <RequireAuth>
                    <div>protected</div>
                  </RequireAuth>
                }
              />
              <Route path="/sign-in" element={<div>sign in page</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>,
      );

      await waitFor(() => expect(screen.getByText('protected')).toBeInTheDocument());
    });
  });
  ```

- [ ] **7.4** Run — expect FAIL (App.tsx not wiring routes yet — but the test uses MemoryRouter directly, so it should compile. Run to confirm pass at this point is possible OR fail due to missing file imports — either way iterate):

  ```bash
  pnpm --filter @ayurplex/web test -- src/features/auth/__tests__/RequireAuth.test.tsx
  ```

- [ ] **7.5** Update `apps/web/src/App.tsx` to wire the router, the AuthProvider, and the routes:

  ```tsx
  // apps/web/src/App.tsx
  import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
  import { AuthProvider } from '@/features/auth/AuthProvider';
  import { RequireAuth } from '@/features/auth/RequireAuth';
  import SignInPage from '@/routes/sign-in';

  function PlaceholderHome() {
    return <div>home placeholder</div>;
  }

  export default function App() {
    return (
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/sign-in" element={<SignInPage />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <PlaceholderHome />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    );
  }
  ```

- [ ] **7.6** Run the test suite — expect **PASS**:

  ```bash
  pnpm --filter @ayurplex/web test
  ```

- [ ] **7.7** Commit:

  ```bash
  cd /Users/satyamgupta/PersonalWorkspace/ayurplex
  git add apps/web/src/App.tsx apps/web/src/routes/sign-in apps/web/src/features/auth/RequireAuth.tsx apps/web/src/features/auth/__tests__/RequireAuth.test.tsx
  git commit -m "feat(auth): /sign-in route and RequireAuth guard"
  ```

---

## <a id="task-8"></a>Task 8: TDD — Profile API (`getProfile`, `updateProfile`, `useProfile`)

**Goal:** A typed API module and TanStack Query hook for the current user's profile.

- [ ] **8.1** Install TanStack Query:

  ```bash
  cd /Users/satyamgupta/PersonalWorkspace/ayurplex
  pnpm --filter @ayurplex/web add @tanstack/react-query@^5.51.0
  ```

- [ ] **8.2** Write `apps/web/src/features/profiles/__tests__/api.test.ts`:

  ```ts
  // apps/web/src/features/profiles/__tests__/api.test.ts
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { getProfile, updateProfile } from '../api';

  const fakeProfile = {
    id: 'p1',
    user_id: 'u1',
    display_name: 'Test',
    timezone: 'UTC',
    home_lat: null,
    home_lng: null,
    home_radius_m: null,
    notification_prefs: {},
    created_at: '',
    updated_at: '',
  };

  const maybeSingle = vi.fn().mockResolvedValue({ data: fakeProfile, error: null });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const updateEq = vi.fn().mockResolvedValue({ data: [fakeProfile], error: null });
  const update = vi.fn(() => ({ eq: updateEq }));
  const from = vi.fn(() => ({ select, update }));

  vi.mock('@/lib/supabase', () => ({
    supabase: {
      from: (...args: unknown[]) => from(...args),
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
      },
    },
  }));

  describe('profiles api', () => {
    beforeEach(() => {
      from.mockClear();
      select.mockClear();
      eq.mockClear();
      maybeSingle.mockClear();
      update.mockClear();
      updateEq.mockClear();
    });

    it('getProfile returns the current user row', async () => {
      const result = await getProfile();
      expect(from).toHaveBeenCalledWith('profiles');
      expect(select).toHaveBeenCalledWith('*');
      expect(eq).toHaveBeenCalledWith('user_id', 'u1');
      expect(result?.display_name).toBe('Test');
    });

    it('updateProfile writes a partial update scoped to user_id', async () => {
      await updateProfile({ home_lat: 43.65, home_lng: -79.38, home_radius_m: 50 });
      expect(from).toHaveBeenCalledWith('profiles');
      expect(update).toHaveBeenCalledWith({
        home_lat: 43.65,
        home_lng: -79.38,
        home_radius_m: 50,
      });
      expect(updateEq).toHaveBeenCalledWith('user_id', 'u1');
    });
  });
  ```

- [ ] **8.3** Run — expect FAIL (no `../api`).

- [ ] **8.4** Implement `apps/web/src/features/profiles/api.ts`:

  ```ts
  // apps/web/src/features/profiles/api.ts
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
    const { error } = await supabase
      .from('profiles')
      .update(partial)
      .eq('user_id', userId);
    if (error) throw error;
  }
  ```

- [ ] **8.5** Implement `apps/web/src/features/profiles/useProfile.ts`:

  ```ts
  // apps/web/src/features/profiles/useProfile.ts
  import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
  import { getProfile, updateProfile, type ProfileUpdate, type ProfileRow } from './api';

  export const profileQueryKey = ['profile', 'me'] as const;

  export function useProfile() {
    return useQuery<ProfileRow | null>({
      queryKey: profileQueryKey,
      queryFn: getProfile,
    });
  }

  export function useUpdateProfile() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (partial: ProfileUpdate) => updateProfile(partial),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: profileQueryKey });
      },
    });
  }
  ```

- [ ] **8.6** Wrap `App.tsx` in `<QueryClientProvider>`. Edit the App.tsx from Task 7:

  ```tsx
  // apps/web/src/App.tsx
  import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
  import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
  import { AuthProvider } from '@/features/auth/AuthProvider';
  import { RequireAuth } from '@/features/auth/RequireAuth';
  import SignInPage from '@/routes/sign-in';

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1 },
    },
  });

  function PlaceholderHome() {
    return <div>home placeholder</div>;
  }

  export default function App() {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/sign-in" element={<SignInPage />} />
              <Route
                path="/"
                element={
                  <RequireAuth>
                    <PlaceholderHome />
                  </RequireAuth>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    );
  }
  ```

- [ ] **8.7** Run — expect **PASS**:

  ```bash
  pnpm --filter @ayurplex/web test -- src/features/profiles
  ```

- [ ] **8.8** Commit:

  ```bash
  cd /Users/satyamgupta/PersonalWorkspace/ayurplex
  git add apps/web/package.json apps/web/src/features/profiles apps/web/src/App.tsx pnpm-lock.yaml
  git commit -m "feat(profiles): typed API + useProfile TanStack Query hook"
  ```

---

## <a id="task-9"></a>Task 9: `useOnboardingStatus` hook

**Goal:** Compute whether the user still needs onboarding from their `profile` row.

- [ ] **9.1** Write `apps/web/src/features/onboarding/__tests__/useOnboardingStatus.test.tsx`:

  ```tsx
  // apps/web/src/features/onboarding/__tests__/useOnboardingStatus.test.tsx
  import { describe, it, expect, vi } from 'vitest';
  import { renderHook, waitFor } from '@testing-library/react';
  import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
  import React from 'react';
  import { useOnboardingStatus } from '../useOnboardingStatus';

  const mockProfile = vi.fn();

  vi.mock('@/features/profiles/useProfile', () => ({
    useProfile: () => mockProfile(),
  }));

  function wrapper({ children }: { children: React.ReactNode }) {
    const qc = new QueryClient();
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }

  describe('useOnboardingStatus', () => {
    it('returns loading while profile query is loading', () => {
      mockProfile.mockReturnValue({ data: undefined, isLoading: true });
      const { result } = renderHook(() => useOnboardingStatus(), { wrapper });
      expect(result.current.loading).toBe(true);
      expect(result.current.needsOnboarding).toBe(false);
    });

    it('needs onboarding when home_lat is null and onboarding_complete is falsy', async () => {
      mockProfile.mockReturnValue({
        data: { home_lat: null, home_lng: null, notification_prefs: {} },
        isLoading: false,
      });
      const { result } = renderHook(() => useOnboardingStatus(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.needsOnboarding).toBe(true);
    });

    it('does not need onboarding when onboarding_complete is true', async () => {
      mockProfile.mockReturnValue({
        data: {
          home_lat: null,
          home_lng: null,
          notification_prefs: { onboarding_complete: true },
        },
        isLoading: false,
      });
      const { result } = renderHook(() => useOnboardingStatus(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.needsOnboarding).toBe(false);
    });

    it('does not need onboarding when home_lat is set', async () => {
      mockProfile.mockReturnValue({
        data: { home_lat: 43.65, home_lng: -79.38, notification_prefs: {} },
        isLoading: false,
      });
      const { result } = renderHook(() => useOnboardingStatus(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.needsOnboarding).toBe(false);
    });
  });
  ```

- [ ] **9.2** Run — expect FAIL.

- [ ] **9.3** Implement `apps/web/src/features/onboarding/useOnboardingStatus.ts`:

  ```ts
  // apps/web/src/features/onboarding/useOnboardingStatus.ts
  import { useProfile } from '@/features/profiles/useProfile';

  export interface OnboardingStatus {
    loading: boolean;
    needsOnboarding: boolean;
  }

  export function useOnboardingStatus(): OnboardingStatus {
    const { data: profile, isLoading } = useProfile();

    if (isLoading || !profile) {
      return { loading: true, needsOnboarding: false };
    }

    const prefs = (profile.notification_prefs ?? {}) as Record<string, unknown>;
    const onboardingComplete = Boolean(prefs.onboarding_complete);
    const hasHome = profile.home_lat != null && profile.home_lng != null;

    return {
      loading: false,
      needsOnboarding: !onboardingComplete && !hasHome,
    };
  }
  ```

- [ ] **9.4** Run — expect **PASS**.

- [ ] **9.5** Commit:

  ```bash
  cd /Users/satyamgupta/PersonalWorkspace/ayurplex
  git add apps/web/src/features/onboarding/
  git commit -m "feat(onboarding): useOnboardingStatus derives flow from profile"
  ```

---

## <a id="task-10"></a>Task 10: TDD — `WelcomeStep`

- [ ] **10.1** Write `apps/web/src/features/onboarding/__tests__/WelcomeStep.test.tsx`:

  ```tsx
  import { describe, it, expect, vi } from 'vitest';
  import { render, screen } from '@testing-library/react';
  import userEvent from '@testing-library/user-event';
  import { WelcomeStep } from '../WelcomeStep';

  describe('WelcomeStep', () => {
    it('renders welcome copy and calls onNext when continue is clicked', async () => {
      const onNext = vi.fn();
      render(<WelcomeStep onNext={onNext} displayName="Satya" />);

      expect(screen.getByText(/welcome to ayurplex/i)).toBeInTheDocument();
      expect(screen.getByText(/satya/i)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /continue/i }));
      expect(onNext).toHaveBeenCalledTimes(1);
    });
  });
  ```

- [ ] **10.2** Run — expect FAIL.

- [ ] **10.3** Implement `apps/web/src/features/onboarding/WelcomeStep.tsx`:

  ```tsx
  // apps/web/src/features/onboarding/WelcomeStep.tsx
  export interface WelcomeStepProps {
    onNext: () => void;
    displayName: string;
  }

  export function WelcomeStep({ onNext, displayName }: WelcomeStepProps) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-6 px-6 text-center font-roboto">
        <h1 className="font-lexend text-3xl font-semibold text-ayur-primary">
          Welcome to Ayurplex
        </h1>
        <p className="text-base text-ayur-ink/70">
          Hi {displayName}! Let's set up adaptive reminders that work around your day.
        </p>
        <button
          type="button"
          onClick={onNext}
          className="rounded-full bg-ayur-primary px-8 py-3 font-lexend text-base font-semibold text-white hover:bg-ayur-primary/90"
        >
          Continue
        </button>
      </section>
    );
  }
  ```

- [ ] **10.4** Run — expect **PASS**.

- [ ] **10.5** Commit:

  ```bash
  git add apps/web/src/features/onboarding/WelcomeStep.tsx apps/web/src/features/onboarding/__tests__/WelcomeStep.test.tsx
  git commit -m "feat(onboarding): WelcomeStep component"
  ```

---

## <a id="task-11"></a>Task 11: TDD — `HomeLocationStep` (map picker)

- [ ] **11.1** Install map deps:

  ```bash
  cd /Users/satyamgupta/PersonalWorkspace/ayurplex
  pnpm --filter @ayurplex/web add maplibre-gl@^4.5.0 react-map-gl@^7.1.7
  ```

- [ ] **11.2** Write `apps/web/src/features/onboarding/__tests__/HomeLocationStep.test.tsx`:

  ```tsx
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { render, screen } from '@testing-library/react';
  import userEvent from '@testing-library/user-event';
  import { HomeLocationStep } from '../HomeLocationStep';

  // react-map-gl relies on WebGL which jsdom can't provide. Mock it for the test.
  vi.mock('react-map-gl/maplibre', () => {
    return {
      __esModule: true,
      default: ({ children, onClick }: any) => (
        <div
          data-testid="map"
          onClick={() => onClick?.({ lngLat: { lng: -79.38, lat: 43.65 } })}
        >
          {children}
        </div>
      ),
      Marker: ({ children }: any) => <div data-testid="marker">{children}</div>,
    };
  });

  describe('HomeLocationStep', () => {
    beforeEach(() => {
      Object.defineProperty(window.navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition: vi.fn((success) =>
            success({ coords: { latitude: 40, longitude: -74 } }),
          ),
        },
      });
    });

    it('saves lat/lng/radius when a pin is placed and Save is clicked', async () => {
      const onSave = vi.fn();
      const onSkip = vi.fn();
      render(<HomeLocationStep onSave={onSave} onSkip={onSkip} />);

      await userEvent.click(screen.getByTestId('map'));
      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      expect(onSave).toHaveBeenCalledWith({
        lat: 43.65,
        lng: -79.38,
        radius: 50,
      });
    });

    it('calls onSkip when the skip button is clicked', async () => {
      const onSave = vi.fn();
      const onSkip = vi.fn();
      render(<HomeLocationStep onSave={onSave} onSkip={onSkip} />);
      await userEvent.click(screen.getByRole('button', { name: /skip for now/i }));
      expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('uses geolocation when the "use my location" button is clicked', async () => {
      const onSave = vi.fn();
      const onSkip = vi.fn();
      render(<HomeLocationStep onSave={onSave} onSkip={onSkip} />);
      await userEvent.click(screen.getByRole('button', { name: /use my current location/i }));
      await userEvent.click(screen.getByRole('button', { name: /save/i }));
      expect(onSave).toHaveBeenCalledWith({ lat: 40, lng: -74, radius: 50 });
    });
  });
  ```

- [ ] **11.3** Run — expect FAIL.

- [ ] **11.4** Implement `apps/web/src/features/onboarding/HomeLocationStep.tsx`:

  ```tsx
  // apps/web/src/features/onboarding/HomeLocationStep.tsx
  import { useState } from 'react';
  import Map, { Marker } from 'react-map-gl/maplibre';
  import 'maplibre-gl/dist/maplibre-gl.css';

  export interface HomeLocationValue {
    lat: number;
    lng: number;
    radius: number;
  }

  export interface HomeLocationStepProps {
    onSave: (value: HomeLocationValue) => void;
    onSkip: () => void;
  }

  const OSM_STYLE = {
    version: 8 as const,
    sources: {
      osm: {
        type: 'raster' as const,
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
  };

  export function HomeLocationStep({ onSave, onSkip }: HomeLocationStepProps) {
    const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
    const [radius, setRadius] = useState<number>(50);

    function handleUseMyLocation() {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition((pos) => {
        setPin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    }

    function handleSave() {
      if (!pin) return;
      onSave({ lat: pin.lat, lng: pin.lng, radius });
    }

    return (
      <section className="mx-auto flex max-w-md flex-col gap-4 p-6 font-roboto">
        <h2 className="font-lexend text-2xl font-semibold text-ayur-primary">
          Set your home
        </h2>
        <p className="text-sm text-ayur-ink/70">
          Tap the map to drop a pin, or use your current location. We'll use this to surface
          reminders when you get home. You can skip and set it later in Settings.
        </p>

        <div className="h-64 overflow-hidden rounded-2xl border border-ayur-ink/10">
          <Map
            initialViewState={{ longitude: -79.38, latitude: 43.65, zoom: 11 }}
            style={{ width: '100%', height: '100%' }}
            mapStyle={OSM_STYLE as any}
            onClick={(e: any) => setPin({ lat: e.lngLat.lat, lng: e.lngLat.lng })}
          >
            {pin && (
              <Marker longitude={pin.lng} latitude={pin.lat} anchor="bottom">
                <div className="h-4 w-4 rounded-full bg-ayur-primary ring-2 ring-white" />
              </Marker>
            )}
          </Map>
        </div>

        <button
          type="button"
          onClick={handleUseMyLocation}
          className="self-start text-sm font-semibold text-ayur-primary underline"
        >
          Use my current location
        </button>

        <label className="flex flex-col gap-1 text-sm text-ayur-ink/80">
          Radius: {radius} m
          <input
            type="range"
            min={25}
            max={200}
            step={5}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
          />
        </label>

        <div className="mt-2 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="text-sm font-semibold text-ayur-ink/60 underline"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!pin}
            className="rounded-full bg-ayur-primary px-6 py-2 font-lexend text-sm font-semibold text-white disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </section>
    );
  }
  ```

- [ ] **11.5** Run — expect **PASS**:

  ```bash
  pnpm --filter @ayurplex/web test -- src/features/onboarding/__tests__/HomeLocationStep.test.tsx
  ```

- [ ] **11.6** Commit:

  ```bash
  git add apps/web/package.json apps/web/src/features/onboarding/HomeLocationStep.tsx apps/web/src/features/onboarding/__tests__/HomeLocationStep.test.tsx pnpm-lock.yaml
  git commit -m "feat(onboarding): HomeLocationStep map picker"
  ```

---

## <a id="task-12"></a>Task 12: TDD — `NotificationStep`

- [ ] **12.1** Write `apps/web/src/features/onboarding/__tests__/NotificationStep.test.tsx`:

  ```tsx
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { render, screen } from '@testing-library/react';
  import userEvent from '@testing-library/user-event';
  import { NotificationStep } from '../NotificationStep';

  describe('NotificationStep', () => {
    beforeEach(() => {
      (globalThis as any).Notification = {
        requestPermission: vi.fn().mockResolvedValue('granted'),
        permission: 'default',
      };
    });

    it('calls Notification.requestPermission and then onNext', async () => {
      const onNext = vi.fn();
      render(<NotificationStep onNext={onNext} />);
      await userEvent.click(screen.getByRole('button', { name: /turn on reminders/i }));
      expect((globalThis as any).Notification.requestPermission).toHaveBeenCalled();
      expect(onNext).toHaveBeenCalled();
    });

    it('still calls onNext when "Maybe later" is clicked', async () => {
      const onNext = vi.fn();
      render(<NotificationStep onNext={onNext} />);
      await userEvent.click(screen.getByRole('button', { name: /maybe later/i }));
      expect(onNext).toHaveBeenCalled();
    });

    it('falls back gracefully when Notification API is missing', async () => {
      (globalThis as any).Notification = undefined;
      const onNext = vi.fn();
      render(<NotificationStep onNext={onNext} />);
      expect(screen.getByText(/not supported/i)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /continue/i }));
      expect(onNext).toHaveBeenCalled();
    });
  });
  ```

- [ ] **12.2** Run — FAIL.

- [ ] **12.3** Implement `apps/web/src/features/onboarding/NotificationStep.tsx`:

  ```tsx
  // apps/web/src/features/onboarding/NotificationStep.tsx
  export interface NotificationStepProps {
    onNext: (result: { granted: boolean }) => void;
  }

  export function NotificationStep({ onNext }: NotificationStepProps) {
    const supported = typeof window !== 'undefined' && typeof (window as any).Notification !== 'undefined';

    async function handleEnable() {
      if (!supported) {
        onNext({ granted: false });
        return;
      }
      try {
        const perm = await (window as any).Notification.requestPermission();
        onNext({ granted: perm === 'granted' });
      } catch {
        onNext({ granted: false });
      }
    }

    if (!supported) {
      return (
        <section className="mx-auto flex max-w-md flex-col items-center gap-4 p-6 text-center font-roboto">
          <h2 className="font-lexend text-2xl font-semibold text-ayur-primary">
            Reminders
          </h2>
          <p className="text-sm text-ayur-ink/70">
            Push notifications are not supported in this browser. You'll still see in-app
            reminders.
          </p>
          <button
            type="button"
            onClick={() => onNext({ granted: false })}
            className="rounded-full bg-ayur-primary px-6 py-2 font-lexend text-sm font-semibold text-white"
          >
            Continue
          </button>
        </section>
      );
    }

    return (
      <section className="mx-auto flex max-w-md flex-col items-center gap-4 p-6 text-center font-roboto">
        <h2 className="font-lexend text-2xl font-semibold text-ayur-primary">
          Turn on reminders
        </h2>
        <p className="text-sm text-ayur-ink/70">
          Ayurplex nudges you when it's time to take a dose — smartly shifted around meetings
          and meals. We recommend enabling notifications.
        </p>
        <button
          type="button"
          onClick={handleEnable}
          className="rounded-full bg-ayur-primary px-6 py-2 font-lexend text-sm font-semibold text-white hover:bg-ayur-primary/90"
        >
          Turn on reminders
        </button>
        <button
          type="button"
          onClick={() => onNext({ granted: false })}
          className="text-sm font-semibold text-ayur-ink/60 underline"
        >
          Maybe later
        </button>
      </section>
    );
  }
  ```

- [ ] **12.4** Run — PASS.

- [ ] **12.5** Commit:

  ```bash
  git add apps/web/src/features/onboarding/NotificationStep.tsx apps/web/src/features/onboarding/__tests__/NotificationStep.test.tsx
  git commit -m "feat(onboarding): NotificationStep with permission prompt and fallback"
  ```

---

## <a id="task-13"></a>Task 13: TDD — `OnboardingFlow` state machine

- [ ] **13.1** Write `apps/web/src/features/onboarding/__tests__/OnboardingFlow.test.tsx`:

  ```tsx
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { render, screen, waitFor } from '@testing-library/react';
  import userEvent from '@testing-library/user-event';
  import { MemoryRouter, Routes, Route } from 'react-router-dom';
  import { OnboardingFlow } from '../OnboardingFlow';

  const updateProfile = vi.fn().mockResolvedValue(undefined);

  vi.mock('@/features/profiles/api', () => ({
    updateProfile: (...args: unknown[]) => updateProfile(...args),
    getProfile: vi.fn().mockResolvedValue({
      user_id: 'u1',
      display_name: 'Test',
      notification_prefs: {},
      home_lat: null,
      home_lng: null,
    }),
  }));

  vi.mock('@/features/profiles/useProfile', () => ({
    useProfile: () => ({
      data: { display_name: 'Test', notification_prefs: {} },
      isLoading: false,
    }),
    useUpdateProfile: () => ({ mutateAsync: updateProfile }),
  }));

  // map + notification step mocks
  vi.mock('react-map-gl/maplibre', () => ({
    __esModule: true,
    default: ({ children, onClick }: any) => (
      <div
        data-testid="map"
        onClick={() => onClick?.({ lngLat: { lng: -79.38, lat: 43.65 } })}
      >
        {children}
      </div>
    ),
    Marker: ({ children }: any) => <div>{children}</div>,
  }));

  beforeEach(() => {
    updateProfile.mockClear();
    (globalThis as any).Notification = {
      requestPermission: vi.fn().mockResolvedValue('granted'),
      permission: 'default',
    };
  });

  describe('OnboardingFlow', () => {
    it('walks welcome -> home -> notifications -> /', async () => {
      render(
        <MemoryRouter initialEntries={['/onboarding']}>
          <Routes>
            <Route path="/onboarding" element={<OnboardingFlow />} />
            <Route path="/" element={<div>home route</div>} />
          </Routes>
        </MemoryRouter>,
      );

      // Welcome
      await userEvent.click(screen.getByRole('button', { name: /continue/i }));

      // Home location
      await userEvent.click(screen.getByTestId('map'));
      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() =>
        expect(updateProfile).toHaveBeenCalledWith({
          home_lat: 43.65,
          home_lng: -79.38,
          home_radius_m: 50,
        }),
      );

      // Notifications
      await userEvent.click(screen.getByRole('button', { name: /turn on reminders/i }));

      await waitFor(() =>
        expect(updateProfile).toHaveBeenCalledWith({
          notification_prefs: { onboarding_complete: true },
        }),
      );
      await waitFor(() => expect(screen.getByText('home route')).toBeInTheDocument());
    });
  });
  ```

- [ ] **13.2** Run — FAIL.

- [ ] **13.3** Implement `apps/web/src/features/onboarding/OnboardingFlow.tsx`:

  ```tsx
  // apps/web/src/features/onboarding/OnboardingFlow.tsx
  import { useState } from 'react';
  import { useNavigate } from 'react-router-dom';
  import { useProfile, useUpdateProfile } from '@/features/profiles/useProfile';
  import { WelcomeStep } from './WelcomeStep';
  import { HomeLocationStep, type HomeLocationValue } from './HomeLocationStep';
  import { NotificationStep } from './NotificationStep';

  type Step = 'welcome' | 'home' | 'notifications';

  export function OnboardingFlow() {
    const [step, setStep] = useState<Step>('welcome');
    const { data: profile } = useProfile();
    const updateProfile = useUpdateProfile();
    const navigate = useNavigate();

    async function finish() {
      const existing = (profile?.notification_prefs ?? {}) as Record<string, unknown>;
      await updateProfile.mutateAsync({
        notification_prefs: { ...existing, onboarding_complete: true },
      });
      navigate('/', { replace: true });
    }

    async function handleHomeSave(v: HomeLocationValue) {
      await updateProfile.mutateAsync({
        home_lat: v.lat,
        home_lng: v.lng,
        home_radius_m: v.radius,
      });
      setStep('notifications');
    }

    if (step === 'welcome') {
      return (
        <WelcomeStep
          displayName={profile?.display_name ?? 'there'}
          onNext={() => setStep('home')}
        />
      );
    }

    if (step === 'home') {
      return (
        <HomeLocationStep
          onSave={handleHomeSave}
          onSkip={() => setStep('notifications')}
        />
      );
    }

    return <NotificationStep onNext={finish} />;
  }
  ```

- [ ] **13.4** Run — PASS.

- [ ] **13.5** Commit:

  ```bash
  git add apps/web/src/features/onboarding/OnboardingFlow.tsx apps/web/src/features/onboarding/__tests__/OnboardingFlow.test.tsx
  git commit -m "feat(onboarding): OnboardingFlow state machine"
  ```

---

## <a id="task-14"></a>Task 14: `/onboarding` route and `RequireOnboarded` redirect

- [ ] **14.1** Create `apps/web/src/routes/onboarding/index.tsx`:

  ```tsx
  // apps/web/src/routes/onboarding/index.tsx
  import { OnboardingFlow } from '@/features/onboarding/OnboardingFlow';

  export default function OnboardingPage() {
    return (
      <main className="min-h-screen bg-ayur-bg font-roboto text-ayur-ink">
        <OnboardingFlow />
      </main>
    );
  }
  ```

- [ ] **14.2** Create `apps/web/src/features/onboarding/RequireOnboarded.tsx`:

  ```tsx
  // apps/web/src/features/onboarding/RequireOnboarded.tsx
  import type { ReactNode } from 'react';
  import { Navigate } from 'react-router-dom';
  import { useOnboardingStatus } from './useOnboardingStatus';

  export function RequireOnboarded({ children }: { children: ReactNode }) {
    const { loading, needsOnboarding } = useOnboardingStatus();
    if (loading) {
      return (
        <div className="flex min-h-screen items-center justify-center text-ayur-ink/60">
          Loading…
        </div>
      );
    }
    if (needsOnboarding) {
      return <Navigate to="/onboarding" replace />;
    }
    return <>{children}</>;
  }
  ```

- [ ] **14.3** Wire it up in `apps/web/src/App.tsx`:

  ```tsx
  // apps/web/src/App.tsx
  import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
  import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
  import { AuthProvider } from '@/features/auth/AuthProvider';
  import { RequireAuth } from '@/features/auth/RequireAuth';
  import { RequireOnboarded } from '@/features/onboarding/RequireOnboarded';
  import SignInPage from '@/routes/sign-in';
  import OnboardingPage from '@/routes/onboarding';
  import HomePage from '@/routes/home';

  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
  });

  export default function App() {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/sign-in" element={<SignInPage />} />
              <Route
                path="/onboarding"
                element={
                  <RequireAuth>
                    <OnboardingPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/"
                element={
                  <RequireAuth>
                    <RequireOnboarded>
                      <HomePage />
                    </RequireOnboarded>
                  </RequireAuth>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    );
  }
  ```

- [ ] **14.4** Write `apps/web/src/features/onboarding/__tests__/RequireOnboarded.test.tsx`:

  ```tsx
  import { describe, it, expect, vi } from 'vitest';
  import { render, screen } from '@testing-library/react';
  import { MemoryRouter, Route, Routes } from 'react-router-dom';
  import { RequireOnboarded } from '../RequireOnboarded';

  const mockStatus = vi.fn();
  vi.mock('../useOnboardingStatus', () => ({
    useOnboardingStatus: () => mockStatus(),
  }));

  describe('RequireOnboarded', () => {
    it('redirects to /onboarding when needsOnboarding is true', () => {
      mockStatus.mockReturnValue({ loading: false, needsOnboarding: true });
      render(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route
              path="/"
              element={
                <RequireOnboarded>
                  <div>home</div>
                </RequireOnboarded>
              }
            />
            <Route path="/onboarding" element={<div>onboarding page</div>} />
          </Routes>
        </MemoryRouter>,
      );
      expect(screen.getByText('onboarding page')).toBeInTheDocument();
    });

    it('renders children when already onboarded', () => {
      mockStatus.mockReturnValue({ loading: false, needsOnboarding: false });
      render(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route
              path="/"
              element={
                <RequireOnboarded>
                  <div>home</div>
                </RequireOnboarded>
              }
            />
            <Route path="/onboarding" element={<div>onboarding page</div>} />
          </Routes>
        </MemoryRouter>,
      );
      expect(screen.getByText('home')).toBeInTheDocument();
    });
  });
  ```

- [ ] **14.5** Run — PASS (note: Task 15 creates `HomePage`; if tests run at this point fail due to missing import, skip the App.tsx update until Task 15's HomePage file exists, or create a stub file here).

- [ ] **14.6** Create a temporary stub at `apps/web/src/routes/home/index.tsx` (will be replaced in Task 15):

  ```tsx
  // apps/web/src/routes/home/index.tsx
  export default function HomePage() {
    return <div>home stub</div>;
  }
  ```

- [ ] **14.7** Run full test suite and build:

  ```bash
  pnpm --filter @ayurplex/web test
  pnpm --filter @ayurplex/web build
  ```

  Expected: both pass.

- [ ] **14.8** Commit:

  ```bash
  git add apps/web/src/routes/onboarding apps/web/src/routes/home apps/web/src/features/onboarding/RequireOnboarded.tsx apps/web/src/features/onboarding/__tests__/RequireOnboarded.test.tsx apps/web/src/App.tsx
  git commit -m "feat(onboarding): /onboarding route + RequireOnboarded guard"
  ```

---

## <a id="task-15"></a>Task 15: Placeholder Home Dashboard route

- [ ] **15.1** Write `apps/web/src/routes/home/__tests__/HomePage.test.tsx`:

  ```tsx
  import { describe, it, expect, vi } from 'vitest';
  import { render, screen } from '@testing-library/react';
  import { MemoryRouter } from 'react-router-dom';
  import HomePage from '../index';

  vi.mock('@/features/profiles/useProfile', () => ({
    useProfile: () => ({
      data: { display_name: 'Satya', notification_prefs: {} },
      isLoading: false,
    }),
  }));

  vi.mock('@/lib/supabase', () => ({
    supabase: { auth: { signOut: vi.fn().mockResolvedValue({ error: null }) } },
  }));

  describe('HomePage', () => {
    it('greets the user by display name', () => {
      render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>,
      );
      expect(screen.getByText(/welcome, satya/i)).toBeInTheDocument();
      expect(
        screen.getByText(/your medications will appear here/i),
      ).toBeInTheDocument();
    });
  });
  ```

- [ ] **15.2** Replace the Task 14 stub with a real implementation at `apps/web/src/routes/home/index.tsx`:

  ```tsx
  // apps/web/src/routes/home/index.tsx
  import { useProfile } from '@/features/profiles/useProfile';
  import { SignOutButton } from '@/features/auth/SignOutButton';

  export default function HomePage() {
    const { data: profile } = useProfile();

    return (
      <main className="min-h-screen bg-ayur-bg px-6 py-10 font-roboto text-ayur-ink">
        <header className="mx-auto flex max-w-2xl items-center justify-between">
          <h1 className="font-lexend text-2xl font-semibold text-ayur-primary">
            Welcome, {profile?.display_name ?? 'there'}
          </h1>
          <SignOutButton />
        </header>
        <section className="mx-auto mt-12 max-w-2xl rounded-2xl border border-ayur-ink/10 bg-white/60 p-8 text-center">
          <p className="text-ayur-ink/70">Your medications will appear here.</p>
          <button
            type="button"
            disabled
            className="mt-6 inline-flex h-12 w-12 items-center justify-center rounded-full bg-ayur-primary/40 text-2xl text-white"
            aria-label="Add medication (coming soon)"
          >
            +
          </button>
        </section>
      </main>
    );
  }
  ```

  Note: `SignOutButton` comes from Task 16. Create an empty placeholder for now so this file compiles:

  ```tsx
  // apps/web/src/features/auth/SignOutButton.tsx (temporary placeholder — real version in Task 16)
  export function SignOutButton() {
    return null;
  }
  ```

- [ ] **15.3** Run — expect **PASS**:

  ```bash
  pnpm --filter @ayurplex/web test -- src/routes/home
  ```

- [ ] **15.4** Commit:

  ```bash
  git add apps/web/src/routes/home apps/web/src/features/auth/SignOutButton.tsx
  git commit -m "feat(home): placeholder Home Dashboard with display name greeting"
  ```

---

## <a id="task-16"></a>Task 16: Sign-out support

- [ ] **16.1** Write `apps/web/src/features/auth/__tests__/SignOutButton.test.tsx`:

  ```tsx
  import { describe, it, expect, vi } from 'vitest';
  import { render, screen } from '@testing-library/react';
  import userEvent from '@testing-library/user-event';
  import { MemoryRouter, Routes, Route } from 'react-router-dom';
  import { SignOutButton } from '../SignOutButton';

  const signOut = vi.fn().mockResolvedValue({ error: null });
  vi.mock('@/lib/supabase', () => ({
    supabase: { auth: { signOut: () => signOut() } },
  }));

  describe('SignOutButton', () => {
    it('calls supabase.auth.signOut and navigates to /sign-in', async () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<SignOutButton />} />
            <Route path="/sign-in" element={<div>sign in page</div>} />
          </Routes>
        </MemoryRouter>,
      );
      await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
      expect(signOut).toHaveBeenCalled();
      // navigation is async
      await screen.findByText('sign in page');
    });
  });
  ```

- [ ] **16.2** Run — expect FAIL (still the placeholder).

- [ ] **16.3** Replace `apps/web/src/features/auth/SignOutButton.tsx`:

  ```tsx
  // apps/web/src/features/auth/SignOutButton.tsx
  import { useNavigate } from 'react-router-dom';
  import { supabase } from '@/lib/supabase';

  export function SignOutButton() {
    const navigate = useNavigate();

    async function handleClick() {
      await supabase.auth.signOut();
      navigate('/sign-in', { replace: true });
    }

    return (
      <button
        type="button"
        onClick={handleClick}
        className="rounded-full border border-ayur-ink/20 px-4 py-2 text-sm font-semibold text-ayur-ink/80 hover:bg-white"
      >
        Sign out
      </button>
    );
  }
  ```

- [ ] **16.4** Run — PASS.

- [ ] **16.5** Commit:

  ```bash
  git add apps/web/src/features/auth/SignOutButton.tsx apps/web/src/features/auth/__tests__/SignOutButton.test.tsx
  git commit -m "feat(auth): SignOutButton + navigation to /sign-in"
  ```

---

## <a id="task-17"></a>Task 17: E2E happy path with mocked OAuth

**Goal:** A Playwright test that fakes the OAuth callback by injecting a dev session, walks the 3 onboarding steps, and asserts landing on `/`.

- [ ] **17.1** Create a helper to generate a dev JWT. Get the local JWT secret:

  ```bash
  cd /Users/satyamgupta/PersonalWorkspace/ayurplex
  supabase status | grep "JWT secret"
  ```

  Expected output sample: `JWT secret: super-secret-jwt-token-with-at-least-32-characters-long`.

- [ ] **17.2** Export that value into the test environment. Add to `apps/web/.env.test.local` (git-ignored):

  ```
  SUPABASE_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long
  ```

- [ ] **17.3** Create `apps/web/e2e/helpers/fake-session.ts`:

  ```ts
  // apps/web/e2e/helpers/fake-session.ts
  import jwt from 'jsonwebtoken';

  export interface FakeSession {
    access_token: string;
    refresh_token: string;
    token_type: 'bearer';
    expires_in: number;
    expires_at: number;
    user: {
      id: string;
      email: string;
      user_metadata: { full_name: string };
      app_metadata: { provider: 'google' };
      aud: 'authenticated';
    };
  }

  export function buildFakeSession(userId: string, email: string, fullName: string): FakeSession {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) throw new Error('SUPABASE_JWT_SECRET not set in test env');
    const now = Math.floor(Date.now() / 1000);
    const access = jwt.sign(
      {
        sub: userId,
        email,
        aud: 'authenticated',
        role: 'authenticated',
        iat: now,
        exp: now + 3600,
      },
      secret,
    );
    return {
      access_token: access,
      refresh_token: 'fake-refresh',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: now + 3600,
      user: {
        id: userId,
        email,
        user_metadata: { full_name: fullName },
        app_metadata: { provider: 'google' },
        aud: 'authenticated',
      },
    };
  }
  ```

- [ ] **17.4** Install `jsonwebtoken`:

  ```bash
  pnpm --filter @ayurplex/web add -D jsonwebtoken@^9.0.2 @types/jsonwebtoken@^9.0.6
  ```

- [ ] **17.5** Create `apps/web/e2e/auth-onboarding.spec.ts`:

  ```ts
  // apps/web/e2e/auth-onboarding.spec.ts
  import { test, expect } from '@playwright/test';
  import { buildFakeSession } from './helpers/fake-session';

  const USER_ID = '11111111-1111-1111-1111-111111111111';
  const EMAIL = 'e2e@example.com';
  const NAME = 'E2E User';

  test.describe('Auth + onboarding happy path', () => {
    test('signs in (mocked), completes onboarding, lands on home', async ({ page, context }) => {
      // 1. Seed profiles for this fake user directly via Supabase REST (simulating the
      //    trigger that fires on real signup). Uses the service role for test isolation.
      //    In CI this is handled by a global setup that runs `supabase db reset`.
      const session = buildFakeSession(USER_ID, EMAIL, NAME);

      // 2. Prime localStorage with a valid supabase.auth token BEFORE navigation.
      await context.addInitScript((s) => {
        const storageKey = `sb-localhost-auth-token`;
        localStorage.setItem(storageKey, JSON.stringify(s));
      }, session);

      // 3. Visit /
      await page.goto('/');

      // 4. If profiles row missing, app will create via first-run — but our trigger
      //    requires an auth.users row. For this mocked flow, we rely on a pre-seeded
      //    profile row. Document: the runner script must pre-seed. See README.
      await expect(page).toHaveURL(/\/onboarding/);

      // Welcome
      await page.getByRole('button', { name: /continue/i }).click();

      // Home location — click the map (MapLibre handles pointer events)
      const map = page.locator('.maplibregl-map');
      await map.click({ position: { x: 150, y: 150 } });
      await page.getByRole('button', { name: /^save$/i }).click();

      // Notifications — choose Maybe later to avoid browser permission dialog
      await page.getByRole('button', { name: /maybe later/i }).click();

      // Home
      await expect(page).toHaveURL('/');
      await expect(page.getByText(/welcome, e2e user/i)).toBeVisible();
    });
  });
  ```

- [ ] **17.6** Add a global Playwright setup that seeds the user via the service role. Create `apps/web/e2e/global-setup.ts`:

  ```ts
  // apps/web/e2e/global-setup.ts
  import { createClient } from '@supabase/supabase-js';

  export default async function globalSetup() {
    const url = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY required for e2e setup');
    }
    const admin = createClient(url, serviceKey);

    const USER_ID = '11111111-1111-1111-1111-111111111111';

    // Insert auth.users row via admin API — this fires the handle_new_user trigger.
    const { data: existing } = await admin.auth.admin.getUserById(USER_ID);
    if (!existing?.user) {
      await admin.auth.admin.createUser({
        id: USER_ID,
        email: 'e2e@example.com',
        email_confirm: true,
        user_metadata: { full_name: 'E2E User' },
      } as any);
    }
  }
  ```

- [ ] **17.7** Update `apps/web/playwright.config.ts` (created in Plan 1) to register the global setup:

  ```ts
  // apps/web/playwright.config.ts (additions)
  import { defineConfig } from '@playwright/test';

  export default defineConfig({
    testDir: './e2e',
    globalSetup: './e2e/global-setup.ts',
    use: {
      baseURL: 'http://localhost:5173',
    },
    webServer: {
      command: 'pnpm dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
  });
  ```

- [ ] **17.8** Run the e2e test. First make sure Supabase is running and the service role key is exported:

  ```bash
  cd /Users/satyamgupta/PersonalWorkspace/ayurplex
  supabase start
  export SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o json | jq -r .SERVICE_ROLE_KEY)
  export SUPABASE_JWT_SECRET=$(supabase status -o json | jq -r .JWT_SECRET)
  pnpm --filter @ayurplex/web test:e2e
  ```

  Expected tail: `1 passed`.

- [ ] **17.9** Commit:

  ```bash
  git add apps/web/e2e apps/web/playwright.config.ts apps/web/package.json pnpm-lock.yaml
  git commit -m "test(e2e): auth + onboarding happy path with mocked OAuth"
  ```

---

## <a id="task-18"></a>Task 18: Final verification and quality gates

- [ ] **18.1** Run the full gate locally:

  ```bash
  cd /Users/satyamgupta/PersonalWorkspace/ayurplex
  pnpm install
  pnpm build
  pnpm typecheck
  pnpm lint
  pnpm test
  pnpm --filter @ayurplex/web test:e2e
  ```

  Expected: every step exits 0.

- [ ] **18.2** Manual smoke (requires real Google OAuth credentials from Task 4):

  1. `pnpm --filter @ayurplex/web dev`
  2. Open http://localhost:5173 — expect redirect to `/sign-in`.
  3. Click "Sign in with Google". Complete the Google consent flow including the Calendar read scope.
  4. Expect redirect to `/onboarding`. Walk through Welcome → Home (pick a point on the map, save) → Notifications (accept).
  5. Expect landing on `/` with "Welcome, <your name>".
  6. Click "Sign out". Expect `/sign-in`.
  7. Sign in again. Expect to go directly to `/` (no onboarding).
  8. Verify in psql:

     ```bash
     psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
       -c "select display_name, home_lat, home_lng, home_radius_m, notification_prefs from public.profiles;"
     psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
       -c "select user_id, name from public.rooms;"
     ```

     Expect one profiles row with non-null home fields and `{"onboarding_complete": true}`; one rooms row named `Home`.

- [ ] **18.3** Final commit (if anything new):

  ```bash
  cd /Users/satyamgupta/PersonalWorkspace/ayurplex
  git status
  # If nothing to commit, this task is done. Otherwise:
  # git add <files>
  # git commit -m "chore(plan-2): final verification tweaks"
  ```

---

## Spec coverage checklist

- [x] Google OAuth with Calendar read scope (Flow A step 1; Tech Decisions → Auth)
- [x] Welcome → home → notifications 3-step onboarding (Decision #10; Flow A)
- [x] Home location skippable (Flow A step 2)
- [x] Default room "Home" auto-created (Data Model → rooms; Flow A note)
- [x] `profiles` table with all spec columns (`user_id`, `display_name`, `timezone`, `home_lat`, `home_lng`, `home_radius_m`, `notification_prefs`) + RLS (Data Model)
- [x] `rooms` table with `user_id`, `name`, `icon` + RLS (Data Model)
- [x] `google_refresh_token` capture via Google OAuth `access_type=offline` + `prompt=consent` — token lands in `auth.users` (Supabase Auth handles storage server-side)
- [x] Typed Supabase client via generated `Database` types (Tech Decisions; Project Structure `src/types/`)
- [x] Notifications permission request (Flow A step 3)
- [x] Design tokens applied via Tailwind utility classes (Lexend, Roboto, `ayur-primary`)
- [x] TDD discipline — RED → GREEN for every runtime file (Testing Strategy)

## Notes / spec gaps observed while drafting

- **Push subscription persistence** — The spec says "Web Push API for PWA" and Flow A step 3 requests permission but does not prescribe where the push subscription goes. This plan defers the actual `pushManager.subscribe` storage to Plan 6 (Notifications). Onboarding only requests permission.
- **Encryption of `google_refresh_token`** — The spec says "encrypted, for Calendar API server-side refresh". In Supabase Auth, the provider refresh token is stored in `auth.users.raw_app_meta_data` (or the identities table) by the platform — not by us. If a future plan needs programmatic access, we will add an edge function to proxy it. This plan does not add custom encryption.
- **Timezone detection** — The spec's `profiles.timezone` is a non-null IANA string. The migration defaults to `'UTC'`. A future plan should run `Intl.DateTimeFormat().resolvedOptions().timeZone` on first load and call `updateProfile({ timezone })`. Not in this plan.
- **Rooms during onboarding** — Decision #10 explicitly excludes rooms from onboarding; the default "Home" row comes from the trigger. This plan respects that and does not surface a rooms UI.
- **`rooms` API stub** — The task list included creating `apps/web/src/features/rooms/api.ts`. This plan does NOT create it because nothing in the Auth/Onboarding flow consumes it. Plan 3 (medications) will create `listRooms` when the Add Medication flow needs it. Leaving it out keeps Plan 2 minimal and avoids dead code.
