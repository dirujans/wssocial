-- Native Instagram + TikTok media, daily account totals, competitor watch, mentions.

-- One row per Instagram or TikTok post, straight from the native connectors (richer than Sprout:
-- media files, thumbnails, saves, reposts, watch-through, follows per post).
create table if not exists media (
  id               text primary key,          -- ig_<media_id> | tt_<video_id>
  platform         text not null,             -- Instagram | Instagram IE | TikTok
  posted_at        timestamptz,
  posted           date,
  kind             text,                      -- Reel | Carousel | Image | Video | Photo
  caption          text,
  permalink        text,
  media_url        text,                      -- Instagram CDN file (expires; refreshed by each sync)
  thumb_url        text,
  embed_url        text,                      -- TikTok player
  views            bigint,
  reach            bigint,
  likes            integer,
  comments         integer,
  shares           integer,
  saves            integer,
  reposts          integer,
  full_watch_rate  double precision,
  avg_watch_s      double precision,
  new_followers    integer,
  comment_key      text,
  updated_at       timestamptz default now()
);
create index if not exists media_posted_idx on media (posted desc);

-- Daily account totals from the native connectors (Instagram UK, Instagram IE, TikTok).
create table if not exists account_daily (
  date             date not null,
  platform         text not null,
  views            bigint,
  reach            bigint,
  likes            integer,
  comments         integer,
  shares           integer,
  saves            integer,
  reposts          integer,
  interactions     integer,
  profile_views    integer,
  follows          integer,
  primary key (date, platform)
);

-- Filled by the daily competitor brief (Claude scheduled task) and by hand.
create table if not exists competitor_items (
  id          text primary key,               -- stable hash of brand + url
  brand       text not null,
  kind        text,
  platform    text,
  title       text not null,
  summary     text,
  metric      text,
  spike       boolean default false,
  posted_on   date,
  url         text,
  so_what     text,
  found_at    timestamptz not null default now()
);
create index if not exists competitor_posted_idx on competitor_items (posted_on desc);

-- Filled by the daily social report (Claude scheduled task): things said about us elsewhere.
create table if not exists mentions (
  id          text primary key,               -- stable hash of url + author
  source      text,
  author      text,
  title       text not null,
  summary     text,
  kind        text,
  action      text,                           -- engage | reply | thank | escalate | watch
  priority    text,                           -- high | medium | low
  metric      text,
  posted_on   date,
  url         text,
  why         text,
  done        boolean not null default false,
  found_at    timestamptz not null default now()
);
create index if not exists mentions_posted_idx on mentions (posted_on desc);

alter table posts add column if not exists reach bigint;

alter table media            enable row level security;
alter table account_daily    enable row level security;
alter table competitor_items enable row level security;
alter table mentions         enable row level security;
