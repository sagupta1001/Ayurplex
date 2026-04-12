-- 0007_prescriptions.sql
-- Prescription Upload feature: prescriptions table + Storage bucket + RLS
--
-- Stores prescription images uploaded by users and the Claude Vision
-- extraction results. No DELETE policy — rows are audit trail.

-- =========================================================================
-- prescriptions table
-- =========================================================================
create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  uploaded_at timestamptz not null default now(),
  vision_raw_response jsonb,
  vision_parsed jsonb,
  status text not null default 'pending_review' check (
    status in ('pending_review', 'confirmed', 'rejected')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prescriptions_user_id_idx
  on public.prescriptions (user_id);

create index if not exists prescriptions_status_idx
  on public.prescriptions (user_id, status);

-- =========================================================================
-- updated_at trigger (reuses set_updated_at() from 0002)
-- =========================================================================
drop trigger if exists prescriptions_set_updated_at on public.prescriptions;
create trigger prescriptions_set_updated_at
  before update on public.prescriptions
  for each row execute function public.set_updated_at();

-- =========================================================================
-- Row Level Security — no DELETE (audit trail)
-- =========================================================================
alter table public.prescriptions enable row level security;

create policy "prescriptions_select_own"
  on public.prescriptions for select
  using (auth.uid() = user_id);

create policy "prescriptions_insert_own"
  on public.prescriptions for insert
  with check (auth.uid() = user_id);

create policy "prescriptions_update_own"
  on public.prescriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =========================================================================
-- Storage bucket: prescriptions
-- =========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'prescriptions',
  'prescriptions',
  false,
  10485760,  -- 10MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- Storage RLS: users can upload to their own folder
create policy "prescriptions_storage_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'prescriptions'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage RLS: users can read their own files
create policy "prescriptions_storage_select"
  on storage.objects for select
  using (
    bucket_id = 'prescriptions'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage RLS: users can update their own files
create policy "prescriptions_storage_update"
  on storage.objects for update
  using (
    bucket_id = 'prescriptions'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
