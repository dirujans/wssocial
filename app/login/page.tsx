export const dynamic = 'force-dynamic';

export default function Login({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <main className="login">
      <form method="post" action="/api/login">
        <span className="wordmark">Wingstop UK&amp;I<span className="dot" />Social</span>
        <h1 style={{ fontSize: '3.4rem' }}>Social pulse</h1>
        <label htmlFor="password" className="eyebrow">Team password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
        {searchParams.error && <p className="cap" role="alert" style={{ color: 'var(--bad)', margin: 0 }}>That password didn&apos;t match. Try again.</p>}
        <button type="submit" className="chip primary" style={{ padding: '12px 14px', fontSize: '.9rem' }}>Sign in</button>
      </form>
    </main>
  );
}
