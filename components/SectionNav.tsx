'use client';

import { useEffect, useState } from 'react';

/**
 * "Jump to" navigation that travels with you: a rail on wide screens, a floating button with a sheet on phones.
 * Highlights the section in view. Sections are found by id on the page.
 */
export default function SectionNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? '');
  const [open, setOpen] = useState(false);
  const ids = sections.map((s) => s.id).join('|');
  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
    if (!els.length || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActive(visible.target.id);
    }, { rootMargin: '-120px 0px -55% 0px' });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 118, behavior: reduce ? 'auto' : 'smooth' });
    setActive(id); setOpen(false);
  };

  return (
    <>
      <nav className="jumprail" aria-label="Jump to section">
        <span className="eyebrow">Jump to</span>
        {sections.map((s) => <button key={s.id} type="button" aria-current={active === s.id ? 'true' : undefined} onClick={() => go(s.id)}>{s.label}</button>)}
        <button type="button" className="totop" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>↑ Top</button>
      </nav>
      <div className="jumpfab">
        {open && (
          <div className="jumpsheet" role="dialog" aria-label="Jump to section">
            {sections.map((s) => <button key={s.id} type="button" aria-current={active === s.id ? 'true' : undefined} onClick={() => go(s.id)}>{s.label}</button>)}
            <button type="button" onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setOpen(false); }}>↑ Back to top</button>
          </div>
        )}
        <button type="button" className="chip primary" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? 'Close' : `Jump to · ${sections.find((s) => s.id === active)?.label ?? ''}`}</button>
      </div>
    </>
  );
}
