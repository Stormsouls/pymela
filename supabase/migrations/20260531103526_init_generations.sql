-- Tabla de generaciones: rastrea uso por usuario anónimo/autenticado
-- Permite mover el free tier (3 usos) de localStorage a server-side

create table if not exists public.generations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  ip_hash     text,
  bot_slug    text not null,
  created_at  timestamptz not null default now()
);

create index if not exists generations_user_id_idx on public.generations (user_id);
create index if not exists generations_ip_hash_idx on public.generations (ip_hash);

alter table public.generations enable row level security;

-- service_role (servidor) puede insertar/leer todo
create policy "service_role_all" on public.generations
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Usuario autenticado solo ve las suyas
create policy "users_own_generations" on public.generations
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert on public.generations to authenticated;
grant select, insert on public.generations to anon;
