/* eslint-disable @next/next/no-img-element */
// Brand marks. Wingstop leads; the Flavour Club lock-up replaces it on the Flavour Club area only;
// LPH (Lemon Pepper Holdings, the operating company) stays quiet: top right of the bar and the footer.

export function WingstopMark({ height = 30 }: { height?: number }) {
  return <img src="/brand/wingstop-white.svg" alt="Wingstop" height={height} style={{ height, width: 'auto', display: 'block' }} />;
}

export function FlavourClubMark({ height = 34 }: { height?: number }) {
  return <img src="/brand/flavour-club.png" alt="Wingstop Flavour Club" height={height} style={{ height, width: 'auto', display: 'block' }} />;
}

/** White mark on dark, black on light. */
export function LphMark({ height = 18, title = 'Lemon Pepper Holdings' }: { height?: number; title?: string }) {
  return (
    <span className="lph" title={title} aria-label={title} role="img">
      <img src="/brand/lph-white.png" alt="" className="lph-on-dark" height={height} style={{ height, width: 'auto' }} />
      <img src="/brand/lph-black.png" alt="" className="lph-on-light" height={height} style={{ height, width: 'auto' }} />
    </span>
  );
}

export function LphFooter() {
  return <p className="lph-foot"><LphMark height={14} /><span>Wingstop UK &amp; Ireland is operated by Lemon Pepper Holdings. Internal use only.</span></p>;
}
