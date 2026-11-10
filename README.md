# trivia.live

**trivia.live** is a free-to-play live trivia web PWA inspired by HQ Trivia: players join scheduled shows in the browser, answer timed multiple-choice questions in elimination format, and compete for prizes. **There are no purchases anywhere**: extra lives are free (one per show, earned by inviting a friend or watching a rewarded ad).

The monorepo splits responsibilities across:

| Path | What it is |
|------|------------|
| `apps/web` | Next.js 15 player app, admin CMS, host console, API routes |
| `apps/show-runner` | Node worker that advances every show's state on a timer |
| `packages/game-engine` | Shared TypeScript rules: state machine, scoring, extra lives, public-state projection, leaderboard |
| `supabase/` | Postgres schema, RLS, seed |

Supabase (Postgres, Auth, Realtime) is the source of truth. LiveKit is optional (live audio host).

## How a show works

1. An admin schedules a show at `/admin`.
2. The runner opens the lobby 5 minutes before start. Everyone who joins before question 1 opens is a **player**; anyone joining later is a **spectator** (watches, can't answer, not counted, not prize-eligible).
3. Each question is open for **10 seconds** (+750 ms network grace), timed on the server. Answers go through `POST /api/shows/:id/answer`, which checks the caller owns the participant (guest token or Supabase session), the window, and records answer time for the speed bonus.
4. **Reveal** (5 s) shows the correct answer, your pick, whether you're still in, and points earned.
5. After the last question, scores are finalized and `/show/:id/leaderboard` ranks players (points, then fastest cumulative answer time). Winners are survivors; fastest cumulative time breaks ties; exact ties split.

**Security model:** the full runtime state (all questions, correct answers, participants) lives in the private `show_runtime` table (RLS, service role only). The public `shows.current_state` (readable and broadcast via Realtime) only carries the current question, and its correct answer only once it's revealed. Players read their own status from `GET /api/shows/:id/me`.

**Free extra lives:** max one per player per show (DB-enforced). Earn it by (a) sharing your invite link: when a *signed-in* friend joins the show as a player through it, or (b) watching a rewarded ad (server-issued, server-timed, single-use session). It's used automatically right after a wrong/missed answer, before the next question, and never on the final question.

## Local development

1. **Install dependencies** (repo root, Node 20+):

   ```bash
   npm install
   ```

2. **Environment**: copy `.env.example` to `.env` at the repo root and fill in your Supabase URL, anon key and service role key. Next.js reads env from `apps/web`, so link it there too:

   ```bash
   cp .env.example .env
   ln -s ../../.env apps/web/.env.local
   ```

   The runner's dev script loads `../../.env` itself.

3. **Database**: link your Supabase project and push all migrations in `supabase/migrations/` (they enable RLS, create `show_runtime`, extra-life tables, and add `shows` to the `supabase_realtime` publication):

   ```bash
   npx supabase link
   npx supabase db push
   npx supabase db seed   # optional: 12 sample questions + a show in 1 hour
   ```

   Check **Database → Publications → supabase_realtime** includes `shows` (the migration adds it if the publication exists).

4. **Auth** (needed for /admin and /host):
   - Supabase → **Authentication → URL Configuration**: set Site URL (e.g. `http://localhost:3000`) and add `http://localhost:3000/auth/callback` (and your production `https://<domain>/auth/callback`) to **Redirect URLs**.
   - **Discord** (preferred): create an app at <https://discord.com/developers/applications>, under OAuth2 add the redirect `https://<project-ref>.supabase.co/auth/v1/callback`, then paste the client ID/secret into Supabase → **Authentication → Providers → Discord**.
   - **Email magic link** works out of the box (Supabase's built-in mailer is rate-limited; set up custom SMTP for production).
   - Sign in at `/login`, copy the **User ID** it shows, and put it in `ADMIN_USER_IDS` (and/or `HOST_USER_IDS`). Restart the dev server.

5. **Run** (two terminals):

   ```bash
   npm run dev          # web on http://localhost:3000
   npm run dev:runner   # show runner, polls every SHOW_RUNNER_POLL_MS (1s)
   ```

6. **Checks**:

   ```bash
   npm test             # game-engine + web unit tests
   npm run typecheck    # engine, runner, web
   npm run build        # Next build + runner bundle
   npm run test:e2e     # Playwright (needs a running app + Supabase + a scheduled show)
   ```

## Environment variables

| Variable | Used by | Notes |
|----------|---------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | web, runner | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | web (server), runner | **Secret.** Never expose to the browser |
| `ADMIN_USER_IDS` | web | Comma-separated Supabase user UUIDs |
| `HOST_USER_IDS` | web | Extra hosts (admins are always hosts) |
| `SHOW_RUNNER_POLL_MS` | runner | Default 1000 |
| `AD_PROVIDER` | web | `mock` (simulated 15s ad; default in dev), `gam` (Google Ad Manager stub), `none` (default in production) |
| `GAM_REWARDED_AD_UNIT_PATH` | web | Required for `gam`, e.g. `/1234567/trivia_rewarded` |
| `GAM_MIN_WATCH_MS` | web | Server-side minimum for `gam` (default 5000) |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` / `LIVEKIT_URL` | web | Optional, for live audio host shows |

### Rewarded ads

`apps/web/src/lib/ads/` holds the provider abstraction:

- `server.ts`: `ServerRewardedAdProvider` (`verify()` decides on the server whether a reward was earned), `mockAdProvider`, `gamAdProvider` (stub) and `getServerAdProvider()`.
- `client.ts`: browser side (`mockClientProvider` simulated countdown; `gamClientProvider` uses GPT's out-of-page `REWARDED` slot and `rewardedSlotGranted`).
- Flow: `POST /api/shows/:id/extra-life/ad/start` → play → `POST /api/shows/:id/extra-life/ad/complete`.

**The GAM provider is a stub**, untested against a live ad unit. GPT web rewarded ads report the reward in the browser only, so the server can only check timing and single use. Get your Ad Manager account and a rewarded web ad unit approved before turning it on, and revisit verification before high-value prizes depend on it.

## Deployment (not deployed yet)

### Web

- **Cloudflare Pages/Workers via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare)** (free tier allows commercial use): add `@opennextjs/cloudflare` + `wrangler` to `apps/web`, create `wrangler.jsonc` with the `nodejs_compat` compatibility flag (API routes use Node `crypto`), and deploy with `opennextjs-cloudflare build && opennextjs-cloudflare deploy`. Set env vars and secrets in the Cloudflare dashboard. Not wired up in this repo yet.
- **Vercel**: set the project root to `apps/web` (`vercel.json` installs and builds from the monorepo root). Vercel's free Hobby plan is for non-commercial use only, so a prize game should be on **Vercel Pro**.

### Show runner (worker)

It's a long-running process (no HTTP port), so it needs an always-on service, not serverless.

- **Northflank free service** (recommended): create a service from this repo with **Dockerfile** build, Dockerfile path `apps/show-runner/Dockerfile`, build context `/` (repo root). Add `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SHOW_RUNNER_POLL_MS` as runtime secrets. No public port needed. Run **one instance only** (two runners would double-advance shows).
- Any other Docker host works the same way: `docker build -f apps/show-runner/Dockerfile -t trivia-runner .` then `docker run --env-file .env trivia-runner`.
- `apps/show-runner/railway.toml` is kept for Railway; the start command `node dist/index.js` now works (the build bundles the runner and game-engine with esbuild).

### Before the first prize show

- Get the [official rules](apps/web/src/app/official-rules/page.tsx) (draft, placeholders marked) reviewed by a lawyer, and fill in the prize, operator entity and contact details.
- Choose a domain (`trivia.live` belongs to someone else) and add its `/auth/callback` to Supabase redirect URLs.

## Documentation

- [Design spec](docs/superpowers/specs/2026-06-17-trivia-live-design.md)
- [Implementation plan](docs/superpowers/plans/2026-06-17-trivia-live.md)
- [Live audio host spec](docs/superpowers/specs/2026-06-19-live-audio-host-design.md)

## Live audio hosting (optional)

Optional LiveKit integration lets a host read questions on mic while players subscribe to audio on the show page. Only shows created with **Live audio host** enabled use LiveKit.

1. Create a [LiveKit Cloud](https://cloud.livekit.io) project and copy the API key, secret, and WebSocket URL into `LIVEKIT_*`.
2. In `/admin`, schedule a show and check **Live audio host (I'll read questions on mic)**.
3. Before the show, open `/host/show/{id}`, click **Go live (enable mic)**, and grant microphone permission.
4. Players on `/show/{id}` tap **Tap to hear the host** (required on mobile for autoplay).
