'use client';

// Leaflet map of QR scans by store: a heat layer for the overall picture, a circle per store you can hover and click.
// Area-level positions (see lib/stores.ts). Basemap: CARTO light/dark, matching the dashboard theme.
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

export interface MapPoint { code: string; name: string; place: string | null; lat: number; lng: number; total: number; latest: number; rank: number | null }

// CARTO raster tiles need a free key since 25 Sep 2026 (NEXT_PUBLIC_CARTO_KEY in Vercel). Without one the map
// falls back to standard OpenStreetMap tiles, which need no key (light use, attribution required).
const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_KEY;
const TILE = (dark: boolean) => CARTO_KEY
  ? `https://basemaps.cartocdn.com/rastertiles/${dark ? 'dark_all' : 'light_all'}/{z}/{x}/{y}.png?key=${encodeURIComponent(CARTO_KEY)}`
  : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTR = `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors${CARTO_KEY ? ' &copy; <a href="https://carto.com/attributions">CARTO</a>' : ''} · places: Ordnance Survey via postcodes.io`;
const isDark = () => (typeof document !== 'undefined' ? document.documentElement.dataset.theme !== 'light' : true);

/** Same-place stores (two in Reading, two in Manchester) get a small, stable nudge so both stay clickable. */
function spread(points: MapPoint[]): MapPoint[] {
  const seen = new Map<string, number>();
  return points.map((p) => {
    const k = `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`; const n = seen.get(k) ?? 0; seen.set(k, n + 1);
    if (!n) return p;
    const a = n * 2.4; return { ...p, lat: p.lat + 0.012 * Math.cos(a), lng: p.lng + 0.02 * Math.sin(a) };
  });
}

export default function ScanMap({ points, selected, onSelect, mode }: { points: MapPoint[]; selected: string | null; onSelect: (code: string) => void; mode: 'heat' | 'dots' }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const markers = useRef<Map<string, L.CircleMarker>>(new Map());

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true, scrollWheelZoom: false, attributionControl: true }).setView([54.3, -3.2], 5.4);
    tiles.current = L.tileLayer(TILE(isDark()), { attribution: ATTR, maxZoom: 18 }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    const obs = new MutationObserver(() => tiles.current?.setUrl(TILE(isDark())));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { obs.disconnect(); m.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current, g = layer.current;
    if (!m || !g) return;
    g.clearLayers(); markers.current.clear();
    const pts = spread(points);
    const max = Math.max(1, ...pts.map((p) => p.total));
    if (mode === 'heat') {
      const heat = (L as unknown as { heatLayer: (p: [number, number, number][], o: object) => L.Layer }).heatLayer(
        pts.filter((p) => p.total > 0).map((p) => [p.lat, p.lng, Math.sqrt(p.total / max)]),
        { radius: 34, blur: 26, maxZoom: 9, minOpacity: 0.25, gradient: { 0.2: '#00A78A', 0.5: '#FFCF00', 0.8: '#FF7A00', 1: '#E4002B' } },
      );
      g.addLayer(heat);
    }
    for (const p of [...pts].sort((a, b) => a.total - b.total)) {
      const r = p.total ? 4 + 18 * Math.sqrt(p.total / max) : 4;
      const c = L.circleMarker([p.lat, p.lng], {
        radius: mode === 'heat' ? Math.max(4, r * 0.45) : r,
        color: p.total ? '#00A78A' : '#8a8a8a', weight: 1.5,
        fillColor: p.total ? '#00A78A' : 'transparent', fillOpacity: mode === 'heat' ? 0.15 : 0.55,
      });
      c.bindTooltip(`<b>${p.rank ? `#${p.rank} · ` : ''}${p.name}</b><br/>${p.total.toLocaleString('en-GB')} scans${p.latest ? ` · ${p.latest.toLocaleString('en-GB')} on the latest day` : ''}${p.place && p.place !== p.name ? `<br/><span style="opacity:.7">placed at ${p.place}</span>` : ''}`, { direction: 'top', offset: [0, -4] });
      c.on('click', () => onSelect(p.code));
      c.addTo(g); markers.current.set(p.code, c);
    }
  }, [points, mode, onSelect]);

  useEffect(() => {
    const m = map.current; const c = selected ? markers.current.get(selected) : null;
    markers.current.forEach((mk, code) => mk.setStyle({ color: code === selected ? '#FFCF00' : (mk.options.color === '#8a8a8a' ? '#8a8a8a' : '#00A78A'), weight: code === selected ? 3 : 1.5 }));
    if (m && c) { m.flyTo(c.getLatLng(), Math.max(m.getZoom(), 9), { duration: 0.6 }); c.openTooltip(); }
  }, [selected]);

  return <div ref={el} className="scanmap" role="region" aria-label="Map of QR scans by store" />;
}
