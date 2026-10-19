'use client';

import SectionNav from './SectionNav';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { NsoData } from '@/lib/data';
import { cityLift, computeFit, daysBetween, parseCreatorCsv, type Fit } from '@/lib/nso';
import type { NsoCreator, NsoOpening, NsoPage } from '@/lib/types';
import { compact, day, int, pct, safeHref, signedInt } from './format';

const STATUS_COL: Record<string, string> = { open: 'var(--opal)', announced: 'var(--lemon)', planned: 'var(--line-2)' };
const TIER_COL: Record<string, string> = { S: 'var(--opal-hi)', A: 'var(--opal)', B: 'var(--hawaiian)', C: 'var(--lemon)', D: 'var(--atomic)' };
const profileUrl = (handle: string, platform: string) => {
  const h = handle.replace(/^@/, '');
  return platform === 'tiktok' ? `https://www.tiktok.com/@${h}` : platform === 'youtube' ? `https://www.youtube.com/@${h}` : `https://www.instagram.com/${h}/`;
};

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
  if (!j.ok) throw new Error(j.error ?? 'Something went wrong');
  return j;
}

function whenLabel(o: NsoOpening, today: string) {
  if (!o.opens_on) return o.status === 'open' ? 'Open' : 'Date TBC';
  const d = daysBetween(today, o.opens_on);
  return d > 0 ? `Opens in ${d} day${d === 1 ? '' : 's'}` : d === 0 ? 'Opens today' : `Opened ${-d} day${d === -1 ? '' : 's'} ago`;
}

export default function Nso({ data, today }: { data: NsoData; today: string }) {
  const router = useRouter();
  const ordered = useMemo(() => [...data.openings].sort((a, b) => {
    const rank = (o: NsoOpening) => (o.status === 'open' ? 1 : 0);
    return rank(a) - rank(b) || String(b.opens_on ?? '9999').localeCompare(String(a.opens_on ?? '9999'));
  }), [data.openings]);
  const [sel, setSel] = useState<string>(() => {
    const upcoming = data.openings.filter((o) => o.opens_on && o.opens_on >= today).sort((a, b) => a.opens_on!.localeCompare(b.opens_on!))[0];
    return (upcoming ?? data.openings.find((o) => o.id === 'romford') ?? data.openings[0])?.id ?? '';
  });
  const [adding, setAdding] = useState(false);
  const o = data.openings.find((x) => x.id === sel);
  const open = data.openings.filter((x) => x.status === 'open').length;
  const pipeline = data.openings.length - open;
  const nextUp = data.openings.filter((x) => x.status !== 'open').sort((a, b) => String(a.opens_on ?? '9999').localeCompare(String(b.opens_on ?? '9999')))[0];

  return (
    <main className="shell">
      <header className="hero">
        <div className="inner">
          <h1>NSO intelligence</h1>
          <p className="take"><b>{open}</b> openings live, <b>{pipeline}</b> in the pipeline.{nextUp ? <> Next up: <b>{nextUp.store}</b>{nextUp.opens_on ? `, ${day(nextUp.opens_on)}` : ', date to confirm'}.</> : null} Local creators, pages, press and city follower lift for every store.</p>
        </div>
      </header>

      <nav className="filters" aria-label="Openings">
        <div className="inner" style={{ flexWrap: 'nowrap', overflowX: 'auto' }}>
          <div className="seg" role="group" aria-label="Choose an opening" style={{ flexWrap: 'nowrap' }}>
            {ordered.map((x) => (
              <button key={x.id} type="button" aria-pressed={sel === x.id} onClick={() => setSel(x.id)}>
                <span className="sw" style={{ background: STATUS_COL[x.status] ?? 'var(--line-2)' }} />{x.city}
              </button>
            ))}
          </div>
          <button type="button" className="chip primary" onClick={() => setAdding((v) => !v)} style={{ flexShrink: 0 }}>{adding ? 'Close' : '+ Add opening'}</button>
        </div>
      </nav>

      {adding && <OpeningForm onDone={(id) => { setAdding(false); if (id) setSel(id); router.refresh(); }} />}

      {o ? <OpeningView key={o.id} o={o} data={data} today={today} onChanged={() => router.refresh()} /> : <section className="band"><div className="inner"><p className="empty">No openings yet. Add one above.</p></div></section>}

      <SectionNav sections={[{ id: 'opening', label: 'The opening' }, { id: 'city-lift', label: 'City lift' }, { id: 'creators', label: 'Local creators' }, { id: 'local-pages', label: 'Local pages' }, { id: 'chatter', label: 'Local chatter' }]} />
      <footer className="band" style={{ paddingTop: 24, paddingBottom: 40 }}>
        <div className="inner"><p className="cap">Internal. Openings, local pages and creators come from dated public sources (linked) and the team&apos;s own imports. Follower counts carry their source and date; anything without one is unverified. City lift uses Instagram follower counts by city, saved daily from 16 Oct 2026.</p></div>
      </footer>
    </main>
  );
}

