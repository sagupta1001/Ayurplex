-- 0004_medications_schedules_doses.sql
-- Plan 3: Medications + Schedules + Scheduled Doses
--
-- Adds three tables with RLS scoped to auth.uid() = user_id:
--   1. medications            - user's current & historical meds
--   2. medication_schedules   - frequency + time windows + days of week + optional room
--   3. scheduled_doses        - per-occurrence dose rows (materialized)

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
-- updated_at triggers (reuses set_updated_at() from 0002)
-- =========================================================================
drop trigger if exists medications_set_updated_at on public.medications;
create trigger medications_set_updated_at
  before update on public.medications
  for each row execute function public.set_updated_at();

drop trigger if exists medication_schedules_set_updated_at on public.medication_schedules;
create trigger medication_schedules_set_updated_at
  before update on public.medication_schedules
  for each row execute function public.set_updated_at();

drop trigger if exists scheduled_doses_set_updated_at on public.scheduled_doses;
create trigger scheduled_doses_set_updated_at
  before update on public.scheduled_doses
  for each row execute function public.set_updated_at();

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
