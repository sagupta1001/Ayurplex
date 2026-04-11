# Ayurplex Plan 3 — Medications + Schedules + Home Dashboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After execution, a signed-in Ayurplex user can tap "+" on the Home Dashboard, walk through the Add Medication modal (name → dosage → form/instructions → meal relationship with apple icons → schedule with time windows → optional preferred room → start/end dates → review), save the medication, see it listed on the dashboard with today's scheduled doses, and manually mark a dose as taken, with Priya's teal Status Ring reflecting real data.

**Architecture:** A single Supabase migration adds `medications`, `medication_schedules`, and `scheduled_doses` tables with RLS scoped to `auth.uid() = user_id`. A client-side pure function `materializeDoses` naively expands each schedule's `times_of_day` × `days_of_week` into the next 7 days of `scheduled_doses` rows using the midpoint of each time window, stored as UTC via the Plan 1 `lib/date.ts` helpers. This naive materializer is intentionally independent of the rule engine; Plan 4 replaces it with the real deterministic rule engine, and Plan 6 moves materialization from the client to a pg_cron'd edge function. Home Dashboard reads `scheduled_doses` for today via TanStack Query and renders a teal `StatusRing` plus a list of `DoseRow` entries with optimistic "mark taken" updates.

**Tech Stack:** React Hook Form, Zod, TanStack Query, Supabase (Postgres + Auth + RLS), React Router (modal routes), Vitest + React Testing Library, Playwright.

**Prerequisites:** Plan 1 complete (pnpm workspace, Turborepo, Vite + React, Tailwind with Priya's tokens, `lib/date.ts`, Vitest, Playwright) AND Plan 2 complete (Supabase auth, `AuthProvider`, typed Supabase client at `apps/web/src/lib/supabase.ts`, `profiles` and `rooms` tables with RLS, `features/rooms/api.ts` with `listRooms`, `useRooms` hook, home route placeholder at `apps/web/src/routes/home/index.tsx`, generated `apps/web/src/types/database.ts`, dev JWT sign-in helper for E2E tests).

---

## Context & References

- **Spec:** [`docs/superpowers/specs/2026-04-11-ayurplex-mvp-design.md`](../specs/2026-04-11-ayurplex-mvp-design.md) — Data Model, Flow B (Add Medication manual), Home Dashboard.
- **Risks primarily addressed:**
  - **R1 (medication safety)** — the schema enforces `check` constraints on enums (`meal_relationship`, `form`, `status`, `adjustment_reason`); RLS refuses cross-user access.
  - **R5 (timezone bugs)** — every materialized dose is computed in the user's IANA timezone via `lib/date.ts` and stored as UTC timestamptz.
- **Naive materialization intentional simplification:** This plan does NOT implement the deterministic rule engine. `materializeDoses` uses the midpoint of each `times_of_day` window and does not consult calendar events, meal windows, quiet hours, or travel. Plan 4 replaces the body of `materializeDoses` (keeping the signature stable) with the real rule engine from `packages/shared/rule-engine`.
- **Transactions tradeoff:** Supabase JS does not expose multi-statement transactions. `createSchedule` performs a sequential insert of the schedule row followed by a bulk insert of materialized doses. If the dose insert fails, the call deletes the just-inserted schedule row to avoid orphans. This is documented in the function JSDoc; Plan 6 moves dose materialization into a Postgres function invoked via RPC for true atomicity.

---

## Files this plan will create or modify

```
supabase/migrations/0004_medications_schedules_doses.sql        NEW
apps/web/src/types/database.ts                                  REGENERATE
packages/shared/src/types.ts                                    MODIFY
apps/web/src/features/medications/api.ts                        NEW
apps/web/src/features/medications/useMedications.ts             NEW
apps/web/src/features/medications/MedicationListItem.tsx        NEW
apps/web/src/features/medications/MedicationList.tsx            NEW
apps/web/src/features/medications/__tests__/api.test.ts         NEW
apps/web/src/features/medications/__tests__/MedicationList.test.tsx  NEW
apps/web/src/features/schedules/api.ts                          NEW
apps/web/src/features/schedules/materializeDoses.ts             NEW
apps/web/src/features/schedules/__tests__/api.test.ts           NEW
apps/web/src/features/schedules/__tests__/materializeDoses.test.ts  NEW
apps/web/src/features/doses/api.ts                              NEW
apps/web/src/features/doses/useDueToday.ts                      NEW
apps/web/src/features/doses/DoseRow.tsx                         NEW
apps/web/src/features/doses/__tests__/api.test.ts               NEW
apps/web/src/features/doses/__tests__/DoseRow.test.tsx          NEW
apps/web/src/features/doses/__tests__/useDueToday.test.tsx      NEW
apps/web/src/features/rooms/api.ts                              MODIFY (add createRoom)
apps/web/src/routes/add-med/index.tsx                           NEW
apps/web/src/routes/add-med/AddMedWizard.tsx                    NEW
apps/web/src/routes/add-med/schema.ts                           NEW
apps/web/src/routes/add-med/steps/NameStep.tsx                  NEW
apps/web/src/routes/add-med/steps/DosageStep.tsx                NEW
apps/web/src/routes/add-med/steps/MealRelationshipStep.tsx      NEW
apps/web/src/routes/add-med/steps/ScheduleStep.tsx              NEW
apps/web/src/routes/add-med/steps/RoomStep.tsx                  NEW
apps/web/src/routes/add-med/steps/DateRangeStep.tsx             NEW
apps/web/src/routes/add-med/steps/ReviewStep.tsx                NEW
apps/web/src/routes/add-med/__tests__/AddMedWizard.test.tsx     NEW
apps/web/src/routes/add-med/__tests__/MealRelationshipStep.test.tsx  NEW
apps/web/src/routes/add-med/__tests__/ScheduleStep.test.tsx     NEW
apps/web/src/routes/add-med/__tests__/schema.test.ts            NEW
apps/web/src/routes/home/index.tsx                              MODIFY
apps/web/src/routes/home/StatusRing.tsx                         NEW
apps/web/src/routes/home/__tests__/StatusRing.test.tsx          NEW
apps/web/src/routes/home/__tests__/home.test.tsx                NEW
apps/web/src/components/Icon/AppleMealIcon.tsx                  NEW
apps/web/src/components/Icon/__tests__/AppleMealIcon.test.tsx   NEW
apps/web/src/App.tsx                                            MODIFY (register /add-med modal route)
apps/web/e2e/add-medication.spec.ts                             NEW
```

---

## Task 1: Migration — `medications`, `medication_schedules`, `scheduled_doses`

**Files:**
- Create: `supabase/migrations/0004_medications_schedules_doses.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/0004_medications_schedules_doses.sql`:

```sql
-- 0004_medications_schedules_doses.sql
-- Plan 3: Medications + Schedules + Scheduled Doses
--
-- Adds three tables with RLS scoped to auth.uid() = user_id:
--   1. medications            - user's current & historical meds
--   2. medication_schedules   - frequency + time windows + days of week + optional room
--   3. scheduled_doses        - per-occurrence dose rows (materialized)
--
-- Naive materialization (Plan 3) runs client-side after schedule creation.
-- Plan 4 introduces the rule engine; Plan 6 moves materialization to pg_cron.

-- =========================================================================
-- medications
-- =========================================================================
create table if not exists public.medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  dosage_amount numeric(10, 3) not null check (dosage_amount > 0),
  dosage_unit text not null,
  form text not null check (form in ('tablet', 'capsule', 'liquid')),
  instructions text,
  meal_relationship text not null check (
    meal_relationship in ('before', 'with', 'after', 'any')
  ),
  start_date date not null,
  end_date date,
  prescription_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists medications_user_active_idx
  on public.medications (user_id, active);

create index if not exists medications_user_start_idx
  on public.medications (user_id, start_date);

-- =========================================================================
-- medication_schedules
-- =========================================================================
create table if not exists public.medication_schedules (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.medications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  frequency text not null check (frequency in ('daily', 'weekly', 'as_needed')),
  times_of_day jsonb not null,
  days_of_week int[] not null default '{1,2,3,4,5,6,7}',
  preferred_room_id uuid references public.rooms(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists medication_schedules_medication_idx
  on public.medication_schedules (medication_id);

create index if not exists medication_schedules_user_idx
  on public.medication_schedules (user_id);

-- =========================================================================
-- scheduled_doses
-- =========================================================================
create table if not exists public.scheduled_doses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  schedule_id uuid not null references public.medication_schedules(id) on delete cascade,
  scheduled_for timestamptz not null,
  adjusted_for timestamptz,
  adjustment_reason text check (
    adjustment_reason in ('meeting_conflict', 'travel', 'quiet_hours', 'none')
  ),
  status text not null default 'pending' check (
    status in ('pending', 'taken', 'skipped', 'missed')
  ),
  taken_at timestamptz,
  taken_via text check (taken_via in ('manual', 'voice', 'auto')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scheduled_doses_user_scheduled_idx
  on public.scheduled_doses (user_id, scheduled_for);

create index if not exists scheduled_doses_medication_idx
  on public.scheduled_doses (medication_id);

create index if not exists scheduled_doses_user_status_idx
  on public.scheduled_doses (user_id, status);

-- =========================================================================
-- updated_at triggers (reuses bump_updated_at() from 0001)
-- =========================================================================
create trigger medications_set_updated_at
  before update on public.medications
  for each row execute function public.bump_updated_at();

create trigger medication_schedules_set_updated_at
  before update on public.medication_schedules
  for each row execute function public.bump_updated_at();

create trigger scheduled_doses_set_updated_at
  before update on public.scheduled_doses
  for each row execute function public.bump_updated_at();

-- =========================================================================
-- Row Level Security
-- =========================================================================
alter table public.medications enable row level security;
alter table public.medication_schedules enable row level security;
alter table public.scheduled_doses enable row level security;

-- medications policies
create policy "medications_select_own"
  on public.medications for select
  using (auth.uid() = user_id);

create policy "medications_insert_own"
  on public.medications for insert
  with check (auth.uid() = user_id);

create policy "medications_update_own"
  on public.medications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "medications_delete_own"
  on public.medications for delete
  using (auth.uid() = user_id);

-- medication_schedules policies
create policy "medication_schedules_select_own"
  on public.medication_schedules for select
  using (auth.uid() = user_id);

create policy "medication_schedules_insert_own"
  on public.medication_schedules for insert
  with check (auth.uid() = user_id);

create policy "medication_schedules_update_own"
  on public.medication_schedules for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "medication_schedules_delete_own"
  on public.medication_schedules for delete
  using (auth.uid() = user_id);

-- scheduled_doses policies
create policy "scheduled_doses_select_own"
  on public.scheduled_doses for select
  using (auth.uid() = user_id);

create policy "scheduled_doses_insert_own"
  on public.scheduled_doses for insert
  with check (auth.uid() = user_id);

create policy "scheduled_doses_update_own"
  on public.scheduled_doses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "scheduled_doses_delete_own"
  on public.scheduled_doses for delete
  using (auth.uid() = user_id);
```

- [ ] **Step 2: Apply the migration**

Run from repo root:

```bash
pnpm supabase db reset
```

**Expected output (last lines):**

```
Resetting local database...
Initialising schema...
Seeding globals from roles.sql...
Applying migration 0001_init.sql...
Applying migration 0002_profiles_rls.sql...
Applying migration 0003_rooms.sql...
Applying migration 0004_medications_schedules_doses.sql...
Seeding data from seed.sql...
Finished supabase db reset on branch main.
```

- [ ] **Step 3: Verify tables and RLS via psql**

Run:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "\dt public.medications public.medication_schedules public.scheduled_doses"
```

**Expected:**

```
                List of relations
 Schema |         Name          | Type  |  Owner
--------+-----------------------+-------+----------
 public | medication_schedules  | table | postgres
 public | medications           | table | postgres
 public | scheduled_doses       | table | postgres
```

Run:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select tablename, rowsecurity from pg_tables where tablename in ('medications','medication_schedules','scheduled_doses');"
```

**Expected (all three `rowsecurity = t`):**

```
      tablename       | rowsecurity
----------------------+-------------
 medications          | t
 medication_schedules | t
 scheduled_doses      | t
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0004_medications_schedules_doses.sql
git commit -m "feat(db): add medications, schedules, and scheduled_doses tables with RLS"
```

---

## Task 2: Regenerate Supabase types and extend `packages/shared/src/types.ts`

**Files:**
- Regenerate: `apps/web/src/types/database.ts`
- Modify: `packages/shared/src/types.ts`
- Create: `packages/shared/src/__tests__/types.test.ts`

- [ ] **Step 1: Regenerate typed client**

Run:

```bash
pnpm --filter @ayurplex/web exec supabase gen types typescript --local > apps/web/src/types/database.ts
```

**Expected:** `apps/web/src/types/database.ts` contains `medications`, `medication_schedules`, and `scheduled_doses` in the `Database['public']['Tables']` interface. Verify:

```bash
grep -c "medications:" apps/web/src/types/database.ts
grep -c "medication_schedules:" apps/web/src/types/database.ts
grep -c "scheduled_doses:" apps/web/src/types/database.ts
```

**Expected:** each grep returns `>= 1`.

- [ ] **Step 2: Add domain types to `packages/shared/src/types.ts`**

Open `packages/shared/src/types.ts`. Add at the bottom of the existing file:

```ts
// ---------------------------------------------------------------------------
// Plan 3 — Medication domain types
// ---------------------------------------------------------------------------

/** Relationship of a medication to a meal. */
export type MealRelationship = 'before' | 'with' | 'after' | 'any';

/** Pharmaceutical form of a medication. */
export type MedicationForm = 'tablet' | 'capsule' | 'liquid';

/** Cadence of a medication schedule. */
export type ScheduleFrequency = 'daily' | 'weekly' | 'as_needed';

/** ISO day-of-week, Monday = 1 ... Sunday = 7 (matches Postgres int[] convention). */
export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** A [start, end] time window expressed in 24h HH:MM local time. */
export interface TimeWindow {
  window_start: string; // e.g. "08:00"
  window_end: string;   // e.g. "11:00"
}

/** Status of a materialized scheduled dose. */
export type DoseStatus = 'pending' | 'taken' | 'skipped' | 'missed';

/** Reason the rule engine adjusted a dose (Plan 3 always writes 'none'). */
export type DoseAdjustmentReason =
  | 'meeting_conflict'
  | 'travel'
  | 'quiet_hours'
  | 'none';

/** Channel through which a dose was logged as taken. */
export type TakenVia = 'manual' | 'voice' | 'auto';

/** A medication row, surfaced to the UI. */
export interface Medication {
  id: string;
  user_id: string;
  name: string;
  dosage_amount: number;
  dosage_unit: string;
  form: MedicationForm;
  instructions: string | null;
  meal_relationship: MealRelationship;
  start_date: string; // ISO date
  end_date: string | null;
  prescription_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/** A medication schedule row, surfaced to the UI. */
export interface MedicationSchedule {
  id: string;
  medication_id: string;
  user_id: string;
  frequency: ScheduleFrequency;
  times_of_day: TimeWindow[];
  days_of_week: DayOfWeek[];
  preferred_room_id: string | null;
  created_at: string;
  updated_at: string;
}

/** A materialized dose row, surfaced to the UI. */
export interface ScheduledDose {
  id: string;
  user_id: string;
  medication_id: string;
  schedule_id: string;
  scheduled_for: string;        // ISO UTC timestamptz
  adjusted_for: string | null;
  adjustment_reason: DoseAdjustmentReason | null;
  status: DoseStatus;
  taken_at: string | null;
  taken_via: TakenVia | null;
  created_at: string;
  updated_at: string;
}

/** Input accepted by `createMedication`. */
export interface MedicationInput {
  name: string;
  dosage_amount: number;
  dosage_unit: string;
  form: MedicationForm;
  instructions: string | null;
  meal_relationship: MealRelationship;
  start_date: string;
  end_date: string | null;
}

/** Input accepted by `createSchedule`. */
export interface MedicationScheduleInput {
  frequency: ScheduleFrequency;
  times_of_day: TimeWindow[];
  days_of_week: DayOfWeek[];
  preferred_room_id: string | null;
}

/** Shape of a row inserted by the naive materializer. */
export interface ScheduledDoseInsert {
  user_id: string;
  medication_id: string;
  schedule_id: string;
  scheduled_for: string;
  adjusted_for: string;
  adjustment_reason: DoseAdjustmentReason;
  status: DoseStatus;
}
```

- [ ] **Step 3: Write a type-level assertion test**

Create `packages/shared/src/__tests__/types.test.ts`:

```ts
import { describe, it, expectTypeOf } from 'vitest';
import type {
  MealRelationship,
  Medication,
  MedicationSchedule,
  ScheduledDose,
  ScheduledDoseInsert,
  TimeWindow,
  DayOfWeek,
  DoseStatus,
} from '../types';

describe('Plan 3 shared domain types', () => {
  it('MealRelationship accepts the 4 spec values', () => {
    expectTypeOf<'before'>().toMatchTypeOf<MealRelationship>();
    expectTypeOf<'with'>().toMatchTypeOf<MealRelationship>();
    expectTypeOf<'after'>().toMatchTypeOf<MealRelationship>();
    expectTypeOf<'any'>().toMatchTypeOf<MealRelationship>();
  });

  it('Medication has the spec fields', () => {
    expectTypeOf<Medication['meal_relationship']>().toEqualTypeOf<MealRelationship>();
    expectTypeOf<Medication['active']>().toEqualTypeOf<boolean>();
    expectTypeOf<Medication['end_date']>().toEqualTypeOf<string | null>();
  });

  it('MedicationSchedule uses TimeWindow[] and DayOfWeek[]', () => {
    expectTypeOf<MedicationSchedule['times_of_day']>().toEqualTypeOf<TimeWindow[]>();
    expectTypeOf<MedicationSchedule['days_of_week']>().toEqualTypeOf<DayOfWeek[]>();
  });

  it('ScheduledDose status is a DoseStatus', () => {
    expectTypeOf<ScheduledDose['status']>().toEqualTypeOf<DoseStatus>();
  });

  it('ScheduledDoseInsert always carries adjustment_reason and status', () => {
    expectTypeOf<ScheduledDoseInsert['adjustment_reason']>().not.toBeNullable();
    expectTypeOf<ScheduledDoseInsert['status']>().not.toBeNullable();
  });
});
```

- [ ] **Step 4: Run shared package tests**

```bash
pnpm --filter @ayurplex/shared test
```

**Expected:** Vitest reports all tests in `types.test.ts` pass.

- [ ] **Step 5: Build the shared package**

```bash
pnpm --filter @ayurplex/shared build
```

**Expected:** exits with code 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/types/database.ts packages/shared/src/types.ts packages/shared/src/__tests__/types.test.ts
git commit -m "feat(shared): export medication domain types"
```

---

## Task 3: TDD — Medications API

**Files:**
- Create: `apps/web/src/features/medications/api.ts`
- Create: `apps/web/src/features/medications/__tests__/api.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/medications/__tests__/api.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Medication, MedicationInput } from '@ayurplex/shared';
import {
  listActiveMedications,
  getMedicationById,
  createMedication,
  deactivateMedication,
} from '../api';
import { supabase } from '../../../lib/supabase';

