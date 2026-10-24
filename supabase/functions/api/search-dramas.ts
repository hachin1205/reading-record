import process from "node:process";
import type { MediaItem } from "./types.ts";

// Japanese and Korean TV drama search.
//  - TVmaze (free, no key): good coverage of J-dramas with network and poster, but mostly romanised/English titles.
//  - TMDB (optional, free key in TMDB_API_KEY): also matches Japanese titles like 「ロングバケーション」 and returns Japanese names.
// Both are asked when TMDB is configured; results are merged and limited to Japanese shows.

const tones: Array<[string, string]> = [
  ["#3b4a5c", "#c9b8a0"],
  ["#5a3a3f", "#d9b3a8"],
  ["#2f4a43", "#a8c4b4"],
  ["#4a3f5c", "#c2b3d6"],
];

type TvMazeShow = {
  id: number;
  name: string;
  language?: string | null;
  premiered?: string | null;
  url?: string;
  network?: { name?: string; country?: { code?: string } | null } | null;
  webChannel?: { name?: string; country?: { code?: string } | null } | null;
  image?: { medium?: string; original?: string } | null;
};

type TmdbShow = {
  id: number;
  name?: string;
  original_name?: string;
  original_language?: string;
  origin_country?: string[];
  first_air_date?: string;
  poster_path?: string | null;
};

/** "JP" for Japanese dramas, "KR" for Korean ones, otherwise null. */
function dramaCountry(show: TvMazeShow): "JP" | "KR" | null {
  const country = show.network?.country?.code ?? show.webChannel?.country?.code;
  if (show.language === "Japanese" || country === "JP") return "JP";
  if (show.language === "Korean" || country === "KR") return "KR";
  return null;
}

/** The show's name in its own language (TVmaze keeps it as an "aka"): 「サイレント」 rather than "Silent". */
async function originalTitle(show: TvMazeShow, country: "JP" | "KR") {
  try {
    const response = await fetch(`https://api.tvmaze.com/shows/${show.id}/akas`, { headers: { accept: "application/json" } });
    if (!response.ok) return show.name;
    const akas = (await response.json()) as Array<{ name: string; country?: { code?: string } | null }>;
    return akas.find((aka) => aka.country?.code === country)?.name ?? show.name;
  } catch {
    return show.name;
  }
}

async function searchTvMaze(query: string): Promise<MediaItem[]> {
  const response = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) return [];
  const rows = (await response.json()) as Array<{ show: TvMazeShow }>;
  const shows = rows
    .map((row) => ({ show: row.show, country: dramaCountry(row.show) }))
    .filter((row): row is { show: TvMazeShow; country: "JP" | "KR" } => row.country !== null)
    .slice(0, 10);
  const titles = await Promise.all(shows.map(({ show, country }) => originalTitle(show, country)));
  return shows.map(({ show, country }, index) => ({
      id: `tvmaze-${show.id}`,
      type: "video",
      subtype: country === "KR" ? "k_drama" : "j_drama",
      title: titles[index],
      creator: show.network?.name ?? show.webChannel?.name ?? "Unknown",
      status: "planned",
      publishedAt: show.premiered ?? undefined,
      updatedAt: new Date().toISOString(),
      coverUrl: show.image?.original ?? show.image?.medium ?? undefined,
      coverTone: tones[index % tones.length],
      sourceName: titles[index] !== show.name ? `TVmaze · ${show.name}` : "TVmaze",
      sourceUrl: show.url,
    }));
}

async function searchTmdb(query: string, key: string): Promise<MediaItem[]> {
  // Accept either a v3 API key or a v4 read-access token.
  const bearer = key.length > 40;
  const base = "https://api.themoviedb.org/3";
  const auth = bearer ? "" : `&api_key=${encodeURIComponent(key)}`;
  const headers: Record<string, string> = { accept: "application/json" };
  if (bearer) headers.authorization = `Bearer ${key}`;

  const response = await fetch(
    `${base}/search/tv?query=${encodeURIComponent(query)}&language=ja-JP&include_adult=false${auth}`,
    { headers },
  );
  if (!response.ok) return [];
  const payload = (await response.json()) as { results?: TmdbShow[] };
  const shows = (payload.results ?? [])
    .filter(
      (show) =>
        show.original_language === "ja" ||
        show.original_language === "ko" ||
        show.origin_country?.includes("JP") ||
        show.origin_country?.includes("KR"),
    )
    .slice(0, 8);

  // One small detail call per show for the TV network (the "creator" on the shelf).
  const networks = await Promise.all(
    shows.map(async (show) => {
      try {
        const detail = await fetch(`${base}/tv/${show.id}?language=ja-JP${auth}`, { headers });
        if (!detail.ok) return null;
        const body = (await detail.json()) as { networks?: Array<{ name?: string }> };
        return body.networks?.[0]?.name ?? null;
      } catch {
        return null;
      }
    }),
  );

  return shows.map((show, index) => ({
    id: `tmdb-tv-${show.id}`,
    type: "video",
    subtype: show.original_language === "ko" || show.origin_country?.includes("KR") ? "k_drama" : "j_drama",
    // Japanese dramas: Japanese title. Korean dramas: the original Korean title.
    title: (show.original_language === "ko" ? show.original_name : show.name || show.original_name) || "Untitled",
    creator: networks[index] ?? "Unknown",
    status: "planned",
    publishedAt: show.first_air_date || undefined,
    updatedAt: new Date().toISOString(),
    coverUrl: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : undefined,
    coverTone: tones[index % tones.length],
    sourceName: "TMDB",
    sourceUrl: `https://www.themoviedb.org/tv/${show.id}`,
  }));
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return Response.json({ data: [] });

  const tmdbKey = process.env.TMDB_API_KEY?.trim();
  try {
    const [tmdb, tvmaze] = await Promise.all([
      tmdbKey ? searchTmdb(query, tmdbKey).catch(() => []) : Promise.resolve([] as MediaItem[]),
      searchTvMaze(query).catch(() => []),
    ]);
    // TMDB first (Japanese titles), then TVmaze; drop TVmaze rows that look like the same show.
    const seen = new Set(tmdb.map((item) => `${item.publishedAt?.slice(0, 4)}|${item.creator}`));
    const merged = [
      ...tmdb,
      ...tvmaze.filter((item) => !seen.has(`${item.publishedAt?.slice(0, 4)}|${item.creator}`)),
    ];
    return Response.json({ data: merged.slice(0, 12) });
  } catch {
    return Response.json({ error: "Drama search is unavailable right now" }, { status: 502 });
  }
}
