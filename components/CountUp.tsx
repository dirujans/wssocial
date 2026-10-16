'use client';

import { useEffect, useRef, useState } from 'react';

/** Counts up to `value` on first view and whenever it changes. Static for reduced-motion users. */
export default function CountUp({ value, format, duration = 1100 }: { value: number | null | undefined; format: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState<number>(value ?? 0);
  const from = useRef(0);
  useEffect(() => {
    if (value == null) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setShown(value); from.current = value; return; }
    const start = performance.now(), a = from.current, b = value;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(a + (b - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{value == null ? '—' : format(shown)}</>;
}
