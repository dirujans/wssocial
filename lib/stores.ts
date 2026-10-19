// Store locations for the Flavour Club scans map. Area-level, not street-level: each store is placed at the
// Ordnance Survey place (via postcodes.io, open data) that best matches its name. Shopping-centre and
// neighbourhood names that aren't towns are mapped to the area they sit in below.
import { fetchWithRetry } from './http';
import { linkStore } from './flavourClub';
import { supabaseAdmin } from './supabase';

/** fixed: town-centre coordinates for places the open GB data doesn't cover (Northern Ireland) or files under another name. */
type Hint = { q: string; region?: RegExp; fixed?: [number, number] };
const LDN = /London/i;
/** Store name → place to look up. Add here when a new store doesn't match a town name. */
export const STORE_PLACE: Record<string, Hint> = {
  'Glasgow Fort': { q: 'Easterhouse' }, 'Fort Kinnaird': { q: 'Newcraighall' }, Silverburn: { q: 'Pollok' },
  'Trafford Centre': { q: 'Urmston' }, Bluewater: { q: 'Greenhithe' }, Lakeside: { q: 'West Thurrock' }, 'Merry Hill': { q: 'Brierley Hill' },
  Bullring: { q: 'Birmingham' }, 'Birmingham New Street': { q: 'Birmingham' }, 'Rushden Lakes': { q: 'Rushden' },
  'Bristol Cribbs': { q: 'Patchway' }, 'Bristol Queens Road': { q: 'Clifton', region: /South West/i }, 'Bristol Cabot Circus': { q: 'Bristol' },
  'Parrs Wood': { q: 'East Didsbury' }, 'Sheffield Meadowhall': { q: 'Wincobank' },
  'Liverpool New Mersey': { q: 'Speke' }, 'Liverpool Shopping Park': { q: 'Old Swan' }, 'Liverpool Lord Street': { q: 'Liverpool' },
  'Leeds Springs': { q: 'Colton', region: /Yorkshire/i }, 'Leeds White Rose': { q: 'Beeston', region: /Yorkshire/i }, 'Leeds Cardigan Fields': { q: 'Kirkstall' }, 'Leeds Boar Lane': { q: 'Leeds' },
  'Manchester Arndale': { q: 'Manchester' }, 'Manchester Piccadilly': { q: 'Manchester' },
  'Newcastle Eldon Square': { q: 'Newcastle upon Tyne' }, 'Newcastle Gateshead': { q: 'Gateshead' },
  'Nottingham St Peters Square': { q: 'Nottingham' },
  'Edinburgh St James Quarter': { q: 'Edinburgh' }, 'Edinburgh Fountain Park': { q: 'Fountainbridge' }, 'Falkirk Central': { q: 'Falkirk' }, Fife: { q: 'Dunfermline' },
  // OS Open Names is Great Britain only, so Northern Ireland stores use town-centre coordinates.
  'Belfast Dundonald': { q: 'Dundonald (NI)', fixed: [54.594, -5.811] }, 'Belfast Rushmere': { q: 'Craigavon', fixed: [54.447, -6.387] }, 'Belfast Boucher Road': { q: 'Belfast', fixed: [54.597, -5.930] },
  Swansea: { q: 'Swansea', fixed: [51.621, -3.944] },
  'Reading Gateway': { q: 'Reading' }, 'Reading Oracle': { q: 'Reading' }, 'Luton Retail Park': { q: 'Luton' }, 'Crawley West Green': { q: 'Crawley' },
  'Cambridge Lion Yard': { q: 'Cambridge', region: /East/i }, 'Glasgow St Enoch': { q: 'Glasgow' }, Staines: { q: 'Staines-upon-Thames' }, Southend: { q: 'Southend-on-Sea' },
  'Merthyr Tydfil': { q: 'Merthyr Tydfil' }, Kingston: { q: 'Kingston upon Thames' },
  'Wandsworth Southside': { q: 'Wandsworth', region: LDN }, Wandsworth: { q: 'Wandsworth', region: LDN }, 'Gloucester Road': { q: 'South Kensington', region: LDN },
  'Cambridge Circus': { q: 'Soho', region: LDN }, Queensway: { q: 'Bayswater', region: LDN }, Stratford: { q: 'Stratford', region: LDN },
  "Shepherd's Bush": { q: "Shepherd's Bush", region: LDN }, Ealing: { q: 'Ealing', region: LDN }, Walthamstow: { q: 'Walthamstow', region: LDN },
  Streatham: { q: 'Streatham', region: LDN }, 'Wood Green': { q: 'Wood Green', region: LDN }, Beckton: { q: 'Beckton', region: LDN }, Hounslow: { q: 'Hounslow', region: LDN },
  Dalston: { q: 'Dalston', region: LDN }, Croydon: { q: 'Croydon', region: LDN }, Bromley: { q: 'Bromley', region: LDN }, Clapham: { q: 'Clapham', region: LDN },
  Islington: { q: 'Islington', region: LDN }, Vauxhall: { q: 'Vauxhall', region: LDN }, Harrow: { q: 'Harrow', region: LDN }, Uxbridge: { q: 'Uxbridge', region: LDN },
  Bexleyheath: { q: 'Bexleyheath', region: LDN }, Romford: { q: 'Romford', region: LDN },
};

