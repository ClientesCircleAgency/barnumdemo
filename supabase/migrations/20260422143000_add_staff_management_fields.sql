-- Operational staff management fields for doctors and secretaries.

alter table public.user_profiles
  add column if not exists working_hours jsonb not null default '[]'::jsonb,
  add column if not exists time_off jsonb not null default '[]'::jsonb,
  add column if not exists extra_permissions jsonb not null default '{}'::jsonb;

comment on column public.user_profiles.working_hours is 'Per-user working hours managed by staff operations.';
comment on column public.user_profiles.time_off is 'Per-user days off, holidays and vacation ranges managed by staff operations.';
comment on column public.user_profiles.extra_permissions is 'Extra operational permissions delegated to this staff account.';
