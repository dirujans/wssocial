-- Every sign-in attempt (ok or not), for the access log and the wrong-password lockout.
-- IPs are stored only as a short salted hash.
create table if not exists auth_log (
  id bigserial primary key, at timestamptz not null default now(), ip_hash text not null,
  area text, granted text[], ok boolean not null, device text, outcome text);
create index if not exists auth_log_ip_at on auth_log (ip_hash, at desc);
create index if not exists auth_log_at on auth_log (at desc);
alter table auth_log enable row level security;