export interface Place { name_1: string; local_type?: string; region?: string; country?: string; latitude: number; longitude: number }
const RANK: Record<string, number> = { City: 0, Town: 1, 'Suburban Area': 2, Village: 3, Hamlet: 4, 'Other Settlement': 5 };

/** Pick the best postcodes.io place for a hint: exact name, then region, then settlement size. Pure, so it is tested. */
export function pickPlace(places: Place[], hint: Hint): Place | null {
  const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").trim();
  const named = places.filter((p) => norm(p.name_1) === norm(hint.q) && typeof p.latitude === 'number');
  const pool = (hint.region ? named.filter((p) => hint.region!.test(`${p.region ?? ''} ${p.country ?? ''}`)) : named);
  // A region hint is strict: "Dundonald" in Ayrshire must never stand in for Dundonald near Belfast.
  const list = hint.region ? pool : named;
  return [...list].sort((a, b) => (RANK[a.local_type ?? ''] ?? 9) - (RANK[b.local_type ?? ''] ?? 9))[0] ?? null;
}

async function lookup(hint: Hint): Promise<Place | null> {
  const res = await fetchWithRetry(`https://api.postcodes.io/places?q=${encodeURIComponent(hint.q)}&limit=25`, {}, 1, 500);
  const j = (await res.json()) as { result?: Place[] | null };
  return pickPlace(j.result ?? [], hint);
}

/** Add stores seen in Bitly that aren't in fc_stores yet, then place up to `max` stores that have no coordinates. */
export async function geocodeStores(max = 30): Promise<{ added: number; placed: number; missed: string[] }> {
  const db = supabaseAdmin();
  const [{ data: links }, { data: known }] = await Promise.all([
    db.from('fc_link_days').select('destination').like('destination', '%utm_source=table_tent%').limit(10000),
    db.from('fc_stores').select('code,name,lat'),
  ]);
  const have = new Set((known ?? []).map((s) => s.code));
  const fresh = new Map<string, string>();
  for (const l of links ?? []) { const s = linkStore(l.destination); if (s?.code && !have.has(s.code)) fresh.set(s.code, s.store); }
  if (fresh.size) await db.from('fc_stores').upsert([...fresh].map(([code, name]) => ({ code, name })), { onConflict: 'code', ignoreDuplicates: true });
  const { data: todo } = await db.from('fc_stores').select('code,name').is('lat', null).limit(max);
  let placed = 0; const missed: string[] = [];
  for (const s of todo ?? []) {
    const hint = STORE_PLACE[s.name] ?? { q: s.name };
    let p: Place | null = hint.fixed ? { name_1: hint.q, local_type: 'Town', region: 'Fixed', latitude: hint.fixed[0], longitude: hint.fixed[1] } : await lookup(hint).catch(() => null);
    if (!p && !STORE_PLACE[s.name] && s.name.includes(' ')) p = await lookup({ q: s.name.split(' ')[0] }).catch(() => null);
    if (!p) { missed.push(s.name); continue; }
    const { error } = await db.from('fc_stores').update({ lat: p.latitude, lng: p.longitude, place: p.name_1, region: p.region ?? p.country ?? null, geocoded_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('code', s.code);
    if (!error) placed++;
  }
  return { added: fresh.size, placed, missed };
}
