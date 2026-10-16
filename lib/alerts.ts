// Alert rules. Each alert carries a stable id so the same event only alerts once
// (fixes the audit's "same spike fires every hour" problem: the DB upserts on id).
import { lastCompleteDay, shiftDay } from './metrics';
import { CHANNELS, type Alert, type Comment, type ProfileDay } from './types';

const dayLabel = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmt = (n: number) => new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

export const RULES = {
  spikeRatio: 2, // day vs its 28-day daily average
  dropRatio: 0.4,
  minDailyImpressions: 20000, // ignore tiny channels (X, LinkedIn noise)
  loudCommentLikes: 200, // a comment this liked is worth a look even when it is friendly
  pushbackLikes: 25,
};

export function buildAlerts(days: ProfileDay[], comments: Comment[]): Alert[] {
  const out: Alert[] = [];
  const last = lastCompleteDay(days);
  if (last) {
    const from = shiftDay(last, -28), to = shiftDay(last, -1);
    for (const c of CHANNELS) {
      const today = days.find((r) => r.channel === c && r.date === last)?.impressions;
      const base = days.filter((r) => r.channel === c && r.date >= from && r.date <= to && r.impressions != null);
      if (today == null || base.length < 14) continue;
      const avg = base.reduce((s, r) => s + (r.impressions ?? 0), 0) / base.length;
      if (avg < RULES.minDailyImpressions) continue;
      if (today >= avg * RULES.spikeRatio)
        out.push({ id: `spike:${c}:${last}`, kind: 'spike', severity: 'info', title: `${c} impressions spiked on ${dayLabel(last)}`, detail: `${fmt(today)} against a 28-day average of ${fmt(avg)} (${(today / avg).toFixed(1)}x). Check which post drove it and whether it was boosted.`, link: null });
      else if (today <= avg * RULES.dropRatio)
        out.push({ id: `drop:${c}:${last}`, kind: 'drop', severity: 'warn', title: `${c} impressions fell sharply on ${dayLabel(last)}`, detail: `${fmt(today)} against a 28-day average of ${fmt(avg)}. Could be a quiet posting day, a paid flight ending, or a reporting gap.`, link: null });
    }
  }
  for (const c of comments) {
    if (c.theme === 'Pushback' && c.likes >= RULES.pushbackLikes)
      out.push({ id: `pushback:${c.comment_id}`, kind: 'pushback', severity: c.likes >= 100 ? 'critical' : 'warn', title: `Pushback with ${c.likes} likes on ${c.platform}`, detail: `"${c.text.slice(0, 200)}"${c.author ? ` (@${c.author})` : ''}`, link: c.post_link });
    else if (c.likes >= RULES.loudCommentLikes)
      out.push({ id: `loud:${c.comment_id}`, kind: 'loud_comment', severity: 'info', title: `Comment with ${c.likes} likes on ${c.platform}`, detail: `"${c.text.slice(0, 200)}"${c.author ? ` (@${c.author})` : ''}`, link: c.post_link });
  }
  return out;
}
