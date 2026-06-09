create table ml_item_settings (
  id            uuid primary key default gen_random_uuid(),
  ml_user_id    text not null,
  item_id       text not null,
  title         text,
  thumbnail     text,
  active        boolean not null default true,
  custom_playbook text,
  created_at    timestamptz default now(),
  unique (ml_user_id, item_id)
);
