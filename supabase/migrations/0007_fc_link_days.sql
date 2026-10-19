-- Flavour Club sign-up traffic from Bitly: one row per short link per day (UTC, as Bitly reports it).
-- Filled by the daily "Flavour Club link tracking" scheduled task through the Bitly connector.
-- Channel and store are derived from the destination's UTM tags in lib/flavourClub.ts, so new links need no schema change.
create table if not exists fc_link_days (
  day date not null,
  bitlink text not null,
  destination text,
  clicks integer not null default 0,
  scans integer not null default 0,
  total integer not null default 0,
  updated_at timestamptz default now(),
  primary key (day, bitlink)
);
create index if not exists fc_link_days_day_idx on fc_link_days (day desc);
alter table fc_link_days enable row level security;
