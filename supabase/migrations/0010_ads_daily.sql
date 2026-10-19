-- Paid: one row per ad per day (per placement on Meta). Spark/boost link to organic posts via post_key
-- (Instagram permalink normalised like media.comment_key; TikTok item id like media.comment_key for TikTok).
create table if not exists ads_daily (
  day date not null, platform text not null, placement text not null default 'all', ad_id text not null,
  account_id text, account_name text, agency text, campaign_id text, campaign text, objective text, ad_name text,
  post_key text, post_link text, spark boolean,
  spend numeric not null default 0, impressions bigint default 0, reach bigint, clicks bigint, link_clicks bigint,
  video_views bigint, thruplays bigint, likes bigint, comments bigint, shares bigint, saves bigint, follows bigint, profile_visits bigint,
  organic_views bigint, updated_at timestamptz default now(),
  primary key (day, platform, ad_id, placement));
create index if not exists ads_daily_day on ads_daily (day desc);
create index if not exists ads_daily_post on ads_daily (post_key);
alter table ads_daily enable row level security;
