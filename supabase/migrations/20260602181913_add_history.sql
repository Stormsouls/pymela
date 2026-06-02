-- Historial de generaciones por usuario
create table if not exists public.history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  bot_slug    text not null,
  bot_name    text not null,
  input_values jsonb not null default '{}',
  output_text  text not null,
  created_at  timestamptz not null default now()
);

create index if not exists history_user_id_idx on public.history (user_id, created_at desc);

alter table public.history enable row level security;

-- Cada usuario solo ve y escribe su propio historial
create policy "users_own_history" on public.history
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, delete on public.history to authenticated;
grant select, insert, delete on public.history to anon;
