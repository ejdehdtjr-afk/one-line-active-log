-- FIVE / FIVE · Supabase Postgres schema
-- Run once in the Supabase SQL editor. The service_role key remains server-only.

create table if not exists public.users (
  id uuid primary key,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.experiments (
  id uuid primary key,
  user_id uuid not null unique references public.users(id) on delete cascade,
  question text not null,
  metric text not null,
  unit text not null,
  calculation text not null,
  missing_rule text not null,
  duplicate_rule text not null,
  outlier_rule text not null,
  rounding_rule text not null,
  week_start text not null,
  plan_before text not null,
  plan_after text,
  changed_at timestamptz,
  changed_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.records (
  id uuid primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  record_date date not null,
  value double precision not null check (value >= 0),
  note text not null default '',
  phase text not null check (phase in ('변경 전', '변경 후')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, record_date)
);

create table if not exists public.legacy_records (
  id uuid primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  legacy_id text not null,
  record_date date not null,
  value double precision not null check (value > 0),
  unit text not null,
  memo text not null,
  tag text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (user_id, legacy_id)
);

create index if not exists idx_sessions_token_hash on public.sessions(token_hash);
create index if not exists idx_records_user_date on public.records(user_id, record_date);
create index if not exists idx_legacy_records_user_date on public.legacy_records(user_id, record_date);

create or replace function public.enforce_five_day_record_order()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  existing_count integer;
  latest_date date;
  rule_changed_at timestamptz;
begin
  -- Serialize record creation per account so concurrent requests cannot bypass
  -- the five-day limit or the required day order.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  select count(*), max(record_date)
    into existing_count, latest_date
    from public.records
   where user_id = new.user_id;

  if existing_count >= 5 then
    raise exception 'Only five records are allowed';
  end if;
  if latest_date is not null and new.record_date <= latest_date then
    raise exception 'Record dates must be unique and increasing';
  end if;

  select changed_at into rule_changed_at
    from public.experiments
   where user_id = new.user_id;
  if existing_count >= 2 and rule_changed_at is null then
    raise exception 'Change the plan rule before day three';
  end if;

  new.phase := case when existing_count < 2 then '변경 전' else '변경 후' end;
  return new;
end;
$$;

drop trigger if exists enforce_five_day_record_order_trigger on public.records;
create trigger enforce_five_day_record_order_trigger
before insert on public.records
for each row execute function public.enforce_five_day_record_order();

alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.experiments enable row level security;
alter table public.records enable row level security;
alter table public.legacy_records enable row level security;

revoke all on table public.users from anon, authenticated;
revoke all on table public.sessions from anon, authenticated;
revoke all on table public.experiments from anon, authenticated;
revoke all on table public.records from anon, authenticated;
revoke all on table public.legacy_records from anon, authenticated;

grant all on table public.users to service_role;
grant all on table public.sessions to service_role;
grant all on table public.experiments to service_role;
grant all on table public.records to service_role;
grant all on table public.legacy_records to service_role;
