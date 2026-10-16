-- Audience demographics and follower totals (latest snapshot per platform/dimension/key).
-- dimension: gender_age | gender | age | city | country | total ; unit: count | share
create table if not exists audience_demo (
  platform text not null, dimension text not null, key text not null,
  value double precision, unit text, snapshot_date date not null default current_date,
  primary key (platform, dimension, key)
);
alter table audience_demo enable row level security;
