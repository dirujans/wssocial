'use client';

import { useId } from 'react';

/** Area sparkline with a marked last point. Width follows its container. */
export default function Sparkline({ values, colour = 'var(--opal)', height = 64 }: { values: number[]; colour?: string; height?: number }) {
  const id = useId().replace(/:/g, '');
  if (values.length < 2) return null;
  const W = 300, H = height, max = Math.max(...values, 1), min = 0;
  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => H - 4 - ((v - min) / (max - min || 1)) * (H - 12);
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  const lx = x(values.length - 1), ly = y(values[values.length - 1]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`g${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={{ stopColor: colour, stopOpacity: 0.45 }} />
          <stop offset="1" style={{ stopColor: colour, stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#g${id})`} />
      <path d={line} fill="none" stroke={colour} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r={3.5} fill={colour} />
    </svg>
  );
}
