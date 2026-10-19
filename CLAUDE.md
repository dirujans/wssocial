# Wingstop UK&I Social: project brief for Claude

Read this first in any new session. It is the handover: what exists, where it lives, the rules, and what's next.

## Who and how
- Owner: Diri, Chief Brand Officer, Wingstop UK & Ireland (Lemon Pepper Holdings).
- Writing: UK English. Never em dashes. Never the "it's not X, it's Y" construction. Direct, opinionated; stress-test, don't validate.
- Brand copy never compares Wingstop to other brands and never recommends copying a competitor. (Internal comparison data on the dashboard is fine.)
- Never invent numbers, handles or dates. Anything researched carries a dated source. Say plainly what a platform can't give.
- Never ask for API keys, tokens or service-role keys in chat: they go into Vercel environment variables only.
- Diri has consented to changes on Supabase, GitHub (push to main) and Vercel for this project. Windsor write actions need explicit confirmation each time.

## What's live
- App: https://wssocial.vercel.app
- Areas and passwords (`lib/auth.ts`, `lib/areas.ts`): `/` is a public chooser (Social, Competitor, NSO, Flavour Club). Each area has its own password in Vercel env: SOCIAL_PASSWORD, COMPETITOR_PASSWORD, NSO_PASSWORD, FLAVOUR_CLUB_PASSWORD. DASHBOARD_PASSWORD is the master and opens every area. Signing into more areas adds to one HMAC cookie (`ws_session`). A Flavour Club-only sign-in sees only the Flavour Club tab: loyalty is kept apart from BAU social on purpose. Never commit passwords.
- Every page: sticky top bar (area tabs, sub-pages, light/dark toggle saved in localStorage `ws-theme`, sign out) and a "Jump to" section nav (`components/SectionNav.tsx`: rail on wide screens, floating button on smaller ones). Theme tokens in `app/globals.css` (`:root` dark, `[data-theme=light]`).
- Pages:
  - `/flavour-club` (Flavour Club area) Loyalty launched 19 Oct 2026: pulse, club posts, what people say (themes, topics), questions to answer (mark answered), opportunities, #wingstopflavourclub entries (shortlist, winner, skip), press and online, loyalty landscape. Sign-up traffic section (`components/FcTraffic.tsx`): Bitly clicks and QR scans, TikTok vs Instagram links head to head, in-store (table tents per store, A-boards, receipts), daily columns. Scans section (`components/FcScans.tsx`, `components/ScanMap.tsx`): placements (any utm_source label shows on its own), store leaderboard with podium, Leaflet heat map (CARTO tiles), stores with no scans; periods all time, since launch, 14 days. Stores in `fc_stores`, placed at area level by `lib/stores.ts` (postcodes.io OS Open Names; shopping-centre overrides in `STORE_PLACE`), new ones geocoded by the intel sync or `/api/apify/probe?geocode=stores`. Logic in `lib/flavourClub.ts` (`linkChannel` reads utm_source; untagged links mapped in `UNTAGGED`); tables `fc_entries`, `fc_marks`, `fc_link_days`; mentions with `topic = 'flavour_club'`.
  - `/social` (Social area) Our channels: shares, saves, reposts toplines, post wall (playable), comments arena, mentions, weekly output, Sprout numbers
  - `/audience` (Social) Our audience: following, last full day, mood and comment themes, flavour pulse (10 core + Hot Honey + Sriracha Hot Honey), unprompted mentions, demographics
  - `/competitors` (Competitor) Competitor watch: scoreboard, growth over time, breakouts wall, announcements per brand, Raising Cane's tracker, buzz
  - `/nso` (NSO) NSO intelligence: openings, city follower lift, scored local creators (shared shortlist, Modash CSV import, export), local pages and press, local chatter
  - `/inspo` (Social) Inspo: UK trending hashtags filtered ours/maybe/skip (team marks saved), sounds in rivals' TikToks, reply-with-video bank, creator content about us, rivals' highest pass-on TikToks
- Repo: github.com/dirujans/wssocial (main deploys to Vercel automatically)
- Vercel project `prj_JPOuJzW1RWATKyA0aM4ZdcsnJbNL` (Hobby). Vercel Authentication is still on; Diri hasn't decided whether to turn it off.
- Supabase project `ycttedwwcsjakieisnkb`. Migrations in `supabase/migrations/` (0001 to 0008), all applied.

## Stack and code map
- Next.js 14 App Router, Recharts, Supabase (service role, server only), HMAC cookie sign-in (`lib/auth.ts`).
- Brand: black and white lead, Opal #00A78A, flavour colours as accents. Logos in `public/brand` via `components/Brand.tsx`: Wingstop (white outline SVG, from Diri's vector) leads the top bar, chooser and sign-in; the Flavour Club lock-up replaces it on the Flavour Club area only; LPH (Lemon Pepper Holdings) is subtle: top right of the bar (hidden on phones) and every footer. Archivo (wdth axis) stands in for Roc Grotesk until font files arrive.
- `lib/windsor.ts` all Windsor fetchers; `lib/sync.ts` runs them in parallel and upserts (one failing source never blocks the rest; every run logged to `sync_log`).
- Pure, tested logic: `lib/social.ts`, `lib/metrics.ts`, `lib/alerts.ts`, `lib/competitors.ts`, `lib/audience.ts`, `lib/nso.ts`, `lib/flavourClub.ts`. Tests: `npm test` (34 passing). Types: `npm run typecheck`.
- Loaders in `lib/data.ts`; one client component per page in `components/`.
- Local builds in the Claude workspace: Google Fonts is blocked, so stub `next/font` in `app/layout.tsx` for the build and restore it after (check `grep next/font app/layout.tsx`).

