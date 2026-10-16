-- Competitor socials: public Instagram posts and daily account snapshots (Windsor instagram_public).
-- Handles are added in Windsor; any new handle flows in on the next sync.

create table if not exists competitor_posts (
  id           text primary key,              -- igp_<media_id>
  handle       text not null,
  brand        text not null,
  platform     text not null default 'Instagram',
  posted_at    timestamptz,
  posted       date,
  kind         text,                          -- Reel | Carousel | Image | Video
  caption      text,
  permalink    text,
  media_url    text,                          -- Instagram CDN (expires; refreshed each sync)
  thumb_url    text,
  likes        integer,
  comments     integer,
  engagement   integer,                       -- likes + comments
  multiple     double precision,              -- engagement / that account's median post in the window
  per_1k       double precision,              -- engagement per 1,000 followers
  viral        boolean not null default false,
  updated_at   timestamptz default now()
);
create index if not exists competitor_posts_posted_idx on competitor_posts (posted desc);
create index if not exists competitor_posts_handle_idx on competitor_posts (handle, posted desc);

create table if not exists competitor_accounts_daily (
  date         date not null,
  handle       text not null,
  platform     text not null default 'Instagram',
  brand        text,
  followers    integer,
  media_count  integer,
  primary key (date, handle, platform)
);

alter table competitor_posts          enable row level security;
alter table competitor_accounts_daily enable row level security;
