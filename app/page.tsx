import Link from 'next/link';
import { AREA_INFO } from '@/lib/areas';
import { signedInAreas } from '@/lib/auth';
import ThemeToggle from '@/components/ThemeToggle';

export const dynamic = 'force-dynamic';

/** Front door: pick an area. Each area has its own password; the master password opens all of them. */
export default function Home() {
  const areas = signedInAreas();
  return (
    <main className="shell chooser">
      <header className="hero">
        <div className="inner">
          <div className="row" style={{ alignItems: 'center' }}>
            <span className="wordmark">Wingstop UK&amp;I<span className="dot" />Intelligence</span>
            <span style={{ display: 'flex', gap: 8 }}><ThemeToggle />{areas.length > 0 && <form method="post" action="/api/logout"><button type="submit" className="chip">Sign out</button></form>}</span>
          </div>
          <h1>What do you need?</h1>
          <p className="take">Pick an area. Each one has its own password, so people only see what they need.</p>
        </div>
      </header>
      <section className="band">
        <div className="inner">
          <div className="areagrid">
            {AREA_INFO.map((a, i) => {
              const open = areas.includes(a.id);
              return (
                <Link key={a.id} href={open ? a.home : `/login?area=${a.id}&next=${encodeURIComponent(a.home)}`} className={`areacard rise d${i + 1}`} data-area={a.id}>
                  <span className="eyebrow">{open ? 'Unlocked' : '🔒 Password'}</span>
                  <span className="areaname">{a.label}</span>
                  <span className="areablurb">{a.blurb}</span>
                  <span className="go">{open ? 'Open →' : 'Unlock →'}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
