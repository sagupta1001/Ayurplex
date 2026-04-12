-- Enable required extensions
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Store the service-role key in Vault so the cron job body can retrieve it
-- without embedding the secret in the schedule SQL.
-- If the secret already exists (e.g. re-running migration), update it; otherwise insert.
do $$
declare
  v_secret_id uuid;
begin
  select id into v_secret_id
  from vault.secrets
  where name = 'service_role_key'
  limit 1;

  if v_secret_id is null then
    perform vault.create_secret(
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhcnpkaXhseWZyeWZieWR0bnN6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjAwNDA5NywiZXhwIjoyMDkxNTgwMDk3fQ.PQ9dLYs_wH4hPHm3h9jtmD1Ezy5eXhPlw1IaEl7Qp5M',
      'service_role_key'
    );
  end if;
end;
$$;

-- Remove any existing job with this name before (re-)creating it
do $$
begin
  if exists (select 1 from cron.job where jobname = 'send-reminders') then
    perform cron.unschedule('send-reminders');
  end if;
end;
$$;

-- Schedule send-reminders edge function every 5 minutes.
-- The cron job body reads the service_role_key from Vault at runtime.
select cron.schedule(
  'send-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://garzdixlyfryfbydtnsz.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'service_role_key'
        limit 1
      )
    ),
    body    := '{}'::jsonb
  );
  $$
);