function OpeningView({ o, data, today, onChanged }: { o: NsoOpening; data: NsoData; today: string; onChanged: () => void }) {
  const lift = useMemo(() => cityLift(data.cityDays, o.city_match ?? o.city, o.opens_on), [data.cityDays, o]);
  const ttCity = data.demo.find((d) => d.platform === 'TikTok' && d.key.toLowerCase().endsWith(` ${(o.city_match ?? o.city).toLowerCase()}`));
  const creators = data.creators.filter((c) => c.opening_id === o.id);
  const pages = data.pages.filter((p) => p.city.toLowerCase() === o.city.toLowerCase());
  const cityRe = new RegExp(`\\b${(o.city_match ?? o.city).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  const mentions = data.mentions.filter((m) => cityRe.test(`${m.title} ${m.summary ?? ''} ${m.author ?? ''}`));
  const href = safeHref(o.source_url);

  return (
    <>
      <section className="band" id="opening">
        <div className="inner">
          <div className="band-head">
            <div>
              <span className="eyebrow">{o.region ?? ''}{o.address ? ` · ${o.address}` : ''}</span>
              <h2>{o.store}</h2>
            </div>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="act" style={{ background: STATUS_COL[o.status], color: o.status === 'planned' ? 'var(--fg)' : '#000' }}>{o.status}</span>
              {href && <a href={href} target="_blank" rel="noopener noreferrer" className="chip" style={{ textDecoration: 'none' }}>Source</a>}
            </span>
          </div>
          <div className="small4">
            <div className="mini hot"><span className="eyebrow">Timing</span><div className="value" style={{ fontSize: 'clamp(1.6rem,3vw,2.4rem)' }}>{whenLabel(o, today)}</div><div className="meta muted">{o.opens_on ? day(o.opens_on) : 'Add the date when it is confirmed'}</div></div>
            <div className="mini"><span className="eyebrow">Instagram followers in {o.city}</span><div className="value">{lift.latest ? compact(lift.latest.followers) : '—'}</div>
              <div className="meta">{lift.change != null ? <span className={`delta ${lift.change >= 0 ? 'up' : 'down'}`}>{signedInt(lift.change)} {lift.sinceLabel}</span> : <span className="muted">{lift.latest ? 'Change appears as daily snapshots build' : 'Not in Instagram’s top cities for us yet'}</span>}</div></div>
            <div className="mini"><span className="eyebrow">TikTok followers in {o.city}</span><div className="value">{ttCity?.value != null ? pct(ttCity.value, 1) : '—'}</div><div className="meta muted">{ttCity ? 'share of all TikTok followers' : 'Not listed separately by TikTok'}</div></div>
            <div className="mini"><span className="eyebrow">Creators · pages · mentions</span><div className="value">{creators.length} · {pages.length} · {mentions.length}</div><div className="meta muted">{creators.filter((c) => c.shortlisted).length} shortlisted</div></div>
          </div>
        </div>
      </section>

      <section className="band" id="city-lift">
        <div className="inner">
          <div className="band-head"><div><span className="eyebrow">Instagram followers who live in {o.city}, daily</span><h2>City lift</h2></div></div>
          {lift.series.length >= 2 ? (
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={lift.series} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d: string) => day(d)} minTickGap={36} tick={{ fill: 'var(--muted)', fontSize: 12 }} stroke="var(--line)" />
                  <YAxis tickFormatter={(v: number) => compact(v)} tick={{ fill: 'var(--muted)', fontSize: 12 }} stroke="var(--line)" width={56} domain={['auto', 'auto']} />
                  <Tooltip content={({ active, label, payload }) => active && payload?.length ? <div className="tip"><div className="muted">{day(String(label))}</div><b>{int(Number(payload[0].value))}</b> followers</div> : null} />
                  {o.opens_on && <ReferenceLine x={o.opens_on} stroke="var(--lemon)" strokeDasharray="4 4" label={{ value: 'Opening', fill: 'var(--lemon)', fontSize: 12, position: 'insideTopRight' }} />}
                  <Line type="monotone" dataKey="followers" stroke="var(--opal)" strokeWidth={3} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="empty">
              {lift.latest ? `${int(lift.latest.followers)} followers in ${o.city} today. ` : `${o.city} isn't in Instagram's list of our top cities yet, so there's no count to track. `}
              Instagram only gives today&apos;s city split, so snapshots began on 16 Oct 2026 and the line draws from tomorrow.
              {o.opens_on && o.opens_on < '2026-10-16' ? ' This store opened before tracking began, so there is no pre-opening baseline; every opening from here gets a full before and after.' : ' For openings still to come, the line will show the run-up and the lift after the doors open.'}
            </p>
          )}
        </div>
      </section>

      <Creators o={o} creators={creators} onChanged={onChanged} />

      <section className="band" id="local-pages">
        <div className="inner">
          <div className="band-head"><div><span className="eyebrow">Food pages, community groups, press and students in {o.city}</span><h2>Local pages and press</h2></div></div>
          {pages.length === 0 ? <p className="empty">No local pages logged for {o.city} yet. The research pass covers each new opening as it&apos;s added.</p> : (
            <div className="feed">{pages.map((p) => <PageCard key={p.id} p={p} onChanged={onChanged} />)}</div>
          )}
        </div>
      </section>

      <section className="band" id="chatter">
        <div className="inner">
          <div className="band-head"><div><span className="eyebrow">From the mentions feed, naming {o.city}</span><h2>Local chatter</h2></div></div>
          {mentions.length === 0 ? <p className="empty">No mentions naming {o.city} in the last six months. The morning report adds local coverage as it finds it.</p> : (
            <div className="feed">{mentions.slice(0, 12).map((m) => (
              <article key={m.id} className="item" data-p={m.priority ?? 'none'}>
                <div className="row" style={{ alignItems: 'center' }}><span className="brand">{m.source}{m.author ? ` · ${m.author}` : ''}</span>{m.kind && <span className="act kind">{m.kind}</span>}</div>
                <div className="title">{m.title}</div>{m.summary && <div className="sum">{m.summary}</div>}
                <div className="foot"><span>{day(m.posted_on)}</span>{safeHref(m.url) && <a href={safeHref(m.url)} target="_blank" rel="noopener noreferrer">Open</a>}</div>
              </article>
            ))}</div>
          )}
        </div>
      </section>
    </>
  );
}