## Data sources (Windsor.ai)
- `sproutsocial` account 2454071: channel totals and posts. Never request sentiment fields (plan refuses, whole call fails).
- `instagram` UK 17841403911240491 and IE 17841477228197665: media, saves, shares, reposts, comments, demographics. follower_count only covers 30 days.
- `tiktok_organic`: videos, comments, demographics. Account data 60 days; latest days come back as zeros.
- `instagram_public` (competitors, by handle, added in Windsor): wingstopuk, kfc_uki, nandosuk, mcdonaldsuk, popeyesuk, daveshotchickenuk; raisingcanes_uk and slimchickensuk added but not returning data yet. Only likes and comments for other accounts (no views, shares, saves). Popeyes appears to hide likes.
- Crons (`vercel.json`, Hobby so timing is within the hour): `/api/sync?part=core` 02:45 and 05:30 UTC (Sprout, our IG and TikTok, comments, alerts; ~45s), `?part=intel` 03:05 and 05:50 (competitors, audience, Apify; ~10s). Each sync writes a 'running' row to `sync_log` first, so a run killed at the 60s limit shows up. Sync now runs both halves. Crons silently failed 17 to 19 Oct (whole sync near 60s and/or secret mismatch); fixed 19 Oct.
- Windsor caches each exact URL for 6 hours, so `lib/windsor.ts` adds a per-minute `_run` param; without it same-day comments never land.
- Use `T` date presets (e.g. `last_14dT`) or today's posts are missing.
- Supabase client forces `cache: 'no-store'`: Next's fetch cache otherwise served stale reads inside route handlers.

## Bitly (connected natively as a Claude connector, group Bp18hXuDgTN)
- No Windsor connector for Bitly. The app has no Bitly token; `fc_link_days` is filled by the scheduled task below using the Bitly connector's export (link_engagements_timeseries, filter destination flavourclub.co.uk).
- Social links: bit.ly/flavourc-tt, bit.ly/flavourc-ig (both UTM tagged). Untagged: bit.ly/4ykeSfR (IG homepage), bit.ly/4s0z9W0 (TT homepage). In-store: one QR per store (utm_source=table_tent, utm_content=store code, restaurant_name), A-board QR, receipt QR.
- The team tagged the QR codes 'FlavourClub' in Bitly, but link exports don't see QR tags; filter by destination instead.
- GA4 not yet connected in Windsor: needed for actual sign-ups.

## Apify (free plan, $5 a month credit; APIFY_TOKEN in Vercel)
- Driven by the sync (`lib/apifyJobs.ts`): each sync collects finished runs, then starts due ones. Runs logged in `apify_runs` (cost in `usd`).
- Cadence (`lib/apifyJobs.ts`): Flavour Club hashtag hunt every ~46h on TikTok (clockworks, hashtags) and Instagram (`apify/instagram-hashtag-scraper`) into `fc_entries`; competitor TikTok and UK trends weekly (~160h). Daily runs need a paid Apify plan.
- `clockworks/tiktok-scraper`: latest 12 videos for `TIKTOK_HANDLES` in `lib/tiktok.ts` (wingstopuk, kfc_uki, nandosuk, mcdonaldsuk, popeyesuk, daveshotchickenuk, raisingcanes, raisingcanes_uk). Gives plays, likes, comments, shares, saves. About $0.32 a run (~$0.007 a video). Note: TikTok "kfcuki" is an unrelated fan account; KFC is kfc_uki. Slim Chickens has no UK TikTok we could find. raisingcanes_uk is unverified.
- `data_xplorer/tiktok-trends`: top 40 UK hashtags, 7 days. ~$0.10 a run. TikTok no longer exposes the UK sounds chart to these tools.
- `/api/apify/probe` is a test route guarded by a short-lived key in `ops_keys` (insert one with an expiry; never commit it). `?only=tiktok&input=<json>` tests an actor, `?run=jobs` runs the step, `?abort=<runId>` stops a run.
- `apify/instagram-scraper` was too slow to start inside the 60s limit; not used.

## Scheduled tasks (Claude)
- Daily social report 07:47 London (`trig_01XgA2qvHZRemRMnD9KLADmx`): report to Diri with a Flavour Club section, inserts `mentions` (Flavour Club ones with topic `flavour_club`) and `competitor_items`.
- Flavour Club Instagram comment top-up 07:32 London (`trig_01GVBeqVTcVagMVmNNd4ei6c`): Windsor MCP to `comments` while Windsor's REST feed lags. Switch off once the sync catches up.
- Flavour Club link tracking 07:20 London (`trig_01NSBbdmf58Vh9Pk38i4LvR3`): Bitly export to `fc_link_days`.
- Diri's own competitor brief 07:59 (`trig_01ADLPb42PW2LbSYc5osREZM`): leave alone.
- Weekly NSO research Mondays 08:26 (`trig_01KbQNFtvy7xNerx2aQViyjb`): new openings, local pages and creators.

## Open items and next up
0. Flavour Club: founding-member hunt post 20 Oct. Hashtag search only finds public posts; Instagram tags and Stories mentioning us aren't visible to any tool we have.
1. Apify next: Google Trends share of search, local creator discovery for NSO, a one-off Social Blade follower back-fill. Watch the monthly credit in `apify_runs`.
2. Google reviews per store (Windsor `google_my_business`), paid against organic (Meta and TikTok Ads), a moments calendar.
3. Biggest gap: no business number. Connect Flavour Club sign-ups, app orders or weekly store sales so social can be read against sales.
4. Confirm the UK core ten flavour list in `lib/audience.ts` with Diri.
5. Roc Grotesk font files from Diri. (Logos received 19 Oct.)
6. Bitly history backfilled from 17 Jun 2026. 22 Sep shows one scan on nearly every table tent: likely a test sweep.
