-- Apify runs, competitor TikTok, UK trends, Inspo marks (applied 19 Oct 2026)
create table if not exists apify_runs (
  run_id text primary key, kind text not null, actor text not null, status text not null, dataset_id text,
  started_at timestamptz not null default now(), finished_at timestamptz, ingested_at timestamptz, usd double precision, items integer, error text
);
create index if not exists apify_runs_kind_idx on apify_runs (kind, started_at desc);
create table if not exists competitor_tiktok (
  id text primary key, handle text not null, brand text not null, posted_at timestamptz, posted date, caption text, url text, cover_url text,
  plays bigint, likes integer, comments integer, shares integer, saves integer, reposts integer, music text, music_original boolean,
  multiple double precision, viral boolean not null default false, updated_at timestamptz default now()
);
create index if not exists competitor_tiktok_posted_idx on competitor_tiktok (posted desc);
create table if not exists competitor_tiktok_daily (
  date date not null, handle text not null, brand text, fans integer, hearts bigint, videos integer, verified boolean, primary key (date, handle)
);
create table if not exists tiktok_trends (
  date date not null, country text not null, hashtag text not null, rank integer, posts bigint, views bigint, direction text,
  industries text[], url text, series jsonb, top_creators jsonb, verdict text, primary key (date, country, hashtag)
);
create table if not exists inspo_marks (key text primary key, verdict text not null, note text, updated_at timestamptz default now());
create table if not exists ops_keys (key text primary key, purpose text not null, expires_at timestamptz not null, created_at timestamptz default now());

-- Flavour Club (applied 19 Oct 2026)
alter table mentions add column if not exists topic text;
create table if not exists fc_entries (
  id text primary key, platform text not null, author text, author_name text, url text, caption text, posted_at timestamptz,
  likes integer, comments integer, plays bigint, shares integer, thumb_url text, hashtag text, status text, note text,
  found_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists fc_entries_posted_idx on fc_entries (posted_at desc);
create table if not exists fc_marks (key text primary key, verdict text not null, note text, updated_at timestamptz default now());

alter table apify_runs enable row level security;
alter table competitor_tiktok enable row level security;
alter table competitor_tiktok_daily enable row level security;
alter table tiktok_trends enable row level security;
alter table inspo_marks enable row level security;
alter table ops_keys enable row level security;
alter table fc_entries enable row level security;
alter table fc_marks enable row level security;
