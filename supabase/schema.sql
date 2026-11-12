-- Execute no SQL Editor do projeto Supabase.
create table if not exists public.secret_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table if not exists public.secret_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.secret_rooms(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  invite_token_hash text not null unique,
  assigned_to uuid references public.secret_participants(id) deferrable initially deferred,
  revealed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (room_id, name),
  check (assigned_to is null or assigned_to <> id)
);

alter table public.secret_rooms enable row level security;
alter table public.secret_participants enable row level security;
revoke all on public.secret_rooms from anon, authenticated;
revoke all on public.secret_participants from anon, authenticated;
grant all on public.secret_rooms to service_role;
grant all on public.secret_participants to service_role;
-- Não crie policies públicas para estas tabelas. Somente a Edge Function usa a service role.
