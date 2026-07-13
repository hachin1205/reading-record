# Reading Record

Next.js reading tracker backed by Supabase. Runtime reads and writes use Supabase's REST API; Drizzle owns SQL migrations.

## Supabase setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local`.
3. From the hosted project's **Connect** dialog, add the project URL, publishable key, secret key, and direct database URL. If your network is IPv4-only, use the session pooler on port `5432` for migrations.
4. Run `npm run db:migrate`.
5. Start the app with `npm run dev`.

The first `GET /api/media` seeds the current sample library when the media table is empty. Set `SEED_SAMPLE_DATA=false` to start empty.

## API

- `GET /api/media`
- `POST /api/media`
- `PATCH /api/media/:id`
- `DELETE /api/media/:id`
- `GET /api/notes?contentId=:id`
- `POST /api/notes`
- `DELETE /api/notes/:id`
- `GET /api/experiences?contentId=:id`
- `POST /api/experiences`
- `DELETE /api/experiences/:id`
- `GET /api/search/books?q=:query` (NDL Search with optional openBD cover enrichment)
- `GET /api/search/anime?q=:query` (AniList anime metadata and cover art)

`SUPABASE_SECRET_KEY` is server-only and must never use a `NEXT_PUBLIC_` prefix. The write routes must be protected with Supabase Auth before public deployment because the secret key bypasses Row Level Security.

Book search metadata is provided by the National Diet Library's NDL Search API. Keep the NDL attribution visible in the UI, avoid concurrent or high-volume requests, and review NDL's application requirements before commercial use.
