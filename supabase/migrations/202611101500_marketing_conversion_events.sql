-- Independent analytics staging. No triggers on the billing tables and no changes to checkout.
-- Events are written only by the dedicated Stripe marketing webhook using service_role.
create table if not exists public.marketing_conversion_events (
  id bigint generated always as identity primary key,
  stripe_event_id text not null,
  stripe_subscription_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  conversion_kind text not null check (conversion_kind in ('trial_started', 'first_paid')),
  event_time timestamptz not null,
  amount_cents bigint,
  currency text,
  created_at timestamptz not null default now(),
  constraint marketing_conversion_events_unique_event unique (stripe_event_id),
  constraint marketing_conversion_events_unique_conversion unique (stripe_subscription_id, conversion_kind)
);
alter table public.marketing_conversion_events enable row level security;
revoke all on table public.marketing_conversion_events from anon, authenticated;
revoke all on sequence public.marketing_conversion_events_id_seq from anon, authenticated;
comment on table public.marketing_conversion_events is 'Staging for verified Stripe trial and first successful paid invoice events. Not an Ads conversion upload.';