function Creators({ o, creators, onChanged }: { o: NsoOpening; creators: NsoCreator[]; onChanged: () => void }) {
  const [onlySL, setOnlySL] = useState(false);
  const [sort, setSort] = useState<'fit' | 'followers'>('fit');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, boolean>>({});
  const [showAdd, setShowAdd] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const scored = creators.map((c) => ({ c: { ...c, shortlisted: local[c.id] ?? c.shortlisted }, fit: computeFit(c) }));
  const rows = scored.filter((x) => !onlySL || x.c.shortlisted).sort((a, b) => sort === 'fit' ? b.fit.total - a.fit.total : (b.c.followers ?? -1) - (a.c.followers ?? -1));
  const shortlist = scored.filter((x) => x.c.shortlisted);

  const toggle = async (c: NsoCreator) => {
    const next = !(local[c.id] ?? c.shortlisted);
    setLocal((s) => ({ ...s, [c.id]: next }));
    try { await api(`/api/nso/creators/${c.id}`, 'PATCH', { shortlisted: next }); } catch (e) { setLocal((s) => ({ ...s, [c.id]: !next })); setMsg(String((e as Error).message)); }
  };
  const remove = async (c: NsoCreator) => {
    if (!confirm(`Remove ${c.handle} from ${o.city}?`)) return;
    setBusy(c.id);
    try { await api(`/api/nso/creators/${c.id}`, 'DELETE'); onChanged(); } catch (e) { setMsg(String((e as Error).message)); } finally { setBusy(null); }
  };
  const importCsv = async (f: File) => {
    setBusy('csv'); setMsg(null);
    try {
      const parsed = parseCreatorCsv(await f.text());
      if (!parsed.length) throw new Error('No creators found. The file needs a Username (or Handle) column.');
      const r = await api('/api/nso/creators', 'POST', { opening_id: o.id, creators: parsed });
      setMsg(`${r.count} creators imported and scored.`); onChanged();
    } catch (e) { setMsg(String((e as Error).message)); } finally { setBusy(null); if (file.current) file.current.value = ''; }
  };
  const exportCsv = () => {
    const head = ['Tier', 'Fit', 'Handle', 'Name', 'Platform', 'Followers', 'Engagement', 'Why', 'Email', 'Profile'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = shortlist.sort((a, b) => b.fit.total - a.fit.total).map(({ c, fit }) => [fit.tier, fit.total, c.handle, c.name, c.platform, c.followers, c.engagement_rate != null ? pct(c.engagement_rate, 1) : '', c.why, c.email, profileUrl(c.handle, c.platform)].map(esc).join(','));
    const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `wingstop-${o.id}-creator-shortlist.csv`; a.click();
  };

  return (
    <section className="band" id="creators">
      <div className="inner">
        <div className="band-head">
          <div><span className="eyebrow">Scored for fit: reach, engagement, audience, content, safety · {creators.length} found · {shortlist.length} shortlisted</span><h2>Local creators</h2></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div className="seg" role="group" aria-label="Sort creators">
              <button type="button" aria-pressed={sort === 'fit'} onClick={() => setSort('fit')}>Best fit</button>
              <button type="button" aria-pressed={sort === 'followers'} onClick={() => setSort('followers')}>Biggest</button>
            </div>
            <button type="button" className="chip" aria-pressed={onlySL} onClick={() => setOnlySL((v) => !v)}>{onlySL ? 'Show all' : 'Shortlist only'}</button>
            <button type="button" className="chip" onClick={() => setShowAdd((v) => !v)}>+ Add one</button>
            <button type="button" className="chip" onClick={() => file.current?.click()} disabled={busy === 'csv'}>{busy === 'csv' ? 'Importing…' : 'Import Modash CSV'}</button>
            <input ref={file} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); }} />
            <button type="button" className="chip primary" onClick={exportCsv} disabled={!shortlist.length}>Export shortlist</button>
          </div>
        </div>
        {msg && <p className="note" role="status">{msg}</p>}
        {showAdd && <AddCreator o={o} onDone={() => { setShowAdd(false); onChanged(); }} />}
        <p className="note">Researched creators often have no engagement or audience data, so their score is marked <b>partial</b> and only counts what we know. Import a Modash export for full scores: it adds engagement, audience age and gender, and fake-follower checks.</p>
        {rows.length === 0 ? <p className="empty">{onlySL ? 'Nothing shortlisted yet.' : `No creators for ${o.city} yet. Import a Modash export or add one.`}</p> : (
          <div className="card tablewrap" style={{ marginTop: 10 }}>
            <table>
              <thead><tr><th>Fit</th><th>Creator</th><th className="r">Followers</th><th className="r">Eng.</th><th>Why</th><th /><th /></tr></thead>
              <tbody>
                {rows.map(({ c, fit }) => (
                  <tr key={c.id} style={c.shortlisted ? { background: 'rgba(0,167,138,.10)' } : undefined}>
                    <td><FitPill fit={fit} /></td>
                    <td><a href={profileUrl(c.handle, c.platform)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', fontWeight: 800 }}>{c.handle}</a><div className="muted" style={{ fontSize: '.75rem' }}>{c.name ? `${c.name} · ` : ''}{c.platform}</div></td>
                    <td className="r">{c.followers != null ? compact(c.followers) : '—'}{c.followers_note && <div className="muted" style={{ fontSize: '.7rem' }}>{c.followers_note}</div>}</td>
                    <td className="r">{c.engagement_rate != null ? pct(c.engagement_rate, 1) : '—'}</td>
                    <td style={{ maxWidth: 320, whiteSpace: 'normal' }}>{c.why ?? (c.categories?.length ? c.categories.join(', ') : '')}{fit.flags.length > 0 && <div style={{ color: 'var(--atomic)', fontSize: '.75rem' }}>{fit.flags.join(' · ')}</div>}</td>
                    <td><button type="button" className={`chip ${c.shortlisted ? 'primary' : ''}`} onClick={() => toggle(c)}>{c.shortlisted ? '★ Shortlisted' : '☆ Shortlist'}</button></td>
                    <td><button type="button" className="chip" onClick={() => remove(c)} disabled={busy === c.id} aria-label={`Remove ${c.handle}`}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {shortlist.length > 0 && <InviteBrief o={o} count={shortlist.length} />}
      </div>
    </section>
  );
}

function FitPill({ fit }: { fit: Fit }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }} title={Object.entries(fit.dims).map(([k, v]) => `${k}: ${v ?? 'no data'}`).join('\n')}>
      <span style={{ fontStyle: 'italic', fontWeight: 900, fontStretch: '62%', fontSize: '1.6rem', color: TIER_COL[fit.tier], lineHeight: 1 }}>{fit.tier}</span>
      <span style={{ fontSize: '.8rem' }}><b>{fit.total}</b>{fit.partial && <span className="muted"> partial</span>}<div className="muted" style={{ fontSize: '.7rem' }}>{fit.recommendation}</div></span>
    </span>
  );
}

function AddCreator({ o, onDone }: { o: NsoOpening; onDone: () => void }) {
  const [f, setF] = useState({ handle: '', platform: 'instagram', followers: '', why: '', email: '' });
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    try {
      await api('/api/nso/creators', 'POST', { opening_id: o.id, creators: [{ handle: f.handle.startsWith('@') ? f.handle : `@${f.handle}`, platform: f.platform, followers: f.followers ? Number(f.followers.replace(/[, ]/g, '')) : null, followers_note: f.followers ? 'Added by the team' : null, why: f.why || null, email: f.email || null, source: 'team' }] });
      onDone();
    } catch (e) { setErr(String((e as Error).message)); }
  };
  return (
    <div className="card formrow">
      <input placeholder="@handle" value={f.handle} onChange={(e) => setF({ ...f, handle: e.target.value })} aria-label="Handle" />
      <select value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })} aria-label="Platform"><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="youtube">YouTube</option></select>
      <input placeholder="Followers" value={f.followers} onChange={(e) => setF({ ...f, followers: e.target.value })} aria-label="Followers" inputMode="numeric" />
      <input placeholder="Why them (local link, content)" value={f.why} onChange={(e) => setF({ ...f, why: e.target.value })} aria-label="Why" style={{ flex: 2 }} />
      <input placeholder="Email (optional)" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} aria-label="Email" />
      <button type="button" className="chip primary" onClick={save} disabled={!f.handle.trim()}>Add</button>
      {err && <span style={{ color: 'var(--atomic)' }}>{err}</span>}
    </div>
  );
}

