// Shared (client-safe) description of the dashboard's areas and their pages.
export type AreaId = 'social' | 'competitor' | 'nso' | 'flavour' | 'paid';
export interface AreaInfo { id: AreaId; label: string; home: string; blurb: string; pages: { href: string; label: string }[] }

export const AREA_INFO: AreaInfo[] = [
  { id: 'social', label: 'Social', home: '/social', blurb: 'Our channels, our audience and inspo: shares, saves, comments, flavours, trends.', pages: [{ href: '/social', label: 'Our channels' }, { href: '/audience', label: 'Our audience' }, { href: '/inspo', label: 'Inspo' }] },
  { id: 'competitor', label: 'Competitor', home: '/competitors', blurb: 'Competitor Instagram and TikTok, breakouts, announcements and the Raising Cane’s tracker.', pages: [{ href: '/competitors', label: 'Competitor watch' }] },
  { id: 'nso', label: 'NSO', home: '/nso', blurb: 'Openings, city follower lift, scored local creators, local pages and press.', pages: [{ href: '/nso', label: 'NSO intelligence' }] },
  { id: 'paid', label: 'Paid', home: '/paid', blurb: 'Ad spend by agency, organic against paid, boosted posts and campaigns. Its own password: the master password does not open it.', pages: [{ href: '/paid', label: 'Paid' }] },
  { id: 'flavour', label: 'Flavour Club', home: '/flavour-club', blurb: 'The loyalty launch: posts, comments, questions, #wingstopflavourclub entries, press.', pages: [{ href: '/flavour-club', label: 'Flavour Club' }] },
];
