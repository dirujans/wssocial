-- Our own Instagram Stories. Instagram only keeps Story stats for 24 hours, so the sync captures them several times a day
-- and the last reading before expiry is the one that stays.
create table if not exists ig_stories (
  id text primary key,
  account_id text not null,
  platform text not null,
  posted_at timestamptz,
  permalink text,
  thumb_url text,
  views bigint, reach bigint, replies bigint, shares bigint, interactions bigint,
  exits bigint, taps_forward bigint, taps_back bigint, swipe_forward bigint,
  first_seen timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ig_stories_posted on ig_stories (posted_at desc);
alter table ig_stories enable row level security;