function OpeningForm({ onDone }: { onDone: (id?: string) => void }) {
  const [f, setF] = useState({ store: '', city: '', region: '', address: '', opens_on: '', status: 'planned' });
  const [err, setErr] = useState<string | null>(null);
  const save = async () => { try { const r = await api('/api/nso/openings', 'POST', f); onDone(r.id); } catch (e) { setErr(String((e as Error).message)); } };
  return (
    <section className="band" style={{ paddingTop: 18, paddingBottom: 18 }}>
      <div className="inner">
        <div className="card formrow">
          <input placeholder="Store name (e.g. Sheffield, Barker's Pool)" value={f.store} onChange={(e) => setF({ ...f, store: e.target.value })} aria-label="Store" style={{ flex: 2 }} />
          <input placeholder="City or town" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} aria-label="City" />
          <input placeholder="Region" value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} aria-label="Region" />
          <input placeholder="Address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} aria-label="Address" style={{ flex: 2 }} />
          <input type="date" value={f.opens_on} onChange={(e) => setF({ ...f, opens_on: e.target.value })} aria-label="Opening date" />
          <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="Status"><option value="planned">Planned</option><option value="announced">Announced</option><option value="open">Open</option></select>
          <button type="button" className="chip primary" onClick={save} disabled={!f.store.trim() || !f.city.trim()}>Save opening</button>
          {err && <span style={{ color: 'var(--atomic)' }}>{err}</span>}
        </div>
      </div>
    </section>
  );
}

