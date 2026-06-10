-- FIX de seguridad: estas dos tablas se crearon sin RLS y quedaron expuestas
-- a lectura/escritura pública vía la anon key (que viaja en el bundle del cliente).
-- Ambas se acceden SOLO desde el servidor con service_role, que bypassa RLS,
-- así que alcanza con habilitar RLS sin policies: el cliente queda bloqueado.

alter table public.ml_item_settings enable row level security;
alter table public.rate_events enable row level security;

-- Defensa en profundidad: revocar grants implícitos al rol público/anon.
revoke all on public.ml_item_settings from anon, authenticated;
revoke all on public.rate_events from anon, authenticated;
