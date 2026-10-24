// The parts of the site that need secret API keys: catalog searches and Claude/Gemini in the
// note box. The static site calls them at https://<project>.supabase.co/functions/v1/api/...
// Deploy:  supabase functions deploy api --no-verify-jwt
// Secrets: supabase secrets set GEMINI_API_KEY=... TMDB_API_KEY=... (see .env.example)
import { apiError, requireAdmin } from "./auth.ts";
import * as claude from "./claude.ts";
import * as anime from "./search-anime.ts";
import * as books from "./search-books.ts";
import * as dramas from "./search-dramas.ts";
import * as films from "./search-films.ts";
import * as games from "./search-games.ts";

const searches: Record<string, (request: Request) => Promise<Response>> = {
  anime: anime.GET,
  books: books.GET,
  dramas: dramas.GET,
  films: films.GET,
  games: games.GET,
};

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

async function route(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname.replace(/^.*?\/api(?=\/|$)/, "");
  if (path === "/claude") {
    return request.method === "POST" ? claude.POST(request) : claude.GET();
  }
  const search = path.match(/^\/search\/([a-z]+)$/)?.[1];
  if (search && searches[search] && request.method === "GET") {
    await requireAdmin(request);
    return searches[search](request);
  }
  return Response.json({ error: "Not found" }, { status: 404 });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  let response: Response;
  try {
    response = await route(request);
  } catch (error) {
    response = apiError(error);
  }
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(cors)) headers.set(key, value);
  return new Response(response.body, { status: response.status, headers });
});
