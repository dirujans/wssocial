-- Paid shares and saves per day, so the organic/paid/combined switch covers shares and saves too.
create or replace view ads_by_day with (security_invoker = true) as
select day,
  coalesce(sum(impressions) filter (where platform = 'Meta' and placement = 'instagram'), 0)::bigint as ig_impressions,
  coalesce(sum(spend) filter (where platform = 'Meta' and placement = 'instagram'), 0)::numeric as ig_spend,
  coalesce(sum(video_views) filter (where platform = 'TikTok' and spark), 0)::bigint as tt_spark_plays,
  coalesce(sum(video_views) filter (where platform = 'TikTok'), 0)::bigint as tt_plays,
  coalesce(sum(follows) filter (where platform = 'TikTok'), 0)::bigint as tt_follows,
  coalesce(sum(spend) filter (where platform = 'TikTok'), 0)::numeric as tt_spend,
  coalesce(sum(spend), 0)::numeric as spend,
  coalesce(sum(shares) filter (where platform = 'Meta' and placement = 'instagram'), 0)::bigint as ig_shares,
  coalesce(sum(saves) filter (where platform = 'Meta' and placement = 'instagram'), 0)::bigint as ig_saves,
  coalesce(sum(shares) filter (where platform = 'TikTok' and spark), 0)::bigint as tt_spark_shares,
  coalesce(sum(shares) filter (where platform = 'TikTok'), 0)::bigint as tt_shares
from ads_daily group by day;
