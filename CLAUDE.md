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
- App: https://wssocial.vercel.app (team password, set as DASHBOARD_PASSWORD in Vercel; ask Diri, never commit it)
- Pages:
  - `/` Our channels: shares, saves, reposts toplines, post wall (playable), comments arena, mentions, weekly output, Sprout numbers
  - `/audience` Our audience: following, last full day, mood and comment themes, flavour pulse (10 core + Hot Honey + Sriracha Hot Honey), unprompted mentions, demographics
  - `/competitors` Competitor watch: scoreboard, growth over time, breakouts wall, announcements per brand, Raising Cane's tracker, buzz
  - `/nso` NSO intelligence: openings, city follower lift, scored local creators (shared shortlist, Modash CSV import, export), local pages and press, local chatter
- Repo: github.com/dirujans/wssocial (main deploys to Vercel automatically)
- Vercel project `prj_JPOuJzW1RWATKyA0aM4ZdcsnJbNL` (Hobby). Vercel Authentication is still on; Diri hasn't decided whether to turn it off.
- Supabase project `ycttedwwcsjakieisnkb`. Migrations in `supabase/migrations/` (0001 to 0005), all applied.

## Stack and code map
- Next.js 14 App Router, Recharts, Supabase (service role, server only), HMAC cookie sign-in (`lib/auth.ts`).
- Brand: black and white lead, Opal #00A78A, flavour colours as accents. Archivo (wdth axis) stands in for Roc Grotesk until font files arrive.
- `lib/windsor.ts` all Windsor fetchers; `lib/sync.ts` runs them in parallel and upserts (one failing source never blocks the rest; every run logged to `sync_log`).
- Pure, tested logic: `lib/social.ts`, `lib/metrics.ts`, `lib/alerts.ts`, `lib/competitors.ts`, `lib/audience.ts`, `lib/nso.ts`. Tests: `npm test` (22 passing). Types: `npm run typecheck`.
- Loaders in `lib/data.ts`; one client component per page in `components/`.
- Local builds in the Claude workspace: Google Fonts is blocked, so stub `next/font` in `app/layout.tsx` for the build and restore it after (check `grep next/font app/layout.tsx`).

## Data sources (Windsor.ai)
- `sproutsocial` account 2454071: channel totals and posts. Never request sentiment fields (plan refuses, whole call fails).
- `instagram` UK 17841403911240491 and IE 17841477228197665: media, saves, shares, reposts, comments, demographics. follower_count only covers 30 days.
- `tiktok_organic`: videos, comments, demographics. Account data 60 days; latest days come back as zeros.
- `instagram_public` (competitors, by handle, added in Windsor): wingstopuk, kfc_uki, nandosuk, mcdonaldsuk, popeyesuk, daveshotchickenuk; raisingcanes_uk and slimchickensuk added but not returning data yet. Only likes and comments for other accounts (no views, shares, saves). Popeyes appears to hide likes.
- Cron syncs at 02:45 and 05:30 UTC (`vercel.json`), plus the Sync now button.

## Scheduled tasks (Claude)
- Daily social report 07:47 London (`trig_01XgA2qvHZRemRMnD9KLADmx`): report to Diri, inserts `mentions` and `competitor_items`.
- Diri's own competitor brief 07:59 (`trig_01ADLPb42PW2LbSYc5osREZM`): leave alone.
- Weekly NSO research Mondays 08:26 (`trig_01KbQNFtvy7xNerx2aQViyjb`): new openings, local pages and creators.

## Open items and next up
1. Apify token (`APIFY_TOKEN` in Vercel): unlocks competitor TikTok (plays, shares, saves), reel views, local creator discovery, Google Trends share of search, a one-off Social Blade follower back-fill.
2. Inspo page: TikTok Creative Center trends (UK sounds and hashtags) filtered as "ours" or "skip", a reply-with-video bank from comments, and creator content about us to react to.
3. Google reviews per store (Windsor `google_my_business`), paid against organic (Meta and TikTok Ads), a moments calendar.
4. Biggest gap: no business number. Connect Flavour Club sign-ups, app orders or weekly store sales so social can be read against sales.
5. Confirm the UK core ten flavour list in `lib/audience.ts` with Diri.
6. Roc Grotesk font files and the white Wingstop logo from Diri.
