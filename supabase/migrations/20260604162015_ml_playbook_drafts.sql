-- Playbook y modo revisión en ml_connections
alter table public.ml_connections
  add column if not exists playbook text default '',
  add column if not exists review_mode boolean not null default false;

-- Borradores de respuestas pendientes de aprobación
create table if not exists public.ml_drafts (
  id              uuid primary key default gen_random_uuid(),
  ml_conn_id      uuid not null references public.ml_connections(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  question_id     text not null,
  question_text   text not null,
  item_id         text not null,
  item_title      text not null,
  draft_response  text not null,
  status          text not null default 'pending', -- pending | approved | rejected | edited
  final_response  text,  -- si el usuario editó antes de aprobar
  created_at      timestamptz not null default now(),
  reviewed_at     timestamptz
);

create index if not exists ml_drafts_user_id_idx on public.ml_drafts (user_id, created_at desc);
create index if not exists ml_drafts_status_idx  on public.ml_drafts (status);

alter table public.ml_drafts enable row level security;

create policy "users_own_drafts" on public.ml_drafts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "service_role_drafts" on public.ml_drafts
  for all using (auth.role() = 'service_role');

grant select, insert, update, delete on public.ml_drafts to authenticated;
