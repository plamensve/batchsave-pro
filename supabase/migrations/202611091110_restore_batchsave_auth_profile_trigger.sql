-- Keep BatchSave profile rows synchronized with Supabase Auth users.
-- The trigger is idempotent and mirrors the production fix applied on 2026-11-09.

create or replace function public.batchsave_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id, created_at, trial_started_at)
  values(new.id, new.created_at, new.created_at)
  on conflict(id) do nothing;
  return new;
end;
$$;

drop trigger if exists batchsave_auth_user_profile on auth.users;

create trigger batchsave_auth_user_profile
after insert on auth.users
for each row execute function public.batchsave_new_user();

insert into public.profiles(id, created_at, trial_started_at)
select u.id, u.created_at, u.created_at
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict(id) do nothing;
