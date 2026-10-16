-- Wingstop UK social: owned-channel data from Windsor.ai
-- Run once in Supabase > SQL Editor.

create table if not exists profile_daily (
  date         date    not null,
  channel      text    not null,
  impressions  bigint,
  engagements  bigint,
  followers    bigint,
  posts_sent   integer,
  primary key (date, channel)
);

create table if not exists posts (
  post_guid        text primary key,
  posted           date,
  posted_at        timestamptz,
  channel          text,
  format           text,
  text             text,
  link             text,
  impressions      bigint,
  views            bigint,
  likes            integer,
  comments         integer,
  shares           integer,
  saves            integer,
  engagements      integer,
  engagement_rate  double precision,
  comment_key      text,
  updated_at       timestamptz default now()
);
create index if not exists posts_posted_idx on posts (posted desc);

create table if not exists comments (
  comment_id    text primary key,
  platform      text,
  text          text,
  likes         integer,
  replies       integer,
  author        text,
  commented_at  timestamptz,
  post_date     date,
  post_key      text,
  post_link     text,
  theme         text,
  updated_at    timestamptz default now()
);
create index if not exists comments_post_date_idx on comments (post_date desc);
create index if not exists comments_likes_idx on comments (likes desc);

create table if not exists alerts (
  id          text primary key,           -- stable dedupe key, so each event alerts once
  kind        text not null,
  severity    text not null,
  title       text not null,
  detail      text,
  link        text,
  dismissed   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists sync_log (
  id           bigserial primary key,
  job          text,
  status       text,
  started_at   timestamptz,
  finished_at  timestamptz,
  detail       jsonb
);

-- The app only talks to these tables server-side with the service role key.
-- Lock them to everyone else.
alter table profile_daily enable row level security;
alter table posts         enable row level security;
alter table comments      enable row level security;
alter table alerts        enable row level security;
alter table sync_log      enable row level security;
