# trivia.live

**trivia.live** is a live trivia web PWA inspired by HQ Trivia: players join scheduled shows in the browser, answer timed multiple-choice questions in elimination format, and earn virtual points. The monorepo splits responsibilities across a Next.js 15 player app (`apps/web`), a Node show-runner worker (`apps/show-runner`) that advances show state on a timer, and a shared TypeScript game engine (`packages/game-engine`). Supabase (Postgres, Auth, Realtime) is the source of truth.

## Local development

1. **Install dependencies** (from repo root):

   ```bash
   npm install
   ```

2. **Configure environment** — copy `.env.example` to `.env` and fill in your Supabase project URL, anon key, and service role key:

   ```bash
   cp .env.example .env
   ```

3. **Apply the database schema** — link your Supabase project and push migrations, or paste `supabase/migrations/20260617000000_initial_schema.sql` into the Supabase SQL editor:

   ```bash
   npx supabase link
   npx supabase db push
   ```

   Optionally seed a test show:

   ```bash
   npx supabase db seed
   ```

4. **Enable Realtime on the `shows` table** — in the [Supabase Dashboard](https://supabase.com/dashboard), open **Database → Publications**, edit the `supabase_realtime` publication, and add the `shows` table. The show-runner broadcasts phase changes via row updates; clients subscribe to stay in sync.

5. **Run the dev servers** (two terminals):

   ```bash
   npm run dev
   npm run dev:runner
   ```

   - Web app: [http://localhost:3000](http://localhost:3000)
   - Show runner polls Supabase and advances due shows every second (`SHOW_RUNNER_POLL_MS`).

## Documentation

- [Design spec](docs/superpowers/specs/2026-06-17-trivia-live-design.md)
- [Implementation plan](docs/superpowers/plans/2026-06-17-trivia-live.md)

## Deployment

- **Web (Vercel):** set the project root directory to `apps/web`. `vercel.json` installs and builds from the monorepo root.
- **Show runner (Railway):** set the service root directory to `apps/show-runner`. `railway.toml` builds `@trivia-live/show-runner` from the repo root and starts with `node dist/index.js`.

Set environment variables from `.env.example` on both platforms. The show runner requires `SUPABASE_SERVICE_ROLE_KEY`.
