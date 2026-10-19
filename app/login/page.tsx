import { AREA_INFO } from '@/lib/areas';
import Link from 'next/link';
import { FlavourClubMark, LphFooter, WingstopMark } from '@/components/Brand';

export const dynamic = 'force-dynamic';

export default function Login({ searchParams }: { searchParams: { error?: string; area?: string; next?: string } }) {
  const area = AREA_INFO.find((a) => a.id === searchParams.area);
  return (
    <main className="login">
      <form method="post" action="/api/login">
        {area?.id === 'flavour' ? <FlavourClubMark height={56} /> : <WingstopMark height={48} />}
        <h1 style={{ fontSize: '3.4rem' }}>{area && area.id !== 'flavour' ? area.label : 'Sign in'}</h1>
        {area && <p className="cap" style={{ margin: 0 }}>{area.blurb}</p>}
        <label htmlFor="password" className="eyebrow">{area ? `${area.label} password` : 'Password'}</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
        {area && <input type="hidden" name="area" value={area.id} />}
        {searchParams.next && <input type="hidden" name="next" value={searchParams.next} />}
        {searchParams.error === 'locked' && <p className="cap" role="alert" style={{ color: 'var(--bad)', margin: 0 }}>Too many wrong passwords. Sign-in is paused on this connection for 15 minutes.</p>}
        {searchParams.error && searchParams.error !== 'locked' && <p className="cap" role="alert" style={{ color: 'var(--bad)', margin: 0 }}>That password doesn&apos;t open {area ? area.label : 'this'}. Try again.</p>}
        <button type="submit" className="chip primary" style={{ padding: '12px 14px', fontSize: '.9rem' }}>Unlock</button>
        <Link href="/" className="cap" style={{ textAlign: 'center' }}>Back to all areas</Link>
        <LphFooter />
      </form>
    </main>
  );
}