function PageCard({ p, onChanged }: { p: NsoPage; onChanged: () => void }) {
  const [saved, setSaved] = useState(p.saved);
  const href = safeHref(p.url);
  const toggle = async () => { const n = !saved; setSaved(n); try { await api(`/api/nso/pages/${encodeURIComponent(p.id)}`, 'PATCH', { saved: n }); onChanged(); } catch { setSaved(!n); } };
  return (
    <article className="item" data-p={saved ? 'low' : 'none'}>
      <div className="row" style={{ alignItems: 'center' }}>
        <span className="brand">{p.name}</span>
        <span style={{ display: 'flex', gap: 6 }}>{p.type && <span className="act kind">{p.type}</span>}{p.platform && <span className="act kind">{p.platform}</span>}</span>
      </div>
      <div className="sum">{p.handle}{p.followers != null ? ` · ${compact(p.followers)} followers` : ''}{p.followers_note ? <span className="muted"> ({p.followers_note})</span> : ''}</div>
      <div className="foot">
        <button type="button" className={`chip ${saved ? 'primary' : ''}`} onClick={toggle}>{saved ? '★ On the list' : '☆ Add to list'}</button>
        {href && <a href={href} target="_blank" rel="noopener noreferrer">Open</a>}
        {safeHref(p.source_url) && p.source_url !== p.url && <a href={safeHref(p.source_url)} target="_blank" rel="noopener noreferrer">Source</a>}
      </div>
    </article>
  );
}

function InviteBrief({ o, count }: { o: NsoOpening; count: number }) {
  const text = `Hi {name},\n\nWe're opening Wingstop ${o.store}${o.opens_on ? ` on ${new Date(o.opens_on + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}` : ''} and we'd love you there before anyone else.\n\nWe're inviting a small group of ${o.city} creators for a first taste: the full flavour line-up on us, a proper look round, and no script. Post if you love it, that's it.\n\nFancy it? Reply and we'll send the details.\n\nWingstop UK & Ireland`;
  const [copied, setCopied] = useState(false);
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="row" style={{ alignItems: 'baseline' }}>
        <h3>Invite draft</h3>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: '.8rem' }}>for {count} shortlisted · edit before sending</span>
          <button type="button" className="chip" onClick={() => { navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}>{copied ? 'Copied' : 'Copy'}</button>
        </span>
      </div>
      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '.9rem', margin: '10px 0 0', color: '#d7dcda' }}>{text}</pre>
    </div>
  );
}
