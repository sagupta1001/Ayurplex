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
