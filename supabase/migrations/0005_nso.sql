-- NSO intelligence: openings, local creators (with shared shortlist), local pages, and daily city follower snapshots.
create table if not exists nso_openings (
  id text primary key, store text not null, city text not null, city_match text, region text, address text,
  opens_on date, status text not null default 'planned', notes text, source_url text, created_at timestamptz default now()
);
create table if not exists nso_creators (
  id uuid primary key default gen_random_uuid(), opening_id text not null references nso_openings(id) on delete cascade,
  handle text not null, name text, platform text not null default 'instagram', followers integer, followers_note text, engagement_rate double precision,
  age1824 double precision, age2534 double precision, female_pct double precision, location_pct double precision, fake_score double precision,
  categories text[], email text, competitor_history boolean default false, why text, source text, source_url text,
  shortlisted boolean not null default false, notes text, created_at timestamptz default now(),
  unique (opening_id, handle, platform)
);
create table if not exists nso_pages (
  id text primary key, city text not null, name text not null, platform text, handle text, url text, type text,
  followers integer, followers_note text, source_url text, saved boolean not null default false, created_at timestamptz default now()
);
create table if not exists audience_city_daily (
  date date not null, platform text not null, city text not null, followers double precision, unit text,
  primary key (date, platform, city)
);
alter table nso_openings enable row level security;
alter table nso_creators enable row level security;
alter table nso_pages enable row level security;
alter table audience_city_daily enable row level security;
