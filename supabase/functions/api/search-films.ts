import type { MediaItem } from "./types.ts";

// Film & TV search for posters, using Apple's public iTunes Search API (no key needed).
const ITUNES_ENDPOINT = "https://itunes.apple.com/search";

type ITunesResult = {
  trackId?: number;
  collectionId?: number;
  trackName?: string;
  collectionName?: string;
  artistName?: string;
  artworkUrl100?: string;
  releaseDate?: string;
  kind?: string;
  trackViewUrl?: string;
  collectionViewUrl?: string;
};

const tones: Array<[string, string]> = [
  ["#243f5a", "#91b7b3"],
  ["#4d3556", "#c6a1b8"],
  ["#28303c", "#a9a18f"],
  ["#7f302c", "#d8a46f"],
];

function largerArtwork(url?: string) {
  // iTunes serves any size by rewriting the "100x100bb" part of the URL.
  return url ? url.replace(/\/\d+x\d+bb\./, "/600x900bb.") : undefined;
}

async function fetchITunes(params: string) {
  const response = await fetch(`${ITUNES_ENDPOINT}?${params}`, { headers: { accept: "application/json" } });
  if (!response.ok) return [] as ITunesResult[];
  const payload = (await response.json()) as { results?: ITunesResult[] };
  return payload.results ?? [];
}

// iTunes' movie-only filter currently returns nothing, so search everything and keep the films.
async function searchMovies(term: string) {
  const results = await fetchITunes(`term=${encodeURIComponent(term)}&media=all&limit=50`);
  return results.filter((result) => result.kind === "feature-movie").slice(0, 8);
}

async function searchShows(term: string) {
  return fetchITunes(`term=${encodeURIComponent(term)}&media=tvShow&entity=tvSeason&limit=8`);
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return Response.json({ data: [] });

  try {
    const [movies, shows] = await Promise.all([
      searchMovies(query),
      searchShows(query),
    ]);

    const seen = new Set<string>();
    const data: MediaItem[] = [];
    [...movies.map((r) => ({ r, tv: false })), ...shows.map((r) => ({ r, tv: true }))].forEach(({ r, tv }, index) => {
      const title = (tv ? r.collectionName : r.trackName) ?? r.trackName ?? r.collectionName;
      const coverUrl = largerArtwork(r.artworkUrl100);
      if (!title || !coverUrl || seen.has(coverUrl)) return;
      seen.add(coverUrl);
      data.push({
        id: `itunes-${r.trackId ?? r.collectionId ?? index}`,
        type: "video",
        subtype: tv ? "us_tv" : "movie",
        title,
        creator: r.artistName ?? "Unknown",
        status: "planned",
        publishedAt: r.releaseDate,
        updatedAt: new Date().toISOString(),
        coverUrl,
        coverTone: tones[index % tones.length],
        sourceName: "iTunes",
        sourceUrl: tv ? r.collectionViewUrl : r.trackViewUrl,
      });
    });

    return Response.json({ data: data.slice(0, 12) });
  } catch {
    return Response.json({ error: "Film search is unavailable right now" }, { status: 502 });
  }
}
