create table rate_events (
  id          bigint generated always as identity primary key,
  ip_hash     text not null,
  bucket      text not null,
  created_at  timestamptz not null default now()
);

create index idx_rate_events_lookup on rate_events (ip_hash, bucket, created_at);
