-- Descanso Daily Sales Tracker: private finance records
--
-- 1) Create the authorized administrator in Supabase Dashboard > Authentication > Users.
-- 2) Copy that user's UUID and replace ADMIN_USER_UUID below (keep the single quotes).
-- 3) Run this script in Supabase SQL Editor.
--
-- Unlike the former public event website table, these finance tables are PRIVATE.
-- Anonymous visitors cannot read, insert, update, or delete financial data.

create table if not exists public.descanso_finance_days (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_date date not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint descanso_finance_days_owner_date_unique unique (owner_id, business_date)
);

create table if not exists public.descanso_finance_meta (
  id integer primary key check (id = 1),
  owner_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.descanso_finance_days enable row level security;
alter table public.descanso_finance_meta enable row level security;

revoke all on public.descanso_finance_days from anon, authenticated;
revoke all on public.descanso_finance_meta from anon, authenticated;
grant select, insert, update, delete on public.descanso_finance_days to authenticated;
grant select, insert, update, delete on public.descanso_finance_meta to authenticated;

drop policy if exists "Finance owner can read daily records" on public.descanso_finance_days;
create policy "Finance owner can read daily records"
on public.descanso_finance_days for select to authenticated
using (auth.uid() = owner_id);

drop policy if exists "Finance owner can insert daily records" on public.descanso_finance_days;
create policy "Finance owner can insert daily records"
on public.descanso_finance_days for insert to authenticated
with check (auth.uid() = owner_id);

drop policy if exists "Finance owner can update daily records" on public.descanso_finance_days;
create policy "Finance owner can update daily records"
on public.descanso_finance_days for update to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "Finance owner can delete daily records" on public.descanso_finance_days;
create policy "Finance owner can delete daily records"
on public.descanso_finance_days for delete to authenticated
using (auth.uid() = owner_id);

drop policy if exists "Finance owner can read tracker settings" on public.descanso_finance_meta;
create policy "Finance owner can read tracker settings"
on public.descanso_finance_meta for select to authenticated
using (auth.uid() = owner_id);

drop policy if exists "Finance owner can insert tracker settings" on public.descanso_finance_meta;
create policy "Finance owner can insert tracker settings"
on public.descanso_finance_meta for insert to authenticated
with check (auth.uid() = owner_id);

drop policy if exists "Finance owner can update tracker settings" on public.descanso_finance_meta;
create policy "Finance owner can update tracker settings"
on public.descanso_finance_meta for update to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "Finance owner can delete tracker settings" on public.descanso_finance_meta;
create policy "Finance owner can delete tracker settings"
on public.descanso_finance_meta for delete to authenticated
using (auth.uid() = owner_id);

-- Create the private settings row for the one authorized owner.
insert into public.descanso_finance_meta (id, owner_id, data)
values (
  1,
  'ADMIN_USER_UUID'::uuid,
  '{"settings":{"businessName":"Descanso Comida • Cafe","defaultFloat":3000},"inventory":[],"restocks":[]}'::jsonb
)
on conflict (id) do nothing;

-- Enable realtime updates so a second signed-in device can receive changes.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'descanso_finance_days'
  ) then
    alter publication supabase_realtime add table public.descanso_finance_days;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'descanso_finance_meta'
  ) then
    alter publication supabase_realtime add table public.descanso_finance_meta;
  end if;
end $$;
