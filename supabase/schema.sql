create extension if not exists pgcrypto;

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  message text not null
);

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  phone text not null,
  email text not null,
  address text not null,
  aircon_type text not null,
  issue text not null,
  preferred_date date,
  preferred_time time,
  status text not null default 'new'
);

create table if not exists public.admin_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.admin_emails
    where lower(email) = lower(auth.jwt()->>'email')
  );
$$;

alter table public.contact_messages enable row level security;
alter table public.service_requests enable row level security;
alter table public.admin_emails enable row level security;

create policy "Allow anon inserts for contact"
  on public.contact_messages
  for insert
  to anon
  with check (true);

create policy "Allow admin read on contact"
  on public.contact_messages
  for select
  to authenticated
  using (public.is_admin());

create policy "Allow anon inserts for service"
  on public.service_requests
  for insert
  to anon
  with check (true);

create policy "Allow admin read on service"
  on public.service_requests
  for select
  to authenticated
  using (public.is_admin());

create policy "Allow admin read on admin emails"
  on public.admin_emails
  for select
  to authenticated
  using (public.is_admin());
