export const compact = (v: number | null | undefined) =>
  v == null || Number.isNaN(v) ? '—' : Math.abs(v) >= 10000 ? new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(v) : Math.round(v).toLocaleString('en-GB');
export const int = (v: number | null | undefined) => (v == null ? '—' : Math.round(v).toLocaleString('en-GB'));
export const pct = (v: number | null | undefined, dp = 1) => (v == null || Number.isNaN(v) ? '—' : (v * 100).toFixed(dp) + '%');
const sign = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '');
export const signedPct = (v: number | null | undefined) => (v == null ? '—' : sign(v) + Math.abs(v * 100).toFixed(1) + '%');
export const signedPts = (v: number | null | undefined) => (v == null ? '—' : sign(v) + Math.abs(v * 100).toFixed(2) + ' pts');
export const signedInt = (v: number | null | undefined) => (v == null ? '—' : sign(v) + Math.abs(Math.round(v)).toLocaleString('en-GB'));
export const day = (s: string | null | undefined) =>
  s ? new Date(String(s).slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '—';
export const ago = (iso: string | null | undefined) => {
  if (!iso) return '';
  const t = new Date(iso);
  if (Number.isNaN(+t)) return day(iso);
  const h = Math.round((Date.now() - +t) / 3.6e6);
  return h < 1 ? 'just now' : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};
export const safeHref = (u: string | null | undefined) => (u && /^https:\/\//.test(u) ? u : undefined);
export const CHANNEL_COLOUR: Record<string, string> = { TikTok: 'var(--s1)', Instagram: 'var(--s2)', 'Instagram IE': 'var(--citrus)', Facebook: 'var(--s3)', LinkedIn: 'var(--s4)', X: 'var(--s5)' };
