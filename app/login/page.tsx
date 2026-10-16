export const dynamic = 'force-dynamic';

export default function Login({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <main className="wrap" style={{ maxWidth: 420, paddingTop: '18vh' }}>
      <h1>Wingstop UK Social</h1>
      <form method="post" action="/api/login" className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label htmlFor="password" className="label">Team password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus
          style={{ font: 'inherit', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', color: 'var(--fg)' }} />
        {searchParams.error && <p className="cap" role="alert" style={{ color: 'var(--bad)', margin: 0 }}>That password didn&apos;t match. Try again.</p>}
        <button type="submit" className="chip" style={{ padding: '10px 12px', fontWeight: 600 }}>Sign in</button>
      </form>
    </main>
  );
}
