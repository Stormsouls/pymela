create table if not exists public.ml_connections (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  ml_user_id       text not null unique,
  ml_nickname      text,
  access_token     text not null,
  refresh_token    text not null,
  token_expires_at timestamptz not null,
  auto_respond     boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists ml_connections_user_id_idx on public.ml_connections (user_id);
create index if not exists ml_connections_ml_user_id_idx on public.ml_connections (ml_user_id);

alter table public.ml_connections enable row level security;

create policy "users_own_ml_connections" on public.ml_connections
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- service_role puede leer para el webhook (que corre con clave de servidor)
create policy "service_role_ml_connections" on public.ml_connections
  for all using (auth.role() = 'service_role');

grant select, insert, update, delete on public.ml_connections to authenticated;
