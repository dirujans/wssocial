# Wingstop UK Social

The team's view of how Wingstop UK & Ireland's own channels are doing, and what people are saying under the posts.

- **Data:** Sprout Social (channel totals and posts), Instagram UK and Ireland (comments) and TikTok (comments), all through Windsor.ai.
- **Sync:** `/api/sync` runs daily at 05:30 UTC (06:30 London in summer) on Vercel cron, before the 07:47 daily report. Sprout only updates daily, so more often adds little. On a Pro plan you can make it more frequent in `vercel.json`. It writes to Supabase and raises alerts.
- **Dashboard:** `/` sits behind a team password. You can switch the period (7, 28 or 60 days) and filter everything to one channel. Click a day to see its posts, and click a post to read its comments. Comments are tagged by theme.
- **Alerts:** an alert fires for:
  - a channel day at more than 2x, or less than 0.4x, its 28-day average
  - pushback comments with 25+ likes
  - any comment with 200+ likes

  Each event alerts once (stable ids), and alerts can be dismissed.

Mentions and tags by other accounts are not available through Windsor. The daily social report (a Claude scheduled task) covers them by web search.

## Set up (about 15 minutes)

1. **Supabase:** create a project, open SQL Editor and run `supabase/migrations/0001_init.sql`.
2. **Windsor:** copy the API key from https://onboard.windsor.ai/app/data-preview.
3. **Vercel:** import this repo, then add the variables from `.env.example` under Settings > Environment Variables:
   - `WINDSOR_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET` (any long random string)
   - `DASHBOARD_PASSWORD`
4. **Deploy**, then fill the database once instead of waiting for the cron:
   ```
   curl -H "Authorization: Bearer $CRON_SECRET" https://<your-app>.vercel.app/api/sync
   ```
   A good result looks like `{"status":"ok","profile_days":~590,"posts":~360,"comments":~590}`.
5. Open the app. Any username works; the password is `DASHBOARD_PASSWORD`.

## Notes

- **Sprout reports the latest day a day late.** The app skips any day until Instagram and TikTok have both filled in. Re-syncs never overwrite a good day with an empty one.
- **Don't add Sprout sentiment fields** (`post_sentiment_score`, `post_comments_positive`/`negative`/`neutral`). The current Sprout plan refuses them, and the whole Windsor call fails.
- **Comment themes are keyword rules** (`lib/themes.ts`). Treat them as a pointer to read the comment, not a verdict.
- **Instagram hides commenters' usernames.** TikTok gives the commenter's username but no comment time.
- **Commands:**
  - `npm test` runs the metric, theme and alert tests against a 120-day fixture of real channel totals.
  - `npm run typecheck` checks types.
