# Reading Record

A personal reading / watching / playing record, live at https://kiyoguan.cc.

## How it fits together

- **Site:** a static Next.js export (`next build` → `out/`), hosted on GitHub Pages. The `Site`
  workflow rebuilds and publishes it on every push to `main` and once a day.
- **Data and sign-in:** Supabase. The browser reads and writes the `media`, `notes` and
  `experiences` tables directly with the publishable key. Row Level Security
  (`supabase/migrations/`) lets anyone read and only addresses in `public.site_admins` write,
  so editing works from any computer or phone once you sign in on `/admin`.
- **Secret keys:** catalog searches and Claude/Gemini run in the `api` Supabase Edge Function
  (`supabase/functions/api/`), deployed by the `Supabase function` workflow. Its keys are
  Supabase function secrets (see `.env.example`).
- **Sync:** pages load the live library from Supabase on every visit, so an edit shows
  everywhere at once. Each build also bakes the current library into the HTML.

The browser-side stand-in for the old `/api/*` routes is `lib/client-api.ts`.

## Local development

1. Copy `.env.example` to `.env.local` and fill in the Supabase URL and publishable key.
2. `npm install`, then `npm run dev` (or double-click `start-dev.command`).

Searches and Claude/Gemini call the deployed Edge Function, so they need you signed in.

## One-time setup

1. Supabase → SQL Editor: run `supabase/migrations/20261024000000_static_site_security.sql`,
   then add your sign-in address to `public.site_admins`.
2. Supabase → Authentication → URL Configuration: add `https://kiyoguan.cc/reset-password/`
   to the redirect URLs.
3. GitHub → Settings → Secrets and variables → Actions: add the variables and secrets listed at
   the top of the two workflow files.
4. GitHub → Settings → Pages: Source "GitHub Actions", custom domain `kiyoguan.cc`.

Book search metadata is provided by the National Diet Library's NDL Search API. Keep the NDL attribution visible in the UI, avoid concurrent or high-volume requests, and review NDL's application requirements before commercial use.
