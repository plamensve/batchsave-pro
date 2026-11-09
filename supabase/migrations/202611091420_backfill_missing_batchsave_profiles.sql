insert into public.profiles(id,created_at,trial_started_at)
select u.id,u.created_at,u.created_at
from auth.users u
left join public.profiles p on p.id=u.id
where p.id is null
on conflict(id) do nothing;