vi.mock('../../../lib/supabase', () => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  };
  return {
    supabase: {
      from: vi.fn(() => chain),
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: 'user-1' } },
          error: null,
        })),
      },
      __chain: chain,
    },
  };
});

const sampleRow: Medication = {
  id: 'med-1',
  user_id: 'user-1',
  name: 'Metformin',
  dosage_amount: 500,
  dosage_unit: 'mg',
  form: 'tablet',
  instructions: 'with food',
  meal_relationship: 'with',
  start_date: '2026-04-11',
  end_date: null,
  prescription_id: null,
  active: true,
  created_at: '2026-04-11T00:00:00.000Z',
  updated_at: '2026-04-11T00:00:00.000Z',
};

type MockedSupabase = typeof supabase & { __chain: Record<string, ReturnType<typeof vi.fn>> };
const mocked = supabase as unknown as MockedSupabase;

beforeEach(() => {
  for (const fn of Object.values(mocked.__chain)) fn.mockClear?.();
  (supabase.from as unknown as ReturnType<typeof vi.fn>).mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('medications/api', () => {
  it('listActiveMedications returns only active rows', async () => {
    mocked.__chain.order.mockResolvedValueOnce({ data: [sampleRow], error: null });

    const result = await listActiveMedications();

    expect(supabase.from).toHaveBeenCalledWith('medications');
    expect(mocked.__chain.select).toHaveBeenCalledWith('*');
    expect(mocked.__chain.eq).toHaveBeenCalledWith('active', true);
    expect(result).toEqual([sampleRow]);
  });

  it('getMedicationById returns a single row', async () => {
    mocked.__chain.single.mockResolvedValueOnce({ data: sampleRow, error: null });

    const result = await getMedicationById('med-1');

    expect(supabase.from).toHaveBeenCalledWith('medications');
    expect(mocked.__chain.eq).toHaveBeenCalledWith('id', 'med-1');
    expect(result).toEqual(sampleRow);
  });

  it('createMedication inserts and returns the new row', async () => {
    mocked.__chain.single.mockResolvedValueOnce({ data: sampleRow, error: null });

    const input: MedicationInput = {
      name: 'Metformin',
      dosage_amount: 500,
      dosage_unit: 'mg',
      form: 'tablet',
      instructions: 'with food',
      meal_relationship: 'with',
      start_date: '2026-04-11',
      end_date: null,
    };

    const result = await createMedication(input);

    expect(mocked.__chain.insert).toHaveBeenCalledWith({
      ...input,
      user_id: 'user-1',
      active: true,
    });
    expect(result).toEqual(sampleRow);
  });

  it('deactivateMedication flips active to false', async () => {
    mocked.__chain.single.mockResolvedValueOnce({
      data: { ...sampleRow, active: false },
      error: null,
    });

    const result = await deactivateMedication('med-1');

    expect(mocked.__chain.update).toHaveBeenCalledWith({ active: false });
    expect(mocked.__chain.eq).toHaveBeenCalledWith('id', 'med-1');
    expect(result.active).toBe(false);
  });

  it('createMedication throws if there is no authenticated user', async () => {
    (supabase.auth.getUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    await expect(
      createMedication({
        name: 'X',
        dosage_amount: 1,
        dosage_unit: 'mg',
        form: 'tablet',
        instructions: null,
        meal_relationship: 'any',
        start_date: '2026-04-11',
        end_date: null,
      }),
    ).rejects.toThrow(/not authenticated/i);
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL**

```bash
pnpm --filter @ayurplex/web test -- src/features/medications
```

**Expected:** Vitest reports `Cannot find module '../api'` (file does not exist yet).

- [ ] **Step 3: Implement `api.ts`**

Create `apps/web/src/features/medications/api.ts`:

```ts
import type { Medication, MedicationInput } from '@ayurplex/shared';
import { supabase } from '../../lib/supabase';

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}

/** List all active medications for the current user, newest first. */
export async function listActiveMedications(): Promise<Medication[]> {
  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Medication[];
}

/** Get a single medication by id (RLS ensures it belongs to the current user). */
export async function getMedicationById(id: string): Promise<Medication> {
  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as Medication;
}

/** Insert a medication owned by the current user and return the new row. */
export async function createMedication(input: MedicationInput): Promise<Medication> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('medications')
    .insert({ ...input, user_id: userId, active: true })
    .select('*')
    .single();
  if (error) throw error;
  return data as Medication;
}

/** Flip `active` to false; RLS allows only the owning user. */
export async function deactivateMedication(id: string): Promise<Medication> {
  const { data, error } = await supabase
    .from('medications')
    .update({ active: false })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Medication;
}
```

- [ ] **Step 4: Run the test — expect PASS**

```bash
pnpm --filter @ayurplex/web test -- src/features/medications
```

**Expected:** All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/medications/api.ts apps/web/src/features/medications/__tests__/api.test.ts
git commit -m "feat(medications): add typed Supabase API with TDD"
```

---

## Task 4: TDD — `useMedications` TanStack Query hook

**Files:**
- Create: `apps/web/src/features/medications/useMedications.ts`
- Create: `apps/web/src/features/medications/__tests__/useMedications.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/medications/__tests__/useMedications.test.tsx`:

```tsx
import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useMedications } from '../useMedications';

vi.mock('../api', () => ({
  listActiveMedications: vi.fn(),
  createMedication: vi.fn(),
  deactivateMedication: vi.fn(),
}));

import { listActiveMedications } from '../api';

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useMedications', () => {
  it('returns an empty list while loading, then the fetched rows', async () => {
    (listActiveMedications as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'med-1',
        user_id: 'user-1',
        name: 'Metformin',
        dosage_amount: 500,
        dosage_unit: 'mg',
        form: 'tablet',
        instructions: null,
        meal_relationship: 'with',
        start_date: '2026-04-11',
        end_date: null,
        prescription_id: null,
        active: true,
        created_at: '2026-04-11T00:00:00Z',
        updated_at: '2026-04-11T00:00:00Z',
      },
    ]);

    const { result } = renderHook(() => useMedications(), { wrapper: makeWrapper() });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.medications).toEqual([]);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.medications).toHaveLength(1);
    expect(result.current.medications[0].name).toBe('Metformin');
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL**

```bash
pnpm --filter @ayurplex/web test -- src/features/medications/__tests__/useMedications.test.tsx
```

**Expected:** `Cannot find module '../useMedications'`.

- [ ] **Step 3: Implement the hook**

Create `apps/web/src/features/medications/useMedications.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Medication, MedicationInput } from '@ayurplex/shared';
import {
  listActiveMedications,
  createMedication,
  deactivateMedication,
} from './api';

export const MEDICATIONS_QUERY_KEY = ['medications', 'active'] as const;

export interface UseMedicationsResult {
  medications: Medication[];
  isLoading: boolean;
  error: unknown;
}

export function useMedications(): UseMedicationsResult {
  const query = useQuery({
    queryKey: MEDICATIONS_QUERY_KEY,
    queryFn: listActiveMedications,
  });
  return {
    medications: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useCreateMedication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MedicationInput) => createMedication(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MEDICATIONS_QUERY_KEY });
    },
  });
}

export function useDeactivateMedication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateMedication(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MEDICATIONS_QUERY_KEY });
    },
  });
}
```

- [ ] **Step 4: Run the test — expect PASS**

```bash
pnpm --filter @ayurplex/web test -- src/features/medications/__tests__/useMedications.test.tsx
```

**Expected:** Test passes.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/medications/useMedications.ts apps/web/src/features/medications/__tests__/useMedications.test.tsx
git commit -m "feat(medications): add useMedications TanStack Query hook"
```

---

## Task 5: TDD — Schedules API + naive dose materialization

**Files:**
- Create: `apps/web/src/features/schedules/materializeDoses.ts`
- Create: `apps/web/src/features/schedules/__tests__/materializeDoses.test.ts`
- Create: `apps/web/src/features/schedules/api.ts`
- Create: `apps/web/src/features/schedules/__tests__/api.test.ts`

### 5A: Naive materializer (pure function)

- [ ] **Step 1: Write the failing materializer test**

Create `apps/web/src/features/schedules/__tests__/materializeDoses.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type {
  MedicationScheduleInput,
  ScheduledDoseInsert,
} from '@ayurplex/shared';
import { materializeDoses } from '../materializeDoses';

const baseCtx = {
  userId: 'user-1',
  medicationId: 'med-1',
  scheduleId: 'sch-1',
  timezone: 'America/Toronto',
  startDate: '2026-04-13', // Monday
  days: 7,
};

describe('materializeDoses', () => {
  it('produces one dose per day for a single window across 7 days', () => {
    const schedule: MedicationScheduleInput = {
      frequency: 'daily',
      times_of_day: [{ window_start: '08:00', window_end: '10:00' }],
      days_of_week: [1, 2, 3, 4, 5, 6, 7],
      preferred_room_id: null,
    };

    const doses = materializeDoses(schedule, baseCtx);
    expect(doses).toHaveLength(7);
    expect(doses[0].user_id).toBe('user-1');
    expect(doses[0].medication_id).toBe('med-1');
    expect(doses[0].schedule_id).toBe('sch-1');
    expect(doses[0].status).toBe('pending');
    expect(doses[0].adjustment_reason).toBe('none');

    // Window midpoint 09:00 local America/Toronto on 2026-04-13 = 13:00 UTC
    // (EDT is UTC-4 on that date).
    expect(doses[0].scheduled_for).toBe('2026-04-13T13:00:00.000Z');
    expect(doses[0].adjusted_for).toBe('2026-04-13T13:00:00.000Z');
  });

  it('produces 2 doses/day × weekdays only when days_of_week is [1..5]', () => {
    const schedule: MedicationScheduleInput = {
      frequency: 'daily',
      times_of_day: [
        { window_start: '08:00', window_end: '10:00' },
        { window_start: '20:00', window_end: '22:00' },
      ],
      days_of_week: [1, 2, 3, 4, 5],
      preferred_room_id: null,
    };

    const doses = materializeDoses(schedule, baseCtx);
    // 5 weekdays × 2 windows = 10 doses across a 7-day span (Mon..Sun).
    expect(doses).toHaveLength(10);

    const byDay = new Map<string, number>();
    for (const d of doses) {
      const day = d.scheduled_for.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    expect(byDay.get('2026-04-18')).toBeUndefined(); // Saturday
    expect(byDay.get('2026-04-19')).toBeUndefined(); // Sunday
    expect(byDay.get('2026-04-13')).toBe(2);         // Monday
    expect(byDay.get('2026-04-17')).toBe(2);         // Friday
  });

  it('stores scheduled_for as UTC even in a non-local timezone', () => {
    const schedule: MedicationScheduleInput = {
      frequency: 'daily',
      times_of_day: [{ window_start: '08:00', window_end: '10:00' }],
      days_of_week: [1, 2, 3, 4, 5, 6, 7],
      preferred_room_id: null,
    };

    const doses: ScheduledDoseInsert[] = materializeDoses(schedule, {
      ...baseCtx,
      timezone: 'Asia/Kolkata', // UTC+5:30
    });
    // 09:00 IST on 2026-04-13 = 03:30 UTC
    expect(doses[0].scheduled_for).toBe('2026-04-13T03:30:00.000Z');
  });

  it('throws when times_of_day is empty', () => {
    expect(() =>
      materializeDoses(
        {
          frequency: 'daily',
          times_of_day: [],
          days_of_week: [1, 2, 3, 4, 5, 6, 7],
          preferred_room_id: null,
        },
        baseCtx,
      ),
    ).toThrow(/at least one time window/i);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @ayurplex/web test -- src/features/schedules/__tests__/materializeDoses.test.ts
```

**Expected:** `Cannot find module '../materializeDoses'`.

- [ ] **Step 3: Implement `materializeDoses`**

Create `apps/web/src/features/schedules/materializeDoses.ts`:

```ts
import type {
  DayOfWeek,
  DoseAdjustmentReason,
  DoseStatus,
  MedicationScheduleInput,
  ScheduledDoseInsert,
  TimeWindow,
} from '@ayurplex/shared';
import { zonedTimeToUtc, addDays } from '../../lib/date';

/**
 * Context required to materialize doses for a schedule.
 *
 * Plan 3 consumes this from `createSchedule`. Plan 4 will reuse the same
 * signature but replace the body with the deterministic rule engine from
 * `packages/shared/rule-engine`.
 */
export interface MaterializeDosesContext {
  userId: string;
  medicationId: string;
  scheduleId: string;
  /** IANA zone, e.g. "America/Toronto" — from `profiles.timezone`. */
  timezone: string;
  /** Inclusive local start date, ISO `YYYY-MM-DD`. */
  startDate: string;
  /** Number of calendar days to materialize, typically 7. */
  days: number;
}

const STATUS_PENDING: DoseStatus = 'pending';
const REASON_NONE: DoseAdjustmentReason = 'none';

/** Parse `YYYY-MM-DD` into year/month/day numbers (local-calendar). */
function parseYmd(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split('-').map(Number);
  return { y, m, d };
}

/**
 * Postgres int[] uses Monday=1 ... Sunday=7. JS `Date.getUTCDay()` uses
 * Sunday=0 ... Saturday=6. This converts from JS to our canonical form.
 */
function jsDayToIso(day: number): DayOfWeek {
  // Sunday (0) -> 7; Mon..Sat (1..6) -> 1..6
  return (day === 0 ? 7 : day) as DayOfWeek;
}

function midpoint(window: TimeWindow): { hour: number; minute: number } {
  const [sh, sm] = window.window_start.split(':').map(Number);
  const [eh, em] = window.window_end.split(':').map(Number);
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  if (endMinutes < startMinutes) {
    throw new Error(
      `TimeWindow end (${window.window_end}) must be >= start (${window.window_start})`,
    );
  }
  const midMinutes = Math.floor((startMinutes + endMinutes) / 2);
  return { hour: Math.floor(midMinutes / 60), minute: midMinutes % 60 };
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Produce `ScheduledDoseInsert` rows for the next `ctx.days` calendar days,
 * using the midpoint of each `TimeWindow` as both `scheduled_for` and
 * `adjusted_for`. Every produced row has `adjustment_reason = 'none'` and
 * `status = 'pending'`.
 *
 * PURE: no I/O, no Date.now(), deterministic given inputs.
 */
export function materializeDoses(
  schedule: MedicationScheduleInput,
  ctx: MaterializeDosesContext,
): ScheduledDoseInsert[] {
  if (schedule.times_of_day.length === 0) {
    throw new Error('materializeDoses requires at least one time window');
  }

  const doses: ScheduledDoseInsert[] = [];
  const { y, m, d } = parseYmd(ctx.startDate);

  for (let dayOffset = 0; dayOffset < ctx.days; dayOffset++) {
    const dayDate = addDays(new Date(Date.UTC(y, m - 1, d)), dayOffset);
    const isoDay = jsDayToIso(dayDate.getUTCDay());
    if (!schedule.days_of_week.includes(isoDay)) continue;

    const localYmd =
      `${dayDate.getUTCFullYear()}-` +
      `${pad(dayDate.getUTCMonth() + 1)}-` +
      `${pad(dayDate.getUTCDate())}`;

    for (const window of schedule.times_of_day) {
      const { hour, minute } = midpoint(window);
      const localIso = `${localYmd}T${pad(hour)}:${pad(minute)}:00`;
      const utcIso = zonedTimeToUtc(localIso, ctx.timezone).toISOString();
      doses.push({
        user_id: ctx.userId,
        medication_id: ctx.medicationId,
        schedule_id: ctx.scheduleId,
        scheduled_for: utcIso,
        adjusted_for: utcIso,
        adjustment_reason: REASON_NONE,
        status: STATUS_PENDING,
      });
    }
  }

  return doses;
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm --filter @ayurplex/web test -- src/features/schedules/__tests__/materializeDoses.test.ts
```

**Expected:** all 4 tests pass.

### 5B: Schedules API

- [ ] **Step 5: Write the failing API test**

Create `apps/web/src/features/schedules/__tests__/api.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Medication,
  MedicationScheduleInput,
  MedicationSchedule,
} from '@ayurplex/shared';
import { createSchedule } from '../api';
import { supabase } from '../../../lib/supabase';

vi.mock('../../../lib/supabase', () => {
  const schedulesChain = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
  };
  const dosesChain = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
  };
  return {
    supabase: {
      from: vi.fn((table: string) =>
        table === 'medication_schedules' ? schedulesChain : dosesChain,
      ),
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: 'user-1' } },
          error: null,
        })),
      },
      __schedulesChain: schedulesChain,
      __dosesChain: dosesChain,
    },
  };
});

type MockedSupabase = typeof supabase & {
  __schedulesChain: Record<string, ReturnType<typeof vi.fn>>;
  __dosesChain: Record<string, ReturnType<typeof vi.fn>>;
};
const mocked = supabase as unknown as MockedSupabase;

const sampleMed: Medication = {
  id: 'med-1',
  user_id: 'user-1',
  name: 'Metformin',
  dosage_amount: 500,
  dosage_unit: 'mg',
  form: 'tablet',
  instructions: null,
  meal_relationship: 'with',
  start_date: '2026-04-13',
  end_date: null,
  prescription_id: null,
  active: true,
  created_at: '2026-04-11T00:00:00Z',
  updated_at: '2026-04-11T00:00:00Z',
};

const sampleInput: MedicationScheduleInput = {
  frequency: 'daily',
  times_of_day: [{ window_start: '08:00', window_end: '10:00' }],
  days_of_week: [1, 2, 3, 4, 5, 6, 7],
  preferred_room_id: null,
};

const sampleSchedule: MedicationSchedule = {
  id: 'sch-1',
  medication_id: 'med-1',
  user_id: 'user-1',
  frequency: 'daily',
  times_of_day: sampleInput.times_of_day,
  days_of_week: sampleInput.days_of_week,
  preferred_room_id: null,
  created_at: '2026-04-11T00:00:00Z',
  updated_at: '2026-04-11T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createSchedule', () => {
  it('inserts schedule row then bulk-inserts 7 materialized doses', async () => {
    mocked.__schedulesChain.single.mockResolvedValueOnce({
      data: sampleSchedule,
      error: null,
    });
    mocked.__dosesChain.select.mockResolvedValueOnce({
      data: new Array(7).fill({}),
      error: null,
    });

    const result = await createSchedule(sampleMed, sampleInput, {
      timezone: 'America/Toronto',
      startDate: '2026-04-13',
      days: 7,
    });

    expect(supabase.from).toHaveBeenCalledWith('medication_schedules');
    expect(mocked.__schedulesChain.insert).toHaveBeenCalledWith({
      medication_id: 'med-1',
      user_id: 'user-1',
      frequency: 'daily',
      times_of_day: sampleInput.times_of_day,
      days_of_week: sampleInput.days_of_week,
      preferred_room_id: null,
    });
    expect(supabase.from).toHaveBeenCalledWith('scheduled_doses');
    const doseInsertArg = mocked.__dosesChain.insert.mock.calls[0][0];
    expect(Array.isArray(doseInsertArg)).toBe(true);
    expect(doseInsertArg).toHaveLength(7);
    expect(doseInsertArg[0].schedule_id).toBe('sch-1');
    expect(result).toEqual(sampleSchedule);
  });

  it('rolls back the schedule row if dose insert fails', async () => {
    mocked.__schedulesChain.single.mockResolvedValueOnce({
      data: sampleSchedule,
      error: null,
    });
    mocked.__dosesChain.select.mockResolvedValueOnce({
      data: null,
      error: { message: 'boom' },
    });

    await expect(
      createSchedule(sampleMed, sampleInput, {
        timezone: 'America/Toronto',
        startDate: '2026-04-13',
        days: 7,
      }),
    ).rejects.toThrow(/boom/);

    expect(mocked.__schedulesChain.delete).toHaveBeenCalled();
    expect(mocked.__schedulesChain.eq).toHaveBeenCalledWith('id', 'sch-1');
  });
});
```

- [ ] **Step 6: Run — expect FAIL**

```bash
pnpm --filter @ayurplex/web test -- src/features/schedules/__tests__/api.test.ts
```

**Expected:** `Cannot find module '../api'`.

- [ ] **Step 7: Implement the schedules API**

Create `apps/web/src/features/schedules/api.ts`:

```ts
import type {
  Medication,
  MedicationSchedule,
  MedicationScheduleInput,
} from '@ayurplex/shared';
import { supabase } from '../../lib/supabase';
import { materializeDoses, type MaterializeDosesContext } from './materializeDoses';

export interface CreateScheduleOptions {
  timezone: string;
  /** Local `YYYY-MM-DD`, defaults to the medication's `start_date`. */
  startDate?: string;
  /** Number of calendar days to materialize. Defaults to 7. */
  days?: number;
}

/**
 * Create a schedule row for a medication AND materialize the next N days of
 * `scheduled_doses`.
 *
 * Transactions tradeoff: Supabase JS does not expose multi-statement
 * transactions. We insert the schedule first, then the doses. If dose insert
 * fails, we delete the schedule to avoid orphans. Plan 6 replaces this with
 * a Postgres function called via RPC for true atomicity.
 */
export async function createSchedule(
  medication: Medication,
  input: MedicationScheduleInput,
  options: CreateScheduleOptions,
): Promise<MedicationSchedule> {
  const { data: scheduleRow, error: scheduleError } = await supabase
    .from('medication_schedules')
    .insert({
      medication_id: medication.id,
      user_id: medication.user_id,
      frequency: input.frequency,
      times_of_day: input.times_of_day,
      days_of_week: input.days_of_week,
      preferred_room_id: input.preferred_room_id,
    })
    .select('*')
    .single();

  if (scheduleError) throw scheduleError;
  const schedule = scheduleRow as MedicationSchedule;

  const ctx: MaterializeDosesContext = {
    userId: medication.user_id,
    medicationId: medication.id,
    scheduleId: schedule.id,
    timezone: options.timezone,
    startDate: options.startDate ?? medication.start_date,
    days: options.days ?? 7,
  };

  const doses = materializeDoses(input, ctx);

  const { error: dosesError } = await supabase
    .from('scheduled_doses')
    .insert(doses)
    .select('id');

  if (dosesError) {
    // Roll back the schedule row (best effort).
    await supabase
      .from('medication_schedules')
      .delete()
      .eq('id', schedule.id);
    throw dosesError;
  }

  return schedule;
}
```

- [ ] **Step 8: Run — expect PASS**

```bash
pnpm --filter @ayurplex/web test -- src/features/schedules
```

**Expected:** all 6 tests across the schedules feature pass.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/features/schedules
git commit -m "feat(schedules): add naive dose materializer and createSchedule API"
```

---

## Task 6: TDD — Doses API (`listDueToday`, `markTaken`, `markSkipped`)

**Files:**
- Create: `apps/web/src/features/doses/api.ts`
- Create: `apps/web/src/features/doses/__tests__/api.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/doses/__tests__/api.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScheduledDose } from '@ayurplex/shared';
import { listDueToday, markTaken, markSkipped } from '../api';
import { supabase } from '../../../lib/supabase';

vi.mock('../../../lib/supabase', () => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };
  return {
    supabase: {
      from: vi.fn(() => chain),
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: 'user-1' } },
          error: null,
        })),
      },
      __chain: chain,
    },
  };
});

type MockedSupabase = typeof supabase & { __chain: Record<string, ReturnType<typeof vi.fn>> };
const mocked = supabase as unknown as MockedSupabase;

const sampleDose: ScheduledDose = {
  id: 'dose-1',
  user_id: 'user-1',
  medication_id: 'med-1',
  schedule_id: 'sch-1',
  scheduled_for: '2026-04-11T13:00:00.000Z',
  adjusted_for: '2026-04-11T13:00:00.000Z',
  adjustment_reason: 'none',
  status: 'pending',
  taken_at: null,
  taken_via: null,
  created_at: '2026-04-11T00:00:00Z',
  updated_at: '2026-04-11T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('doses/api', () => {
  it('listDueToday queries scheduled_doses by UTC day range for current user', async () => {
    mocked.__chain.order.mockResolvedValueOnce({ data: [sampleDose], error: null });

    const result = await listDueToday({
      timezone: 'America/Toronto',
      now: new Date('2026-04-11T18:00:00Z'),
    });

    expect(supabase.from).toHaveBeenCalledWith('scheduled_doses');
    expect(mocked.__chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mocked.__chain.gte).toHaveBeenCalled();
    expect(mocked.__chain.lt).toHaveBeenCalled();
    expect(result).toEqual([sampleDose]);
  });

  it('markTaken updates status, taken_at, taken_via', async () => {
    mocked.__chain.single.mockResolvedValueOnce({
      data: { ...sampleDose, status: 'taken', taken_via: 'manual' },
      error: null,
    });

    const result = await markTaken('dose-1', {
      at: new Date('2026-04-11T13:05:00Z'),
      via: 'manual',
    });

    expect(mocked.__chain.update).toHaveBeenCalledWith({
      status: 'taken',
      taken_at: '2026-04-11T13:05:00.000Z',
      taken_via: 'manual',
    });
    expect(mocked.__chain.eq).toHaveBeenCalledWith('id', 'dose-1');
    expect(result.status).toBe('taken');
  });

  it('markSkipped updates status to skipped', async () => {
    mocked.__chain.single.mockResolvedValueOnce({
      data: { ...sampleDose, status: 'skipped' },
      error: null,
    });

    const result = await markSkipped('dose-1');
    expect(mocked.__chain.update).toHaveBeenCalledWith({ status: 'skipped' });
    expect(result.status).toBe('skipped');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @ayurplex/web test -- src/features/doses/__tests__/api.test.ts
```

**Expected:** `Cannot find module '../api'`.

- [ ] **Step 3: Implement `doses/api.ts`**

Create `apps/web/src/features/doses/api.ts`:

```ts
import type { ScheduledDose, TakenVia } from '@ayurplex/shared';
import { supabase } from '../../lib/supabase';
import { startOfLocalDay, addDays } from '../../lib/date';

export interface ListDueTodayOptions {
  /** IANA timezone from the user's profile. */
  timezone: string;
  /** Current instant; defaults to `new Date()`. Injectable for tests. */
  now?: Date;
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}

/**
 * Return all scheduled_doses whose `scheduled_for` falls inside today
 * (local calendar day in `options.timezone`), newest first.
 */
export async function listDueToday(
  options: ListDueTodayOptions,
): Promise<ScheduledDose[]> {
  const userId = await requireUserId();
  const now = options.now ?? new Date();
  const startLocal = startOfLocalDay(now, options.timezone);
  const endLocal = addDays(startLocal, 1);

  const { data, error } = await supabase
    .from('scheduled_doses')
    .select('*')
    .eq('user_id', userId)
    .gte('scheduled_for', startLocal.toISOString())
    .lt('scheduled_for', endLocal.toISOString())
    .order('scheduled_for', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ScheduledDose[];
}

export interface MarkTakenOptions {
  at?: Date;
  via?: TakenVia;
}

/** Mark a dose as taken at `at` (default: now) via `via` (default: 'manual'). */
export async function markTaken(
  doseId: string,
  options: MarkTakenOptions = {},
): Promise<ScheduledDose> {
  const at = options.at ?? new Date();
  const via: TakenVia = options.via ?? 'manual';
  const { data, error } = await supabase
    .from('scheduled_doses')
    .update({
      status: 'taken',
      taken_at: at.toISOString(),
      taken_via: via,
    })
    .eq('id', doseId)
    .select('*')
    .single();
  if (error) throw error;
  return data as ScheduledDose;
}

/** Mark a dose as skipped. */
export async function markSkipped(doseId: string): Promise<ScheduledDose> {
  const { data, error } = await supabase
    .from('scheduled_doses')
    .update({ status: 'skipped' })
    .eq('id', doseId)
    .select('*')
    .single();
  if (error) throw error;
  return data as ScheduledDose;
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm --filter @ayurplex/web test -- src/features/doses/__tests__/api.test.ts
```

**Expected:** all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/doses/api.ts apps/web/src/features/doses/__tests__/api.test.ts
git commit -m "feat(doses): add listDueToday, markTaken, markSkipped API"
```

---

## Task 7: TDD — `useDueToday` hook with optimistic updates

**Files:**
- Create: `apps/web/src/features/doses/useDueToday.ts`
- Create: `apps/web/src/features/doses/__tests__/useDueToday.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/doses/__tests__/useDueToday.test.tsx`:

```tsx
import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScheduledDose } from '@ayurplex/shared';
import { useDueToday } from '../useDueToday';

vi.mock('../api', () => ({
  listDueToday: vi.fn(),
  markTaken: vi.fn(),
  markSkipped: vi.fn(),
}));

import { listDueToday, markTaken } from '../api';

const pendingDose: ScheduledDose = {
  id: 'dose-1',
  user_id: 'user-1',
  medication_id: 'med-1',
  schedule_id: 'sch-1',
  scheduled_for: '2026-04-11T13:00:00.000Z',
  adjusted_for: '2026-04-11T13:00:00.000Z',
  adjustment_reason: 'none',
  status: 'pending',
  taken_at: null,
  taken_via: null,
  created_at: '2026-04-11T00:00:00Z',
  updated_at: '2026-04-11T00:00:00Z',
};

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useDueToday', () => {
  it('returns fetched doses and computes taken/total counts', async () => {
    (listDueToday as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      pendingDose,
      { ...pendingDose, id: 'dose-2', status: 'taken' },
    ]);

    const { result } = renderHook(
      () => useDueToday({ timezone: 'America/Toronto' }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.doses).toHaveLength(2);
    expect(result.current.takenCount).toBe(1);
    expect(result.current.totalCount).toBe(2);
  });

  it('optimistically flips status to taken on markTaken', async () => {
    (listDueToday as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([pendingDose]);
    (markTaken as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async () => ({ ...pendingDose, status: 'taken' }),
    );

    const { result } = renderHook(
      () => useDueToday({ timezone: 'America/Toronto' }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.markTaken('dose-1');
    });

    expect(result.current.doses[0].status).toBe('taken');
    expect(result.current.takenCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @ayurplex/web test -- src/features/doses/__tests__/useDueToday.test.tsx
```

**Expected:** `Cannot find module '../useDueToday'`.

- [ ] **Step 3: Implement the hook**

Create `apps/web/src/features/doses/useDueToday.ts`:

```ts
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ScheduledDose } from '@ayurplex/shared';
import { listDueToday, markTaken, markSkipped } from './api';

export const DOSES_TODAY_QUERY_KEY = ['doses', 'today'] as const;

export interface UseDueTodayOptions {
  timezone: string;
}

export interface UseDueTodayResult {
  doses: ScheduledDose[];
  takenCount: number;
  totalCount: number;
  isLoading: boolean;
  error: unknown;
  markTaken: (doseId: string) => Promise<void>;
  markSkipped: (doseId: string) => Promise<void>;
}

export function useDueToday(options: UseDueTodayOptions): UseDueTodayResult {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: DOSES_TODAY_QUERY_KEY,
    queryFn: () => listDueToday({ timezone: options.timezone }),
  });

  const takenMutation = useMutation({
    mutationFn: (doseId: string) => markTaken(doseId),
    onMutate: async (doseId) => {
      await qc.cancelQueries({ queryKey: DOSES_TODAY_QUERY_KEY });
      const previous =
        qc.getQueryData<ScheduledDose[]>(DOSES_TODAY_QUERY_KEY) ?? [];
      qc.setQueryData<ScheduledDose[]>(
        DOSES_TODAY_QUERY_KEY,
        previous.map((d) =>
          d.id === doseId
            ? { ...d, status: 'taken', taken_via: 'manual' }
            : d,
        ),
      );
      return { previous };
    },
    onError: (_err, _doseId, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(DOSES_TODAY_QUERY_KEY, ctx.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: DOSES_TODAY_QUERY_KEY });
    },
  });

  const skippedMutation = useMutation({
    mutationFn: (doseId: string) => markSkipped(doseId),
    onMutate: async (doseId) => {
      await qc.cancelQueries({ queryKey: DOSES_TODAY_QUERY_KEY });
      const previous =
        qc.getQueryData<ScheduledDose[]>(DOSES_TODAY_QUERY_KEY) ?? [];
      qc.setQueryData<ScheduledDose[]>(
        DOSES_TODAY_QUERY_KEY,
        previous.map((d) => (d.id === doseId ? { ...d, status: 'skipped' } : d)),
      );
      return { previous };
    },
    onError: (_err, _doseId, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(DOSES_TODAY_QUERY_KEY, ctx.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: DOSES_TODAY_QUERY_KEY });
    },
  });

  const doses = query.data ?? [];
  const { takenCount, totalCount } = useMemo(() => {
    let taken = 0;
    for (const d of doses) if (d.status === 'taken') taken++;
    return { takenCount: taken, totalCount: doses.length };
  }, [doses]);

  return {
    doses,
    takenCount,
    totalCount,
    isLoading: query.isLoading,
    error: query.error,
    markTaken: async (doseId) => {
      await takenMutation.mutateAsync(doseId);
    },
    markSkipped: async (doseId) => {
      await skippedMutation.mutateAsync(doseId);
    },
  };
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm --filter @ayurplex/web test -- src/features/doses/__tests__/useDueToday.test.tsx
```

**Expected:** both tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/doses/useDueToday.ts apps/web/src/features/doses/__tests__/useDueToday.test.tsx
git commit -m "feat(doses): add useDueToday hook with optimistic markTaken"
```

---

## Task 8: TDD — `StatusRing` component

**Files:**
- Create: `apps/web/src/routes/home/StatusRing.tsx`
- Create: `apps/web/src/routes/home/__tests__/StatusRing.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/routes/home/__tests__/StatusRing.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusRing } from '../StatusRing';

describe('StatusRing', () => {
  it('renders "X/Y" and a teal progress circle', () => {
    const { container } = render(<StatusRing taken={2} total={5} />);
    expect(screen.getByText('2/5')).toBeInTheDocument();
    const progress = container.querySelector('circle[data-testid="ring-progress"]');
    expect(progress).not.toBeNull();
    expect(progress?.getAttribute('stroke')).toBe('#19AFA2');
  });

  it('uses stroke-dasharray proportional to taken/total', () => {
    const { container } = render(<StatusRing taken={1} total={4} />);
    const progress = container.querySelector('circle[data-testid="ring-progress"]');
    const dashArray = progress?.getAttribute('stroke-dasharray') ?? '';
    const [filled, gap] = dashArray.split(' ').map(Number);
    // 25% filled
    expect(Math.abs(filled / (filled + gap) - 0.25)).toBeLessThan(0.001);
  });

  it('renders a full ring when total is 0', () => {
    render(<StatusRing taken={0} total={0} />);
    expect(screen.getByText('0/0')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @ayurplex/web test -- src/routes/home/__tests__/StatusRing.test.tsx
```

**Expected:** `Cannot find module '../StatusRing'`.

- [ ] **Step 3: Implement `StatusRing.tsx`**

Create `apps/web/src/routes/home/StatusRing.tsx`:

```tsx
import type { CSSProperties } from 'react';

export interface StatusRingProps {
  taken: number;
  total: number;
  size?: number;
}

const TEAL = '#19AFA2';
const TRACK = '#E5F4F2';
const STROKE_WIDTH = 12;

export function StatusRing({ taken, total, size = 160 }: StatusRingProps) {
  const radius = (size - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = total === 0 ? 0 : Math.max(0, Math.min(1, taken / total));
  const filled = circumference * ratio;
  const gap = circumference - filled;

  const labelStyle: CSSProperties = {
    fontFamily: 'Lexend, sans-serif',
    fontSize: size * 0.22,
    fontWeight: 600,
    fill: '#092C4C',
  };

  return (
    <div
      role="img"
      aria-label={`${taken} of ${total} doses taken today`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={TRACK}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        <circle
          data-testid="ring-progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={TEAL}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${gap}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          style={labelStyle}
        >
          {taken}/{total}
        </text>
      </svg>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm --filter @ayurplex/web test -- src/routes/home/__tests__/StatusRing.test.tsx
```

**Expected:** 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/home/StatusRing.tsx apps/web/src/routes/home/__tests__/StatusRing.test.tsx
git commit -m "feat(home): add StatusRing SVG component in Priya's teal"
```

---

## Task 9: TDD — `DoseRow` component

**Files:**
- Create: `apps/web/src/features/doses/DoseRow.tsx`
- Create: `apps/web/src/features/doses/__tests__/DoseRow.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/doses/__tests__/DoseRow.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ScheduledDose } from '@ayurplex/shared';
import { DoseRow } from '../DoseRow';

