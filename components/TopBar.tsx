'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AREA_INFO, type AreaId } from '@/lib/areas';
import ThemeToggle from './ThemeToggle';
import { FlavourClubMark, LphMark, WingstopMark } from './Brand';

/** Sticky top bar on every page: area switcher (locked areas show a lock), pages within the area, theme switch. */
export default function TopBar({ areas }: { areas: AreaId[] }) {
  const path = usePathname() ?? '/';
  const current = AREA_INFO.find((a) => a.pages.some((p) => p.href === path));
  // Flavour Club-only sessions never see the rest of the dashboard in the bar.
  const flavourOnly = areas.length === 1 && areas[0] === 'flavour';
  // Paid has its own password and only appears once it's unlocked.
  const shown = flavourOnly ? AREA_INFO.filter((a) => a.id === 'flavour') : AREA_INFO.filter((a) => a.id !== 'paid' || areas.includes('paid'));
  return (
    <header className="topbar">
      <div className="inner">
        <Link href="/" className="brandmark" aria-label="All areas">{current?.id === 'flavour' ? <FlavourClubMark height={30} /> : <WingstopMark height={30} />}</Link>
        <nav className="areas" aria-label="Areas and pages">
          {shown.map((a) => {
            const open = areas.includes(a.id);
            return (
              <Link key={a.id} href={open ? a.home : `/login?area=${a.id}&next=${encodeURIComponent(a.home)}`} className="area-tab" aria-current={current?.id === a.id ? 'page' : undefined}>
                {!open && <span aria-hidden="true" className="lock">🔒</span>}{a.label}
              </Link>
            );
          })}
          {current && current.pages.length > 1 && <span className="tb-sep" aria-hidden="true" />}
          {current && current.pages.length > 1 && current.pages.map((p) => <Link key={p.href} href={p.href} className="subpage" aria-current={p.href === path ? 'page' : undefined}>{p.label}</Link>)}
        </nav>
        <span className="tb-right">
          <LphMark height={16} />
          <ThemeToggle />
          <form method="post" action="/api/logout"><button type="submit" className="chip" title="Sign out on this device">Sign out</button></form>
        </span>
      </div>
    </header>
  );
}