const pending: ScheduledDose = {
  id: 'dose-1',
  user_id: 'user-1',
  medication_id: 'med-1',
  schedule_id: 'sch-1',
  scheduled_for: '2026-04-11T13:00:00.000Z',
  adjusted_for: '2026-04-11T13:00:00.000Z',
  adjustment_reason: 'none',
  status: 'pending',
  taken_at: null,
  taken_via: null,
  created_at: '2026-04-11T00:00:00Z',
  updated_at: '2026-04-11T00:00:00Z',
};

describe('DoseRow', () => {
  it('renders med name, local time, and Mark as taken button when pending', () => {
    const onMarkTaken = vi.fn();
    render(
      <DoseRow
        dose={pending}
        medicationName="Metformin"
        timezone="America/Toronto"
        onMarkTaken={onMarkTaken}
      />,
    );
    expect(screen.getByText('Metformin')).toBeInTheDocument();
    // 13:00 UTC → 09:00 EDT
    expect(screen.getByText(/9:00/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /mark as taken/i }));
    expect(onMarkTaken).toHaveBeenCalledWith('dose-1');
  });

  it('shows a checkmark and no button when status is taken', () => {
    render(
      <DoseRow
        dose={{ ...pending, status: 'taken' }}
        medicationName="Metformin"
        timezone="America/Toronto"
        onMarkTaken={() => undefined}
      />,
    );
    expect(screen.getByLabelText(/taken/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mark as taken/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @ayurplex/web test -- src/features/doses/__tests__/DoseRow.test.tsx
```

**Expected:** `Cannot find module '../DoseRow'`.

- [ ] **Step 3: Implement `DoseRow.tsx`**

Create `apps/web/src/features/doses/DoseRow.tsx`:

```tsx
import type { ScheduledDose } from '@ayurplex/shared';
import { formatLocalTime } from '../../lib/date';

export interface DoseRowProps {
  dose: ScheduledDose;
  medicationName: string;
  timezone: string;
  onMarkTaken: (doseId: string) => void;
}

export function DoseRow({
  dose,
  medicationName,
  timezone,
  onMarkTaken,
}: DoseRowProps) {
  const time = formatLocalTime(new Date(dose.scheduled_for), timezone);
  const isTaken = dose.status === 'taken';

  return (
    <div
      data-testid={`dose-row-${dose.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderRadius: 16,
        background: '#FFFFFF',
        boxShadow: '0 1px 4px rgba(9, 44, 76, 0.08)',
      }}
    >
      <div>
        <div
          style={{
            fontFamily: 'Lexend, sans-serif',
            fontSize: 16,
            fontWeight: 500,
            color: '#092C4C',
          }}
        >
          {medicationName}
        </div>
        <div
          style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: 14,
            color: '#4D9999',
          }}
        >
          {time}
        </div>
      </div>
      {isTaken ? (
        <span
          aria-label="Taken"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 16,
            background: '#19AFA2',
            color: '#FFFFFF',
            fontSize: 18,
          }}
        >
          ✓
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onMarkTaken(dose.id)}
          style={{
            fontFamily: 'Lexend, sans-serif',
            fontSize: 14,
            fontWeight: 500,
            color: '#FFFFFF',
            background: '#007972',
            border: 'none',
            borderRadius: 999,
            padding: '8px 16px',
            cursor: 'pointer',
          }}
        >
          Mark as taken
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm --filter @ayurplex/web test -- src/features/doses/__tests__/DoseRow.test.tsx
```

**Expected:** 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/doses/DoseRow.tsx apps/web/src/features/doses/__tests__/DoseRow.test.tsx
git commit -m "feat(doses): add DoseRow component with mark-as-taken button"
```

---

## Task 10: Update Home Dashboard route to use real data

**Files:**
- Modify: `apps/web/src/routes/home/index.tsx`
- Create: `apps/web/src/routes/home/__tests__/home.test.tsx`
- Create: `apps/web/src/features/medications/MedicationListItem.tsx`
- Create: `apps/web/src/features/medications/MedicationList.tsx`
- Create: `apps/web/src/features/medications/__tests__/MedicationList.test.tsx`

- [ ] **Step 1: Write MedicationList test**

Create `apps/web/src/features/medications/__tests__/MedicationList.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Medication } from '@ayurplex/shared';
import { MedicationList } from '../MedicationList';

const metformin: Medication = {
  id: 'med-1',
  user_id: 'user-1',
  name: 'Metformin',
  dosage_amount: 500,
  dosage_unit: 'mg',
  form: 'tablet',
  instructions: 'with food',
  meal_relationship: 'with',
  start_date: '2026-04-11',
  end_date: null,
  prescription_id: null,
  active: true,
  created_at: '2026-04-11T00:00:00Z',
  updated_at: '2026-04-11T00:00:00Z',
};

describe('MedicationList', () => {
  it('renders an empty state when list is empty', () => {
    render(<MedicationList medications={[]} />);
    expect(screen.getByText(/no medications/i)).toBeInTheDocument();
  });

  it('renders one MedicationListItem per row', () => {
    render(<MedicationList medications={[metformin]} />);
    expect(screen.getByText('Metformin')).toBeInTheDocument();
    expect(screen.getByText(/500 mg/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @ayurplex/web test -- src/features/medications/__tests__/MedicationList.test.tsx
```

**Expected:** module-not-found.

- [ ] **Step 3: Implement `MedicationListItem.tsx`**

Create `apps/web/src/features/medications/MedicationListItem.tsx`:

```tsx
import type { Medication } from '@ayurplex/shared';

export interface MedicationListItemProps {
  medication: Medication;
}

export function MedicationListItem({ medication }: MedicationListItemProps) {
  return (
    <li
      data-testid={`med-${medication.id}`}
      style={{
        listStyle: 'none',
        padding: '12px 16px',
        borderRadius: 12,
        background: '#FFFFFF',
        boxShadow: '0 1px 4px rgba(9, 44, 76, 0.08)',
        marginBottom: 8,
      }}
    >
      <div
        style={{
          fontFamily: 'Lexend, sans-serif',
          fontSize: 16,
          fontWeight: 500,
          color: '#092C4C',
        }}
      >
        {medication.name}
      </div>
      <div
        style={{
          fontFamily: 'Roboto, sans-serif',
          fontSize: 14,
          color: '#4D9999',
        }}
      >
        {medication.dosage_amount} {medication.dosage_unit} · {medication.form}
      </div>
    </li>
  );
}
```

- [ ] **Step 4: Implement `MedicationList.tsx`**

Create `apps/web/src/features/medications/MedicationList.tsx`:

```tsx
import type { Medication } from '@ayurplex/shared';
import { MedicationListItem } from './MedicationListItem';

export interface MedicationListProps {
  medications: Medication[];
}

export function MedicationList({ medications }: MedicationListProps) {
  if (medications.length === 0) {
    return (
      <p
        style={{
          fontFamily: 'Roboto, sans-serif',
          fontSize: 14,
          color: '#4D9999',
          textAlign: 'center',
          padding: 24,
        }}
      >
        No medications yet. Tap "+" to add your first one.
      </p>
    );
  }
  return (
    <ul style={{ padding: 0, margin: 0 }}>
      {medications.map((m) => (
        <MedicationListItem key={m.id} medication={m} />
      ))}
    </ul>
  );
}
```

- [ ] **Step 5: Run — expect PASS**

```bash
pnpm --filter @ayurplex/web test -- src/features/medications/__tests__/MedicationList.test.tsx
```

- [ ] **Step 6: Write the failing home route test**

Create `apps/web/src/routes/home/__tests__/home.test.tsx`:

```tsx
import React, { type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HomeRoute } from '../index';

vi.mock('../../../features/doses/api', () => ({
  listDueToday: vi.fn(),
  markTaken: vi.fn(),
  markSkipped: vi.fn(),
}));
vi.mock('../../../features/medications/api', () => ({
  listActiveMedications: vi.fn(),
  createMedication: vi.fn(),
  deactivateMedication: vi.fn(),
  getMedicationById: vi.fn(),
}));
vi.mock('../../../features/profile/useProfile', () => ({
  useProfile: () => ({
    profile: { display_name: 'Test User', timezone: 'America/Toronto' },
    isLoading: false,
  }),
}));

import { listDueToday } from '../../../features/doses/api';
import { listActiveMedications } from '../../../features/medications/api';

function wrap(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <MemoryRouter initialEntries={['/']}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('HomeRoute', () => {
  it('renders the StatusRing with real counts and a list of DoseRow entries', async () => {
    (listDueToday as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'dose-1',
        user_id: 'user-1',
        medication_id: 'med-1',
        schedule_id: 'sch-1',
        scheduled_for: '2026-04-11T13:00:00.000Z',
        adjusted_for: '2026-04-11T13:00:00.000Z',
        adjustment_reason: 'none',
        status: 'pending',
        taken_at: null,
        taken_via: null,
        created_at: '2026-04-11T00:00:00Z',
        updated_at: '2026-04-11T00:00:00Z',
      },
    ]);
    (listActiveMedications as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'med-1',
        user_id: 'user-1',
        name: 'Metformin',
        dosage_amount: 500,
        dosage_unit: 'mg',
        form: 'tablet',
        instructions: null,
        meal_relationship: 'with',
        start_date: '2026-04-11',
        end_date: null,
        prescription_id: null,
        active: true,
        created_at: '2026-04-11T00:00:00Z',
        updated_at: '2026-04-11T00:00:00Z',
      },
    ]);

    render(wrap(<HomeRoute />));

    await waitFor(() => expect(screen.getByText('0/1')).toBeInTheDocument());
    expect(screen.getByText('Metformin')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /add medication/i })).toHaveAttribute(
      'href',
      '/add-med',
    );
  });
});
```

- [ ] **Step 7: Implement the updated home route**

Modify `apps/web/src/routes/home/index.tsx` (replace its contents):

```tsx
import { Link } from 'react-router-dom';
import { useMedications } from '../../features/medications/useMedications';
import { MedicationList } from '../../features/medications/MedicationList';
import { useDueToday } from '../../features/doses/useDueToday';
import { DoseRow } from '../../features/doses/DoseRow';
import { useProfile } from '../../features/profile/useProfile';
import { StatusRing } from './StatusRing';

export function HomeRoute() {
  const { profile } = useProfile();
  const timezone = profile?.timezone ?? 'UTC';
  const { medications } = useMedications();
  const { doses, takenCount, totalCount, markTaken } = useDueToday({ timezone });

  const medNameById = new Map(medications.map((m) => [m.id, m.name]));

  return (
    <main
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: '24px 16px 96px',
        fontFamily: 'Roboto, sans-serif',
      }}
    >
      <header
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <h1
          style={{
            fontFamily: 'Lexend, sans-serif',
            fontSize: 24,
            fontWeight: 600,
            color: '#092C4C',
            margin: '0 0 16px',
          }}
        >
          Hello, {profile?.display_name ?? 'there'}
        </h1>
        <StatusRing taken={takenCount} total={totalCount} />
      </header>

      <section style={{ marginBottom: 32 }}>
        <h2
          style={{
            fontFamily: 'Lexend, sans-serif',
            fontSize: 18,
            color: '#092C4C',
            marginBottom: 12,
          }}
        >
          Today
        </h2>
        {doses.length === 0 ? (
          <p style={{ color: '#4D9999' }}>Nothing due today.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {doses.map((d) => (
              <DoseRow
                key={d.id}
                dose={d}
                medicationName={medNameById.get(d.medication_id) ?? 'Medication'}
                timezone={timezone}
                onMarkTaken={(id) => void markTaken(id)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2
          style={{
            fontFamily: 'Lexend, sans-serif',
            fontSize: 18,
            color: '#092C4C',
            marginBottom: 12,
          }}
        >
          Medications
        </h2>
        <MedicationList medications={medications} />
      </section>

      <Link
        to="/add-med"
        aria-label="Add medication"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: 28,
          background: '#007972',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          textDecoration: 'none',
          boxShadow: '0 4px 12px rgba(0, 121, 114, 0.4)',
        }}
      >
        +
      </Link>
    </main>
  );
}

export default HomeRoute;
```

- [ ] **Step 8: Run home tests — expect PASS**

```bash
pnpm --filter @ayurplex/web test -- src/routes/home
```

**Expected:** StatusRing tests + home.test.tsx all pass.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/routes/home apps/web/src/features/medications/MedicationList.tsx apps/web/src/features/medications/MedicationListItem.tsx apps/web/src/features/medications/__tests__/MedicationList.test.tsx
git commit -m "feat(home): wire Home Dashboard to real doses and medications"
```

---

## Task 11: TDD — `AppleMealIcon` component (4 states)

**Files:**
- Create: `apps/web/src/components/Icon/AppleMealIcon.tsx`
- Create: `apps/web/src/components/Icon/__tests__/AppleMealIcon.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/Icon/__tests__/AppleMealIcon.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MealRelationship } from '@ayurplex/shared';
import { AppleMealIcon } from '../AppleMealIcon';

const states: MealRelationship[] = ['before', 'with', 'after', 'any'];

describe('AppleMealIcon', () => {
  it.each(states)('renders a distinct svg for state "%s"', (state) => {
    const { container } = render(<AppleMealIcon state={state} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('data-state')).toBe(state);
  });

  it('renders visually distinct fills per state', () => {
    const fills = new Set<string>();
    for (const s of states) {
      const { container } = render(<AppleMealIcon state={s} />);
      const apple = container.querySelector('[data-testid="apple-body"]');
      fills.add(apple?.getAttribute('fill') ?? '');
    }
    expect(fills.size).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @ayurplex/web test -- src/components/Icon
```

**Expected:** module not found.

- [ ] **Step 3: Implement `AppleMealIcon.tsx`**

Create `apps/web/src/components/Icon/AppleMealIcon.tsx`:

```tsx
import type { MealRelationship } from '@ayurplex/shared';

export interface AppleMealIconProps {
  state: MealRelationship;
  size?: number;
}

const FILL_BY_STATE: Record<MealRelationship, string> = {
  before: '#F9E169',
  with: '#19AFA2',
  after: '#27879F',
  any: '#4D9999',
};

const LABEL_BY_STATE: Record<MealRelationship, string> = {
  before: 'Before meal',
  with: 'With meal',
  after: 'After meal',
  any: 'Any time',
};

/**
 * Priya's apple-themed meal-relationship icon. Each state renders with a
 * distinct fill. The apple silhouette is identical across states; decorations
 * (bite mark, sparkle, dot) differ per state.
 */
export function AppleMealIcon({ state, size = 64 }: AppleMealIconProps) {
  const fill = FILL_BY_STATE[state];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      data-state={state}
      role="img"
      aria-label={LABEL_BY_STATE[state]}
    >
      {/* Leaf */}
      <path d="M34 12 C38 6, 46 6, 46 14 C40 16, 36 14, 34 12 Z" fill="#007972" />
      {/* Apple body */}
      <path
        data-testid="apple-body"
        d="M32 14 C20 14, 10 24, 10 38 C10 52, 20 58, 32 58 C44 58, 54 52, 54 38 C54 24, 44 14, 32 14 Z"
        fill={fill}
      />
      {/* State-specific decoration */}
      {state === 'before' && (
        <circle cx="48" cy="28" r="4" fill="#FFFFFF" opacity="0.8" />
      )}
      {state === 'with' && (
        <path d="M22 36 L30 44 L44 28" stroke="#FFFFFF" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {state === 'after' && (
        <path d="M44 22 a8 8 0 0 0 -8 8 L52 30 Z" fill="#FFFFFF" opacity="0.9" />
      )}
      {state === 'any' && (
        <text x="32" y="44" textAnchor="middle" fontSize="20" fontFamily="Lexend" fill="#FFFFFF">∗</text>
      )}
    </svg>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm --filter @ayurplex/web test -- src/components/Icon
```

**Expected:** all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/Icon
git commit -m "feat(ui): add AppleMealIcon with 4 meal-relationship states"
```

---

## Task 12: Zod schemas for the Add Med wizard

**Files:**
- Create: `apps/web/src/routes/add-med/schema.ts`
- Create: `apps/web/src/routes/add-med/__tests__/schema.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/routes/add-med/__tests__/schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  nameStepSchema,
  dosageStepSchema,
  mealStepSchema,
  scheduleStepSchema,
  roomStepSchema,
  dateRangeStepSchema,
  addMedFormSchema,
} from '../schema';

describe('Add Med schemas', () => {
  it('nameStepSchema requires a non-empty name', () => {
    expect(nameStepSchema.safeParse({ name: 'Metformin' }).success).toBe(true);
    expect(nameStepSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('dosageStepSchema requires positive amount and allowed form', () => {
    expect(
      dosageStepSchema.safeParse({
        dosage_amount: 500,
        dosage_unit: 'mg',
        form: 'tablet',
        instructions: 'with food',
      }).success,
    ).toBe(true);
    expect(
      dosageStepSchema.safeParse({
        dosage_amount: 0,
        dosage_unit: 'mg',
        form: 'tablet',
        instructions: null,
      }).success,
    ).toBe(false);
    expect(
      dosageStepSchema.safeParse({
        dosage_amount: 10,
        dosage_unit: 'mg',
        form: 'gummy',
        instructions: null,
      }).success,
    ).toBe(false);
  });

  it('mealStepSchema accepts the 4 meal_relationship values', () => {
    for (const m of ['before', 'with', 'after', 'any'] as const) {
      expect(mealStepSchema.safeParse({ meal_relationship: m }).success).toBe(true);
    }
    expect(mealStepSchema.safeParse({ meal_relationship: 'later' }).success).toBe(
      false,
    );
  });

  it('scheduleStepSchema requires at least one window with end >= start', () => {
    expect(
      scheduleStepSchema.safeParse({
        frequency: 'daily',
        times_of_day: [{ window_start: '08:00', window_end: '10:00' }],
        days_of_week: [1, 2, 3, 4, 5],
      }).success,
    ).toBe(true);
    expect(
      scheduleStepSchema.safeParse({
        frequency: 'daily',
        times_of_day: [],
        days_of_week: [1],
      }).success,
    ).toBe(false);
    expect(
      scheduleStepSchema.safeParse({
        frequency: 'daily',
        times_of_day: [{ window_start: '10:00', window_end: '08:00' }],
        days_of_week: [1],
      }).success,
    ).toBe(false);
  });

  it('roomStepSchema allows null room', () => {
    expect(roomStepSchema.safeParse({ preferred_room_id: null }).success).toBe(true);
    expect(
      roomStepSchema.safeParse({ preferred_room_id: 'some-uuid' }).success,
    ).toBe(true);
  });

  it('dateRangeStepSchema requires start_date and allows null end', () => {
    expect(
      dateRangeStepSchema.safeParse({
        start_date: '2026-04-11',
        end_date: null,
      }).success,
    ).toBe(true);
    expect(
      dateRangeStepSchema.safeParse({
        start_date: '2026-04-11',
        end_date: '2026-04-10',
      }).success,
    ).toBe(false);
  });

  it('addMedFormSchema parses the full payload', () => {
    const parsed = addMedFormSchema.parse({
      name: 'Metformin',
      dosage_amount: 500,
      dosage_unit: 'mg',
      form: 'tablet',
      instructions: 'with food',
      meal_relationship: 'with',
      frequency: 'daily',
      times_of_day: [{ window_start: '08:00', window_end: '10:00' }],
      days_of_week: [1, 2, 3, 4, 5],
      preferred_room_id: null,
      start_date: '2026-04-11',
      end_date: null,
    });
    expect(parsed.name).toBe('Metformin');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @ayurplex/web test -- src/routes/add-med/__tests__/schema.test.ts
```

- [ ] **Step 3: Implement `schema.ts`**

Create `apps/web/src/routes/add-med/schema.ts`:

```ts
import { z } from 'zod';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const nameStepSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
});

export const dosageStepSchema = z.object({
  dosage_amount: z.number().positive('Must be greater than 0'),
  dosage_unit: z.string().min(1).max(20),
  form: z.enum(['tablet', 'capsule', 'liquid']),
  instructions: z.string().max(500).nullable(),
});

export const mealStepSchema = z.object({
  meal_relationship: z.enum(['before', 'with', 'after', 'any']),
});

const timeWindowSchema = z
  .object({
    window_start: z.string().regex(TIME_RE, 'Use HH:MM 24h format'),
    window_end: z.string().regex(TIME_RE, 'Use HH:MM 24h format'),
  })
  .refine(
    (w) => w.window_end >= w.window_start,
    { message: 'End must be after start', path: ['window_end'] },
  );

export const scheduleStepSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'as_needed']),
  times_of_day: z.array(timeWindowSchema).min(1, 'Add at least one time window'),
  days_of_week: z
    .array(z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7)]))
    .min(1, 'Select at least one day'),
});

export const roomStepSchema = z.object({
  preferred_room_id: z.string().uuid().nullable().or(z.literal(null)),
});

export const dateRangeStepSchema = z
  .object({
    start_date: z.string().regex(ISO_DATE_RE, 'Use YYYY-MM-DD'),
    end_date: z.string().regex(ISO_DATE_RE).nullable(),
  })
  .refine(
    (v) => v.end_date === null || v.end_date >= v.start_date,
    { message: 'End date must be on or after start date', path: ['end_date'] },
  );

export const addMedFormSchema = z.object({
  name: z.string().min(1),
  dosage_amount: z.number().positive(),
  dosage_unit: z.string().min(1),
  form: z.enum(['tablet', 'capsule', 'liquid']),
  instructions: z.string().nullable(),
  meal_relationship: z.enum(['before', 'with', 'after', 'any']),
  frequency: z.enum(['daily', 'weekly', 'as_needed']),
  times_of_day: z.array(timeWindowSchema).min(1),
  days_of_week: z
    .array(z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7)]))
    .min(1),
  preferred_room_id: z.string().uuid().nullable(),
  start_date: z.string().regex(ISO_DATE_RE),
  end_date: z.string().regex(ISO_DATE_RE).nullable(),
});

export type AddMedFormData = z.infer<typeof addMedFormSchema>;
```

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm --filter @ayurplex/web test -- src/routes/add-med/__tests__/schema.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/add-med/schema.ts apps/web/src/routes/add-med/__tests__/schema.test.ts
git commit -m "feat(add-med): add Zod schemas for each wizard step"
```

---

## Task 13: TDD — Add Med wizard state machine

**Files:**
- Create: `apps/web/src/routes/add-med/AddMedWizard.tsx`
- Create: `apps/web/src/routes/add-med/__tests__/AddMedWizard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/routes/add-med/__tests__/AddMedWizard.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AddMedWizard } from '../AddMedWizard';

vi.mock('../../../features/rooms/api', () => ({
  listRooms: vi.fn(async () => []),
  createRoom: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks();

describe('AddMedWizard', () => {
  it('walks through the 7 steps and calls onSubmit with combined data', async () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<AddMedWizard onSubmit={onSubmit} onClose={onClose} />);

    // Step 1: name
    expect(screen.getByText(/name/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/medication name/i), {
      target: { value: 'Metformin' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 2: dosage
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText(/unit/i), { target: { value: 'mg' } });
    fireEvent.change(screen.getByLabelText(/form/i), { target: { value: 'tablet' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 3: meal
    fireEvent.click(screen.getByLabelText(/with meal/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 4: schedule
    fireEvent.change(screen.getByLabelText(/window start/i), {
      target: { value: '08:00' },
    });
    fireEvent.change(screen.getByLabelText(/window end/i), {
      target: { value: '10:00' },
    });
    fireEvent.click(screen.getByLabelText(/monday/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 5: room (skip — no rooms)
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 6: date range
    fireEvent.change(screen.getByLabelText(/start date/i), {
      target: { value: '2026-04-11' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 7: review
    expect(screen.getByText(/review/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /save medication/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.name).toBe('Metformin');
    expect(payload.dosage_amount).toBe(500);
    expect(payload.meal_relationship).toBe('with');
    expect(payload.times_of_day).toEqual([{ window_start: '08:00', window_end: '10:00' }]);
    expect(payload.days_of_week).toEqual([1]);
    expect(payload.start_date).toBe('2026-04-11');
  });

  it('Back button returns to the previous step', () => {
    render(<AddMedWizard onSubmit={() => undefined} onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText(/medication name/i), {
      target: { value: 'Metformin' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByLabelText(/medication name/i)).toBeInTheDocument();
  });
});
```

**Note:** Fix the accidental typo before running — `beforeEach(() => vi.clearAllMocks();` should be `beforeEach(() => { vi.clearAllMocks(); });`. Use the corrected version in the actual test file:

```tsx
beforeEach(() => {
  vi.clearAllMocks();
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @ayurplex/web test -- src/routes/add-med/__tests__/AddMedWizard.test.tsx
```

**Expected:** `Cannot find module '../AddMedWizard'`.

- [ ] **Step 3: Implement `AddMedWizard.tsx`**

Create `apps/web/src/routes/add-med/AddMedWizard.tsx`:

```tsx
import { useReducer, useCallback } from 'react';
import type { AddMedFormData } from './schema';
import { NameStep } from './steps/NameStep';
import { DosageStep } from './steps/DosageStep';
import { MealRelationshipStep } from './steps/MealRelationshipStep';
import { ScheduleStep } from './steps/ScheduleStep';
import { RoomStep } from './steps/RoomStep';
import { DateRangeStep } from './steps/DateRangeStep';
import { ReviewStep } from './steps/ReviewStep';

const STEPS = ['name', 'dosage', 'meal', 'schedule', 'room', 'dates', 'review'] as const;
type StepId = (typeof STEPS)[number];

export type PartialAddMedData = Partial<AddMedFormData>;

interface WizardState {
  step: number;
  data: PartialAddMedData;
}

type Action =
  | { type: 'next'; patch: PartialAddMedData }
  | { type: 'back' }
  | { type: 'patch'; patch: PartialAddMedData };

function reducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case 'next':
      return {
        step: Math.min(state.step + 1, STEPS.length - 1),
        data: { ...state.data, ...action.patch },
      };
    case 'back':
      return { ...state, step: Math.max(state.step - 1, 0) };
    case 'patch':
      return { ...state, data: { ...state.data, ...action.patch } };
    default:
      return state;
  }
}

export interface AddMedWizardProps {
  onSubmit: (data: AddMedFormData) => void;
  onClose: () => void;
  initial?: PartialAddMedData;
}

export function AddMedWizard({ onSubmit, onClose, initial }: AddMedWizardProps) {
  const [state, dispatch] = useReducer(reducer, {
    step: 0,
    data: initial ?? {
      frequency: 'daily',
      days_of_week: [],
      times_of_day: [],
      preferred_room_id: null,
      end_date: null,
      instructions: null,
    },
  });

  const currentStep: StepId = STEPS[state.step];

  const next = useCallback(
    (patch: PartialAddMedData) => dispatch({ type: 'next', patch }),
    [],
  );
  const back = useCallback(() => dispatch({ type: 'back' }), []);

  const handleSubmit = useCallback(() => {
    onSubmit(state.data as AddMedFormData);
  }, [onSubmit, state.data]);

  return (
    <div data-testid="add-med-wizard">
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}
        >
          ×
        </button>
        <div
          style={{
            fontFamily: 'Lexend, sans-serif',
            fontSize: 14,
            color: '#4D9999',
          }}
        >
          Step {state.step + 1} of {STEPS.length}
        </div>
      </header>

      <div style={{ padding: '0 16px' }}>
        {currentStep === 'name' && (
          <NameStep data={state.data} onNext={next} />
        )}
        {currentStep === 'dosage' && (
          <DosageStep data={state.data} onNext={next} onBack={back} />
        )}
        {currentStep === 'meal' && (
          <MealRelationshipStep data={state.data} onNext={next} onBack={back} />
        )}
        {currentStep === 'schedule' && (
          <ScheduleStep data={state.data} onNext={next} onBack={back} />
        )}
        {currentStep === 'room' && (
          <RoomStep data={state.data} onNext={next} onBack={back} />
        )}
        {currentStep === 'dates' && (
          <DateRangeStep data={state.data} onNext={next} onBack={back} />
        )}
        {currentStep === 'review' && (
          <ReviewStep data={state.data} onBack={back} onSubmit={handleSubmit} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Stub each step so the wizard test has something to render**

You will implement the steps in full during Tasks 14–20; for now, create minimal stubs that accept/propagate `onNext`. Temporarily create each step file with the MINIMAL shape below. Tasks 14–20 will replace each stub with the real implementation under TDD.

Create stubs (replaced in later tasks):

`apps/web/src/routes/add-med/steps/NameStep.tsx`:

```tsx
import { useState } from 'react';
import type { PartialAddMedData } from '../AddMedWizard';

export interface StepProps {
  data: PartialAddMedData;
  onNext: (patch: PartialAddMedData) => void;
  onBack?: () => void;
}

export function NameStep({ data, onNext }: StepProps) {
  const [name, setName] = useState(data.name ?? '');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onNext({ name });
      }}
    >
      <label>
        Medication name
        <input
          aria-label="Medication name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <button type="submit">Next</button>
    </form>
  );
}
```

Create equivalent minimal stubs for `DosageStep`, `MealRelationshipStep`, `ScheduleStep`, `RoomStep`, `DateRangeStep`, and `ReviewStep`. Each stub:

- Accepts `{ data, onNext, onBack }`.
- Renders the fields listed in the wizard test.
- Has a "Next" / "Save medication" button that calls `onNext` / `onSubmit` with the typed-in values.

The full implementations come in Tasks 14–20.

- [ ] **Step 5: Run wizard test — expect PASS**

```bash
pnpm --filter @ayurplex/web test -- src/routes/add-med/__tests__/AddMedWizard.test.tsx
```

**Expected:** both tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/add-med/AddMedWizard.tsx apps/web/src/routes/add-med/steps apps/web/src/routes/add-med/__tests__/AddMedWizard.test.tsx
git commit -m "feat(add-med): add wizard state machine and step stubs"
```

---

## Task 14: `NameStep` — full implementation

**Files:**
- Modify: `apps/web/src/routes/add-med/steps/NameStep.tsx`
- Create: `apps/web/src/routes/add-med/steps/__tests__/NameStep.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/routes/add-med/steps/__tests__/NameStep.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NameStep } from '../NameStep';

describe('NameStep', () => {
  it('calls onNext with the entered name', () => {
    const onNext = vi.fn();
    render(<NameStep data={{}} onNext={onNext} />);
    fireEvent.change(screen.getByLabelText(/medication name/i), {
      target: { value: 'Metformin' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onNext).toHaveBeenCalledWith({ name: 'Metformin' });
  });

  it('shows an error when submitting an empty name', () => {
    const onNext = vi.fn();
    render(<NameStep data={{}} onNext={onNext} />);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect FAIL (error state missing)**

```bash
pnpm --filter @ayurplex/web test -- src/routes/add-med/steps/__tests__/NameStep.test.tsx
```

- [ ] **Step 3: Replace `NameStep.tsx` with the full implementation**

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { nameStepSchema } from '../schema';
import type { PartialAddMedData } from '../AddMedWizard';

export interface StepProps {
  data: PartialAddMedData;
  onNext: (patch: PartialAddMedData) => void;
  onBack?: () => void;
}

interface NameFields {
  name: string;
}

export function NameStep({ data, onNext }: StepProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NameFields>({
    resolver: zodResolver(nameStepSchema),
    defaultValues: { name: data.name ?? '' },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => onNext({ name: values.name }))}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <h2
        style={{
          fontFamily: 'Lexend, sans-serif',
          fontSize: 22,
          color: '#092C4C',
        }}
      >
        What's the medication name?
      </h2>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: 14 }}>
          Medication name
        </span>
        <input
          aria-label="Medication name"
          {...register('name')}
          style={{
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid #E5F4F2',
            fontSize: 16,
          }}
        />
        {errors.name && (
          <span style={{ color: '#B3261E', fontSize: 12 }}>
            {errors.name.message === 'Required' ? 'Name is required' : errors.name.message}
          </span>
        )}
      </label>
      <button
        type="submit"
        style={{
          alignSelf: 'flex-end',
          background: '#007972',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 999,
          padding: '12px 24px',
          cursor: 'pointer',
        }}
      >
        Next
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm --filter @ayurplex/web test -- src/routes/add-med/steps/__tests__/NameStep.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/add-med/steps/NameStep.tsx apps/web/src/routes/add-med/steps/__tests__/NameStep.test.tsx
git commit -m "feat(add-med): complete NameStep with React Hook Form + Zod"
```

---

## Task 15: `DosageStep` — full implementation

**Files:**
- Modify: `apps/web/src/routes/add-med/steps/DosageStep.tsx`
- Create: `apps/web/src/routes/add-med/steps/__tests__/DosageStep.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/routes/add-med/steps/__tests__/DosageStep.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DosageStep } from '../DosageStep';

describe('DosageStep', () => {
  it('submits amount, unit, form and optional instructions', async () => {
    const onNext = vi.fn();
    render(<DosageStep data={{}} onNext={onNext} onBack={() => undefined} />);

    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText(/unit/i), { target: { value: 'mg' } });
    fireEvent.change(screen.getByLabelText(/form/i), { target: { value: 'tablet' } });
    fireEvent.change(screen.getByLabelText(/instructions/i), {
      target: { value: 'with food' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await vi.waitFor(() => expect(onNext).toHaveBeenCalled());
    expect(onNext).toHaveBeenCalledWith({
      dosage_amount: 500,
      dosage_unit: 'mg',
      form: 'tablet',
      instructions: 'with food',
    });
  });

  it('shows an error for zero or negative amount', async () => {
    const onNext = vi.fn();
    render(<DosageStep data={{}} onNext={onNext} onBack={() => undefined} />);
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText(/unit/i), { target: { value: 'mg' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await vi.waitFor(() =>
      expect(screen.getByText(/greater than 0/i)).toBeInTheDocument(),
    );
    expect(onNext).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @ayurplex/web test -- src/routes/add-med/steps/__tests__/DosageStep.test.tsx
```

- [ ] **Step 3: Implement `DosageStep.tsx`**

Replace the stub with:

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { dosageStepSchema } from '../schema';
import type { PartialAddMedData } from '../AddMedWizard';

export interface StepProps {
  data: PartialAddMedData;
  onNext: (patch: PartialAddMedData) => void;
  onBack: () => void;
}

interface DosageFields {
  dosage_amount: number;
  dosage_unit: string;
  form: 'tablet' | 'capsule' | 'liquid';
  instructions: string | null;
}

export function DosageStep({ data, onNext, onBack }: StepProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DosageFields>({
    resolver: zodResolver(dosageStepSchema),
    defaultValues: {
      dosage_amount: data.dosage_amount ?? 0,
      dosage_unit: data.dosage_unit ?? 'mg',
      form: data.form ?? 'tablet',
      instructions: data.instructions ?? null,
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) =>
        onNext({
          dosage_amount: values.dosage_amount,
          dosage_unit: values.dosage_unit,
          form: values.form,
          instructions: values.instructions || null,
        }),
      )}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <h2 style={{ fontFamily: 'Lexend, sans-serif', fontSize: 22, color: '#092C4C' }}>
        How much and what form?
      </h2>

      <label>
        <span>Amount</span>
        <input
          aria-label="Amount"
          type="number"
          step="any"
          {...register('dosage_amount', { valueAsNumber: true })}
        />
        {errors.dosage_amount && (
          <span style={{ color: '#B3261E' }}>{errors.dosage_amount.message}</span>
        )}
      </label>

      <label>
        <span>Unit</span>
        <input aria-label="Unit" type="text" {...register('dosage_unit')} />
      </label>

      <label>
        <span>Form</span>
        <select aria-label="Form" {...register('form')}>
          <option value="tablet">Tablet</option>
          <option value="capsule">Capsule</option>
          <option value="liquid">Liquid</option>
        </select>
      </label>

      <label>
        <span>Instructions (optional)</span>
        <input
          aria-label="Instructions"
          type="text"
          {...register('instructions')}
        />
      </label>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" onClick={onBack}>
          Back
        </button>
        <button type="submit">Next</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm --filter @ayurplex/web test -- src/routes/add-med/steps/__tests__/DosageStep.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/add-med/steps/DosageStep.tsx apps/web/src/routes/add-med/steps/__tests__/DosageStep.test.tsx
git commit -m "feat(add-med): complete DosageStep with validation"
```

---

## Task 16: `MealRelationshipStep` — full implementation with apple icons

**Files:**
- Modify: `apps/web/src/routes/add-med/steps/MealRelationshipStep.tsx`
- Create: `apps/web/src/routes/add-med/__tests__/MealRelationshipStep.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/routes/add-med/__tests__/MealRelationshipStep.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MealRelationshipStep } from '../steps/MealRelationshipStep';

describe('MealRelationshipStep', () => {
  it('renders an AppleMealIcon for each of the 4 options', () => {
    render(
      <MealRelationshipStep data={{}} onNext={() => undefined} onBack={() => undefined} />,
    );
    expect(screen.getByLabelText(/before meal/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/with meal/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/after meal/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/any time/i)).toBeInTheDocument();
  });

  it('calls onNext with the selected meal_relationship', () => {
    const onNext = vi.fn();
    render(
      <MealRelationshipStep data={{}} onNext={onNext} onBack={() => undefined} />,
    );
    fireEvent.click(screen.getByLabelText(/with meal/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onNext).toHaveBeenCalledWith({ meal_relationship: 'with' });
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @ayurplex/web test -- src/routes/add-med/__tests__/MealRelationshipStep.test.tsx
```

- [ ] **Step 3: Implement `MealRelationshipStep.tsx`**

Replace the stub with:

```tsx
import { useState } from 'react';
import type { MealRelationship } from '@ayurplex/shared';
import { AppleMealIcon } from '../../../components/Icon/AppleMealIcon';
import type { PartialAddMedData } from '../AddMedWizard';

export interface StepProps {
  data: PartialAddMedData;
  onNext: (patch: PartialAddMedData) => void;
  onBack: () => void;
}

const OPTIONS: { value: MealRelationship; label: string }[] = [
  { value: 'before', label: 'Before meal' },
  { value: 'with', label: 'With meal' },
  { value: 'after', label: 'After meal' },
  { value: 'any', label: 'Any time' },
];

export function MealRelationshipStep({ data, onNext, onBack }: StepProps) {
  const [selected, setSelected] = useState<MealRelationship>(
    data.meal_relationship ?? 'any',
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2
        style={{
          fontFamily: 'Lexend, sans-serif',
          fontSize: 22,
          color: '#092C4C',
        }}
      >
        When do you take it?
      </h2>

      <div
        role="radiogroup"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
        }}
      >
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            aria-label={opt.label}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: 16,
              borderRadius: 16,
              border:
                selected === opt.value
                  ? '2px solid #19AFA2'
                  : '2px solid transparent',
              background: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="meal_relationship"
              value={opt.value}
              checked={selected === opt.value}
              onChange={() => setSelected(opt.value)}
              style={{ position: 'absolute', opacity: 0 }}
            />
            <AppleMealIcon state={opt.value} size={72} />
            <span
              style={{
                fontFamily: 'Lexend, sans-serif',
                fontSize: 14,
                color: '#092C4C',
                marginTop: 8,
              }}
            >
              {opt.label}
            </span>
          </label>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          onClick={() => onNext({ meal_relationship: selected })}
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm --filter @ayurplex/web test -- src/routes/add-med/__tests__/MealRelationshipStep.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/add-med/steps/MealRelationshipStep.tsx apps/web/src/routes/add-med/__tests__/MealRelationshipStep.test.tsx
git commit -m "feat(add-med): complete MealRelationshipStep with apple icons"
```

---

## Task 17: `ScheduleStep` — full implementation

**Files:**
- Modify: `apps/web/src/routes/add-med/steps/ScheduleStep.tsx`
- Create: `apps/web/src/routes/add-med/__tests__/ScheduleStep.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/routes/add-med/__tests__/ScheduleStep.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScheduleStep } from '../steps/ScheduleStep';

describe('ScheduleStep', () => {
  it('emits times_of_day and days_of_week on submit', () => {
    const onNext = vi.fn();
    render(<ScheduleStep data={{}} onNext={onNext} onBack={() => undefined} />);

    fireEvent.change(screen.getByLabelText(/window start/i), {
      target: { value: '08:00' },
    });
    fireEvent.change(screen.getByLabelText(/window end/i), {
      target: { value: '10:00' },
    });
    fireEvent.click(screen.getByLabelText(/monday/i));
    fireEvent.click(screen.getByLabelText(/wednesday/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(onNext).toHaveBeenCalledWith({
      frequency: 'daily',
      times_of_day: [{ window_start: '08:00', window_end: '10:00' }],
      days_of_week: [1, 3],
    });
  });

  it('shows an error when no days are selected', () => {
    const onNext = vi.fn();
    render(<ScheduleStep data={{}} onNext={onNext} onBack={() => undefined} />);
    fireEvent.change(screen.getByLabelText(/window start/i), {
      target: { value: '08:00' },
    });
    fireEvent.change(screen.getByLabelText(/window end/i), {
      target: { value: '10:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/at least one day/i)).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @ayurplex/web test -- src/routes/add-med/__tests__/ScheduleStep.test.tsx
```

- [ ] **Step 3: Implement `ScheduleStep.tsx`**

Replace the stub with:

```tsx
import { useState } from 'react';
import type { DayOfWeek, TimeWindow } from '@ayurplex/shared';
import type { PartialAddMedData } from '../AddMedWizard';

export interface StepProps {
  data: PartialAddMedData;
  onNext: (patch: PartialAddMedData) => void;
  onBack: () => void;
}

const DAY_LABELS: { value: DayOfWeek; label: string }[] = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
];

export function ScheduleStep({ data, onNext, onBack }: StepProps) {
  const initial: TimeWindow = data.times_of_day?.[0] ?? {
    window_start: '08:00',
    window_end: '10:00',
  };
  const [start, setStart] = useState(initial.window_start);
  const [end, setEnd] = useState(initial.window_end);
  const [days, setDays] = useState<DayOfWeek[]>(
    (data.days_of_week as DayOfWeek[]) ?? [],
  );
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (d: DayOfWeek) => {
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );
  };

  const handleNext = () => {
    if (days.length === 0) {
      setError('Select at least one day');
      return;
    }
    if (end < start) {
      setError('End must be after start');
      return;
    }
    setError(null);
    onNext({
      frequency: 'daily',
      times_of_day: [{ window_start: start, window_end: end }],
      days_of_week: days,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2
        style={{
          fontFamily: 'Lexend, sans-serif',
          fontSize: 22,
          color: '#092C4C',
        }}
      >
        When should we remind you?
      </h2>

      <label>
        <span>Window start</span>
        <input
          aria-label="Window start"
          type="time"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
      </label>
      <label>
        <span>Window end</span>
        <input
          aria-label="Window end"
          type="time"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </label>

      <fieldset>
        <legend>Days</legend>
        {DAY_LABELS.map((d) => (
          <label
            key={d.value}
            style={{ display: 'inline-flex', alignItems: 'center', marginRight: 8 }}
          >
            <input
              type="checkbox"
              aria-label={d.label}
              checked={days.includes(d.value)}
              onChange={() => toggleDay(d.value)}
            />
            {d.label.slice(0, 3)}
          </label>
        ))}
      </fieldset>

      {error && <p style={{ color: '#B3261E' }}>{error}</p>}

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" onClick={onBack}>
          Back
        </button>
        <button type="button" onClick={handleNext}>
          Next
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm --filter @ayurplex/web test -- src/routes/add-med/__tests__/ScheduleStep.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/add-med/steps/ScheduleStep.tsx apps/web/src/routes/add-med/__tests__/ScheduleStep.test.tsx
git commit -m "feat(add-med): complete ScheduleStep with time windows and days"
```

---

## Task 18: `RoomStep` — full implementation (+ `createRoom` API)

**Files:**
- Modify: `apps/web/src/features/rooms/api.ts` (add `createRoom`)
- Modify: `apps/web/src/routes/add-med/steps/RoomStep.tsx`
- Create: `apps/web/src/routes/add-med/steps/__tests__/RoomStep.test.tsx`

- [ ] **Step 1: Add `createRoom` to rooms API**

Edit `apps/web/src/features/rooms/api.ts`. Add at the bottom:

```ts
/** Insert a new room for the current user. */
export async function createRoom(input: {
  name: string;
  icon: string | null;
}): Promise<import('@ayurplex/shared').Room> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!userData.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('rooms')
    .insert({
      user_id: userData.user.id,
      name: input.name,
      icon: input.icon,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as import('@ayurplex/shared').Room;
}
```

- [ ] **Step 2: Write the failing test**

Create `apps/web/src/routes/add-med/steps/__tests__/RoomStep.test.tsx`:

```tsx
import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RoomStep } from '../RoomStep';

vi.mock('../../../../features/rooms/api', () => ({
  listRooms: vi.fn(),
  createRoom: vi.fn(),
}));

import { listRooms, createRoom } from '../../../../features/rooms/api';

function wrap(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RoomStep', () => {
  it('lists rooms and lets the user select one', async () => {
    (listRooms as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'room-1', user_id: 'user-1', name: 'Kitchen', icon: null, created_at: '', updated_at: '' },
      { id: 'room-2', user_id: 'user-1', name: 'Bedroom', icon: null, created_at: '', updated_at: '' },
    ]);
    const onNext = vi.fn();

    render(wrap(<RoomStep data={{}} onNext={onNext} onBack={() => undefined} />));

    await waitFor(() => expect(screen.getByText('Kitchen')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Kitchen'));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onNext).toHaveBeenCalledWith({ preferred_room_id: 'room-1' });
  });

  it('lets the user add a new room inline', async () => {
    (listRooms as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (createRoom as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'room-new',
      user_id: 'user-1',
      name: 'Office',
      icon: null,
      created_at: '',
      updated_at: '',
    });

    const onNext = vi.fn();
    render(wrap(<RoomStep data={{}} onNext={onNext} onBack={() => undefined} />));

    await waitFor(() => expect(screen.getByRole('button', { name: /add a new room/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /add a new room/i }));
    fireEvent.change(screen.getByLabelText(/new room name/i), {
      target: { value: 'Office' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create room/i }));

    await waitFor(() =>
      expect(createRoom).toHaveBeenCalledWith({ name: 'Office', icon: null }),
    );
  });

  it('allows skipping room selection', async () => {
    (listRooms as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const onNext = vi.fn();
    render(wrap(<RoomStep data={{}} onNext={onNext} onBack={() => undefined} />));
    await waitFor(() => expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onNext).toHaveBeenCalledWith({ preferred_room_id: null });
  });
});
```

- [ ] **Step 3: Run — expect FAIL**

```bash
pnpm --filter @ayurplex/web test -- src/routes/add-med/steps/__tests__/RoomStep.test.tsx
```

- [ ] **Step 4: Implement `RoomStep.tsx`**

Replace the stub:

```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listRooms, createRoom } from '../../../features/rooms/api';
import type { PartialAddMedData } from '../AddMedWizard';

export interface StepProps {
  data: PartialAddMedData;
  onNext: (patch: PartialAddMedData) => void;
  onBack: () => void;
}

export function RoomStep({ data, onNext, onBack }: StepProps) {
  const qc = useQueryClient();
  const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: listRooms });
  const [selected, setSelected] = useState<string | null>(
    data.preferred_room_id ?? null,
  );
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');

  const createMut = useMutation({
    mutationFn: (name: string) => createRoom({ name, icon: null }),
    onSuccess: (room) => {
      qc.invalidateQueries({ queryKey: ['rooms'] });
      setSelected(room.id);
      setShowNew(false);
      setNewName('');
    },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontFamily: 'Lexend, sans-serif', fontSize: 22, color: '#092C4C' }}>
        Preferred room? (optional)
      </h2>

      {roomsQuery.isLoading && <p>Loading…</p>}
      {roomsQuery.data?.length === 0 && !showNew && (
        <p style={{ color: '#4D9999' }}>No rooms yet — you can skip or add one.</p>
      )}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {(roomsQuery.data ?? []).map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => setSelected(r.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: 12,
                borderRadius: 12,
                border:
                  selected === r.id
                    ? '2px solid #19AFA2'
                    : '1px solid #E5F4F2',
                background: '#FFFFFF',
                marginBottom: 8,
                cursor: 'pointer',
              }}
            >
              {r.name}
            </button>
          </li>
        ))}
      </ul>

      {showNew ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label>
            <span>New room name</span>
            <input
              aria-label="New room name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() => newName && createMut.mutate(newName)}
          >
            Create room
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setShowNew(true)}>
          Add a new room
        </button>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          onClick={() => onNext({ preferred_room_id: selected })}
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run — expect PASS**

```bash
pnpm --filter @ayurplex/web test -- src/routes/add-med/steps/__tests__/RoomStep.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/rooms/api.ts apps/web/src/routes/add-med/steps/RoomStep.tsx apps/web/src/routes/add-med/steps/__tests__/RoomStep.test.tsx
git commit -m "feat(add-med): complete RoomStep with inline createRoom"
```

---

## Task 19: `DateRangeStep` — full implementation

**Files:**
- Modify: `apps/web/src/routes/add-med/steps/DateRangeStep.tsx`
- Create: `apps/web/src/routes/add-med/steps/__tests__/DateRangeStep.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/routes/add-med/steps/__tests__/DateRangeStep.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DateRangeStep } from '../DateRangeStep';

describe('DateRangeStep', () => {
  it('emits start_date and null end_date by default', () => {
    const onNext = vi.fn();
    render(<DateRangeStep data={{}} onNext={onNext} onBack={() => undefined} />);
    fireEvent.change(screen.getByLabelText(/start date/i), {
      target: { value: '2026-04-11' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onNext).toHaveBeenCalledWith({
      start_date: '2026-04-11',
      end_date: null,
    });
  });

  it('shows an error when end_date precedes start_date', () => {
    const onNext = vi.fn();
    render(<DateRangeStep data={{}} onNext={onNext} onBack={() => undefined} />);
    fireEvent.change(screen.getByLabelText(/start date/i), {
      target: { value: '2026-04-11' },
    });
    fireEvent.change(screen.getByLabelText(/end date/i), {
      target: { value: '2026-04-10' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/on or after/i)).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @ayurplex/web test -- src/routes/add-med/steps/__tests__/DateRangeStep.test.tsx
```

- [ ] **Step 3: Implement `DateRangeStep.tsx`**

Replace the stub:

```tsx
import { useState } from 'react';
import type { PartialAddMedData } from '../AddMedWizard';

export interface StepProps {
  data: PartialAddMedData;
  onNext: (patch: PartialAddMedData) => void;
  onBack: () => void;
}

export function DateRangeStep({ data, onNext, onBack }: StepProps) {
  const [start, setStart] = useState(data.start_date ?? '');
  const [end, setEnd] = useState(data.end_date ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleNext = () => {
    if (!start) {
      setError('Start date is required');
      return;
    }
    if (end && end < start) {
      setError('End date must be on or after start date');
      return;
    }
    setError(null);
    onNext({ start_date: start, end_date: end || null });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontFamily: 'Lexend, sans-serif', fontSize: 22, color: '#092C4C' }}>
        When does it start and end?
      </h2>
      <label>
        <span>Start date</span>
        <input
          aria-label="Start date"
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
      </label>
      <label>
        <span>End date (optional)</span>
        <input
          aria-label="End date"
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </label>
      {error && <p style={{ color: '#B3261E' }}>{error}</p>}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" onClick={onBack}>
          Back
        </button>
        <button type="button" onClick={handleNext}>
          Next
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm --filter @ayurplex/web test -- src/routes/add-med/steps/__tests__/DateRangeStep.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/add-med/steps/DateRangeStep.tsx apps/web/src/routes/add-med/steps/__tests__/DateRangeStep.test.tsx
git commit -m "feat(add-med): complete DateRangeStep"
```

---

## Task 20: `ReviewStep` — summary + save

**Files:**
- Modify: `apps/web/src/routes/add-med/steps/ReviewStep.tsx`
- Create: `apps/web/src/routes/add-med/steps/__tests__/ReviewStep.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/routes/add-med/steps/__tests__/ReviewStep.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReviewStep } from '../ReviewStep';

const fullData = {
  name: 'Metformin',
  dosage_amount: 500,
  dosage_unit: 'mg',
  form: 'tablet' as const,
  instructions: 'with food',
  meal_relationship: 'with' as const,
  frequency: 'daily' as const,
  times_of_day: [{ window_start: '08:00', window_end: '10:00' }],
  days_of_week: [1, 2, 3, 4, 5] as (1 | 2 | 3 | 4 | 5 | 6 | 7)[],
  preferred_room_id: null,
  start_date: '2026-04-11',
  end_date: null,
};

describe('ReviewStep', () => {
  it('renders a summary of all entered data', () => {
    render(
      <ReviewStep data={fullData} onSubmit={() => undefined} onBack={() => undefined} />,
    );
    expect(screen.getByText(/metformin/i)).toBeInTheDocument();
    expect(screen.getByText(/500 mg/i)).toBeInTheDocument();
    expect(screen.getByText(/with meal/i)).toBeInTheDocument();
    expect(screen.getByText(/08:00 – 10:00/)).toBeInTheDocument();
    expect(screen.getByText(/2026-04-11/)).toBeInTheDocument();
  });

  it('invokes onSubmit when Save medication is clicked', () => {
    const onSubmit = vi.fn();
    render(
      <ReviewStep data={fullData} onSubmit={onSubmit} onBack={() => undefined} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /save medication/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @ayurplex/web test -- src/routes/add-med/steps/__tests__/ReviewStep.test.tsx
```

- [ ] **Step 3: Implement `ReviewStep.tsx`**

Replace the stub:

```tsx
import type { PartialAddMedData } from '../AddMedWizard';

export interface StepProps {
  data: PartialAddMedData;
  onSubmit: () => void;
  onBack: () => void;
}

const MEAL_LABEL: Record<string, string> = {
  before: 'Before meal',
  with: 'With meal',
  after: 'After meal',
  any: 'Any time',
};

export function ReviewStep({ data, onSubmit, onBack }: StepProps) {
  const windows = data.times_of_day ?? [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontFamily: 'Lexend, sans-serif', fontSize: 22, color: '#092C4C' }}>
        Review
      </h2>
      <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 8 }}>
        <dt>Name</dt>
        <dd>{data.name}</dd>
        <dt>Dosage</dt>
        <dd>
          {data.dosage_amount} {data.dosage_unit} {data.form}
        </dd>
        <dt>Instructions</dt>
        <dd>{data.instructions ?? '—'}</dd>
        <dt>Meal</dt>
        <dd>{data.meal_relationship ? MEAL_LABEL[data.meal_relationship] : '—'}</dd>
        <dt>Windows</dt>
        <dd>
          {windows
            .map((w) => `${w.window_start} – ${w.window_end}`)
            .join(', ')}
        </dd>
        <dt>Days</dt>
        <dd>{(data.days_of_week ?? []).join(', ')}</dd>
        <dt>Room</dt>
        <dd>{data.preferred_room_id ?? '—'}</dd>
        <dt>Dates</dt>
        <dd>
          {data.start_date} {data.end_date ? `→ ${data.end_date}` : ''}
        </dd>
      </dl>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          style={{
            background: '#007972',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 999,
            padding: '12px 24px',
          }}
        >
          Save medication
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm --filter @ayurplex/web test -- src/routes/add-med/steps/__tests__/ReviewStep.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/add-med/steps/ReviewStep.tsx apps/web/src/routes/add-med/steps/__tests__/ReviewStep.test.tsx
git commit -m "feat(add-med): complete ReviewStep with summary"
```

---

## Task 21: `/add-med` route + modal container + wiring

**Files:**
- Create: `apps/web/src/routes/add-med/index.tsx`
- Modify: `apps/web/src/App.tsx`
- Create: `apps/web/src/routes/add-med/__tests__/route.test.tsx`

- [ ] **Step 1: Write the failing route test**

Create `apps/web/src/routes/add-med/__tests__/route.test.tsx`:

```tsx
import React, { type ReactNode } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AddMedRoute } from '../index';

vi.mock('../../../features/medications/api', () => ({
  listActiveMedications: vi.fn(async () => []),
  createMedication: vi.fn(async (input) => ({
    id: 'med-new',
    user_id: 'user-1',
    active: true,
    start_date: input.start_date,
    end_date: input.end_date,
    created_at: '',
    updated_at: '',
    prescription_id: null,
    ...input,
  })),
  deactivateMedication: vi.fn(),
  getMedicationById: vi.fn(),
}));
vi.mock('../../../features/schedules/api', () => ({
  createSchedule: vi.fn(async () => ({ id: 'sch-new' })),
}));
vi.mock('../../../features/rooms/api', () => ({
  listRooms: vi.fn(async () => []),
  createRoom: vi.fn(),
}));
vi.mock('../../../features/profile/useProfile', () => ({
  useProfile: () => ({
    profile: { display_name: 'Test', timezone: 'America/Toronto' },
    isLoading: false,
  }),
}));

import { createMedication } from '../../../features/medications/api';
import { createSchedule } from '../../../features/schedules/api';

function wrap(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <MemoryRouter initialEntries={['/add-med']}>
      <QueryClientProvider client={client}>
        <Routes>
          <Route path="/" element={<div>home</div>} />
          <Route path="/add-med" element={children} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AddMedRoute', () => {
  it('saves by calling createMedication then createSchedule', async () => {
    render(wrap(<AddMedRoute />));

    fireEvent.change(screen.getByLabelText(/medication name/i), {
      target: { value: 'Metformin' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText(/unit/i), { target: { value: 'mg' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    fireEvent.click(screen.getByLabelText(/with meal/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    fireEvent.change(screen.getByLabelText(/window start/i), {
      target: { value: '08:00' },
    });
    fireEvent.change(screen.getByLabelText(/window end/i), {
      target: { value: '10:00' },
    });
    fireEvent.click(screen.getByLabelText(/monday/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    fireEvent.change(screen.getByLabelText(/start date/i), {
      target: { value: '2026-04-11' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    fireEvent.click(screen.getByRole('button', { name: /save medication/i }));

    await waitFor(() => expect(createMedication).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(createSchedule).toHaveBeenCalledTimes(1));
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @ayurplex/web test -- src/routes/add-med/__tests__/route.test.tsx
```

- [ ] **Step 3: Implement `AddMedRoute`**

Create `apps/web/src/routes/add-med/index.tsx`:

```tsx
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AddMedWizard } from './AddMedWizard';
import type { AddMedFormData } from './schema';
import { createMedication } from '../../features/medications/api';
import { createSchedule } from '../../features/schedules/api';
import { MEDICATIONS_QUERY_KEY } from '../../features/medications/useMedications';
import { DOSES_TODAY_QUERY_KEY } from '../../features/doses/useDueToday';
import { useProfile } from '../../features/profile/useProfile';

export function AddMedRoute() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profile } = useProfile();
  const timezone = profile?.timezone ?? 'UTC';

  const saveMutation = useMutation({
    mutationFn: async (data: AddMedFormData) => {
      const medication = await createMedication({
        name: data.name,
        dosage_amount: data.dosage_amount,
        dosage_unit: data.dosage_unit,
        form: data.form,
        instructions: data.instructions,
        meal_relationship: data.meal_relationship,
        start_date: data.start_date,
        end_date: data.end_date,
      });
      await createSchedule(
        medication,
        {
          frequency: data.frequency,
          times_of_day: data.times_of_day,
          days_of_week: data.days_of_week,
          preferred_room_id: data.preferred_room_id,
        },
        { timezone, startDate: data.start_date, days: 7 },
      );
      return medication;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MEDICATIONS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: DOSES_TODAY_QUERY_KEY });
      navigate('/');
    },
  });

  return (
    <div
      role="dialog"
      aria-label="Add medication"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(9, 44, 76, 0.32)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: '#F5FAF9',
          width: '100%',
          maxWidth: 480,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          maxHeight: '95vh',
          overflowY: 'auto',
        }}
      >
        <AddMedWizard
          onSubmit={(data) => saveMutation.mutate(data)}
          onClose={() => navigate('/')}
        />
        {saveMutation.isError && (
          <p role="alert" style={{ color: '#B3261E', padding: 16 }}>
            Could not save medication. Please try again.
          </p>
        )}
      </div>
    </div>
  );
}

export default AddMedRoute;
```

- [ ] **Step 4: Register the route in `App.tsx`**

Modify `apps/web/src/App.tsx`. In the `<Routes>` block added by Plan 2, add:

```tsx
<Route path="/add-med" element={<AddMedRoute />} />
```

Add the import at the top:

```tsx
import { AddMedRoute } from './routes/add-med';
```

- [ ] **Step 5: Run — expect PASS**

```bash
pnpm --filter @ayurplex/web test -- src/routes/add-med/__tests__/route.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/add-med/index.tsx apps/web/src/App.tsx apps/web/src/routes/add-med/__tests__/route.test.tsx
git commit -m "feat(add-med): wire AddMedRoute to createMedication + createSchedule"
```

---

## Task 22: E2E — full add-medication happy path

**Files:**
- Create: `apps/web/e2e/add-medication.spec.ts`

- [ ] **Step 1: Write the E2E spec**

Create `apps/web/e2e/add-medication.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { signInWithDevJwt } from './helpers/auth';

test.describe('Add medication happy path', () => {
  test('user adds Metformin, sees it on dashboard, marks dose taken', async ({ page }) => {
    // 1. Sign in with dev JWT helper (set up in Plan 2)
    await signInWithDevJwt(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /hello/i })).toBeVisible();

    // 2. Open the Add Med modal
    await page.getByRole('link', { name: /add medication/i }).click();
    await expect(page.getByRole('dialog', { name: /add medication/i })).toBeVisible();

    // 3. Step 1 — name
    await page.getByLabel('Medication name').fill('Metformin');
    await page.getByRole('button', { name: /next/i }).click();

    // 4. Step 2 — dosage
    await page.getByLabel('Amount').fill('500');
    await page.getByLabel('Unit').fill('mg');
    await page.getByLabel('Form').selectOption('tablet');
    await page.getByLabel('Instructions').fill('with food');
    await page.getByRole('button', { name: /next/i }).click();

    // 5. Step 3 — meal (with)
    await page.getByLabel('With meal').click();
    await page.getByRole('button', { name: /next/i }).click();

    // 6. Step 4 — schedule (08:00–11:00, Mon–Fri)
    await page.getByLabel('Window start').fill('08:00');
    await page.getByLabel('Window end').fill('11:00');
    for (const d of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
      await page.getByLabel(d).check();
    }
    await page.getByRole('button', { name: /next/i }).click();

    // 7. Step 5 — room (create Kitchen inline)
    await page.getByRole('button', { name: /add a new room/i }).click();
    await page.getByLabel('New room name').fill('Kitchen');
    await page.getByRole('button', { name: /create room/i }).click();
    await page.getByRole('button', { name: /next/i }).click();

    // 8. Step 6 — dates (start today)
    const today = new Date().toISOString().slice(0, 10);
    await page.getByLabel('Start date').fill(today);
    await page.getByRole('button', { name: /next/i }).click();

    // 9. Step 7 — review + save
    await expect(page.getByText(/review/i)).toBeVisible();
    await page.getByRole('button', { name: /save medication/i }).click();

    // 10. Dashboard shows the medication
    await expect(page).toHaveURL('/');
    await expect(page.getByText('Metformin').first()).toBeVisible();

    // 11. Today's dose is listed and can be marked taken
    const dayOfWeek = new Date().getDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    if (isWeekday) {
      const markBtn = page.getByRole('button', { name: /mark as taken/i }).first();
      await markBtn.click();
      // StatusRing updates to 1/1
      await expect(page.getByText('1/1')).toBeVisible();
    }
  });
});
```

- [ ] **Step 2: Run the E2E test**

```bash
pnpm --filter @ayurplex/web test:e2e -- add-medication
```

**Expected:** test passes.

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/add-medication.spec.ts
git commit -m "test(e2e): add Playwright happy path for add medication flow"
```

---

## Task 23: Final verification & gates

- [ ] **Step 1: Install fresh from lockfile**

```bash
pnpm install --frozen-lockfile
```

**Expected:** exits with code 0; no lockfile drift.

- [ ] **Step 2: Typecheck the entire monorepo**

```bash
pnpm typecheck
```

**Expected:** all packages report 0 type errors.

- [ ] **Step 3: Lint**

```bash
pnpm lint
```

**Expected:** 0 errors.

- [ ] **Step 4: Unit + integration tests**

```bash
pnpm test
```

**Expected:** all Vitest suites green across `@ayurplex/shared` and `@ayurplex/web`.

- [ ] **Step 5: Build**

```bash
pnpm build
```

**Expected:** `apps/web` and `packages/shared` produce build artifacts with 0 errors.

- [ ] **Step 6: E2E**

```bash
pnpm --filter @ayurplex/web test:e2e
```

**Expected:** every Playwright spec passes, including Plan 2's sign-in and Plan 3's add-medication.

- [ ] **Step 7: Final commit**

```bash
git commit --allow-empty -m "chore: complete Plan 3 medications + schedules + home dashboard"
```

---

## Plan 3 acceptance checklist

After all tasks are complete, verify by hand:

- [ ] `supabase/migrations/0004_medications_schedules_doses.sql` exists and applied cleanly to a fresh `supabase db reset`.
- [ ] `medications`, `medication_schedules`, `scheduled_doses` all have `rowsecurity = t` and 4 RLS policies each.
- [ ] Fresh sign-in → dashboard shows 0/0 Status Ring and "No medications yet".
- [ ] Tapping "+" opens the modal at `/add-med`.
- [ ] Walking all 6 steps saves a medication and redirects to `/`.
- [ ] The new medication appears in "Medications".
- [ ] Today's dose (if the weekday matches) appears in "Today" with the correct local time.
- [ ] Clicking "Mark as taken" flips the row to a checkmark and updates the StatusRing counts.
- [ ] Deliberate page refresh keeps the marked state (persisted).
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @ayurplex/web test:e2e` all pass.

---

## Notes for Plan 4 (next plan)

Plan 4 will:

1. Introduce `packages/shared/rule-engine` with deterministic conflict / meal-window / quiet-hours / travel rules.
2. Replace the body of `materializeDoses` with a call into the rule engine, using the same `MaterializeDosesContext` signature defined here.
3. Add `calendar_events_cache` table and populate it from the `refresh-calendar` edge function.
4. Backfill already-materialized doses by re-running the rule engine against the existing `scheduled_doses` rows.

No other file in this plan should need changes when Plan 4 lands, provided the `materializeDoses` signature stays stable.
