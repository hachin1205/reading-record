import type { GamePlatformFamily, MediaItem } from "@/lib/types";

const STEAMGRIDDB_ENDPOINT = "https://www.steamgriddb.com/api/v2";
const VNDB_ENDPOINT = "https://api.vndb.org/kana/vn";
const RESULT_LIMIT = 10;

type SteamGridDbGame = {
  id: number;
  name?: string;
  types?: string[];
};

type SteamGridDbGrid = {
  url?: string;
};

type SteamGridDbResponse<T> = {
  data?: T;
};

type VndbVisualNovel = {
  id: string;
  title?: string;
  alttitle?: string | null;
  released?: string | null;
  image?: { url?: string | null } | null;
  developers?: Array<{ name?: string | null }>;
  platforms?: string[];
};

type VndbResponse = {
  results?: VndbVisualNovel[];
};

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query || query.length < 2) return Response.json({ data: [] });

  const searches = await Promise.allSettled([searchSteamGridDb(query), searchVndb(query)]);
  const steamGridDbResults = searches[0].status === "fulfilled" ? searches[0].value : [];
  const vndbResults = searches[1].status === "fulfilled" ? searches[1].value : [];

  if (searches.every((result) => result.status === "rejected")) {
    const reasons = searches
      .map((result) => result.status === "rejected" ? result.reason : undefined)
      .filter(Boolean)
      .map((reason) => reason instanceof Error ? reason.message : String(reason));
    return Response.json({ error: reasons.join("; ") || "Game search failed" }, { status: 502 });
  }

  const seen = new Set<string>();
  const candidates = [
    ...steamGridDbResults.slice(0, 8),
    ...vndbResults.slice(0, 2),
    ...steamGridDbResults.slice(8),
    ...vndbResults.slice(2),
  ];
  const data = candidates
    .filter((item) => {
      const key = item.title.trim().toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, RESULT_LIMIT);

  return Response.json({ data });
}

async function searchSteamGridDb(query: string): Promise<MediaItem[]> {
  const apiKey = process.env.STEAMGRIDDB_API_KEY?.trim();
  if (!apiKey) return [];

  const response = await fetch(
    `${STEAMGRIDDB_ENDPOINT}/search/autocomplete/${encodeURIComponent(query)}`,
    {
      headers: { accept: "application/json", authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) throw new Error(`SteamGridDB returned ${response.status}`);

  const payload = (await response.json()) as SteamGridDbResponse<SteamGridDbGame[]>;
  const games = Array.isArray(payload.data) ? payload.data.slice(0, RESULT_LIMIT) : [];
  const covers = await Promise.all(games.map((game) => getSteamGridDbCover(game.id, apiKey)));
  const now = new Date().toISOString();

  return games.map((game, index) => ({
    id: `steamgriddb-${game.id}`,
    type: "game",
    title: game.name?.trim() || "Untitled game",
    creator: "Unknown developer",
    status: "planned",
    updatedAt: now,
    coverUrl: covers[index],
    sourceUrl: `https://www.steamgriddb.com/game/${game.id}`,
    sourceName: "SteamGridDB",
    coverTone: ["#29435f", "#9db4c7"],
    platformFamily: steamGridDbPlatformFamily(game.types),
  }));
}

async function getSteamGridDbCover(gameId: number, apiKey: string) {
  try {
    const response = await fetch(
      `${STEAMGRIDDB_ENDPOINT}/grids/game/${gameId}?dimensions=600x900,342x482&types=static`,
      {
        headers: { accept: "application/json", authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!response.ok) return undefined;
    const payload = (await response.json()) as SteamGridDbResponse<SteamGridDbGrid[]>;
    return Array.isArray(payload.data) ? payload.data.find((grid) => grid.url)?.url : undefined;
  } catch {
    return undefined;
  }
}

async function searchVndb(query: string): Promise<MediaItem[]> {
  const response = await fetch(VNDB_ENDPOINT, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "ReadingRecord/0.1 (personal media library)",
    },
    body: JSON.stringify({
      filters: /^v\d+$/i.test(query) ? ["id", "=", query.toLowerCase()] : ["search", "=", query],
      fields: "id,title,alttitle,released,image.url,developers.name,platforms",
      results: RESULT_LIMIT,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`VNDB returned ${response.status}`);

  const payload = (await response.json()) as VndbResponse;
  const now = new Date().toISOString();
  return (payload.results ?? []).map((item) => ({
    id: `vndb-${item.id}`,
    type: "game",
    subtype: "visual_novel",
    title: item.title || item.alttitle || "Untitled visual novel",
    creator: item.developers?.find((developer) => developer.name)?.name || "Unknown developer",
    status: "planned",
    publishedAt: normalizeDate(item.released),
    updatedAt: now,
    coverUrl: item.image?.url || undefined,
    sourceUrl: `https://vndb.org/${item.id}`,
    sourceName: "VNDB",
    coverTone: ["#31506b", "#b8c9d6"],
    platformFamily: vndbPlatformFamily(item.platforms),
  }));
}

function normalizeDate(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function steamGridDbPlatformFamily(types: string[] = []): GamePlatformFamily {
  const normalized = types.map((type) => type.toLocaleLowerCase());
  if (normalized.some((type) => type.includes("switch") || type.includes("eshop") || type.includes("nintendo"))) {
    return "nintendo";
  }
  if (normalized.some((type) => type.includes("psn") || type.includes("playstation"))) {
    return "playstation";
  }
  if (normalized.some((type) => type.includes("xbox"))) return "xbox";
  return "pc";
}

function vndbPlatformFamily(platforms: string[] = []): GamePlatformFamily {
  if (platforms.some((platform) => platform === "swi" || platform.startsWith("n"))) {
    return "nintendo";
  }
  if (platforms.some((platform) => platform.startsWith("ps"))) return "playstation";
  if (platforms.some((platform) => platform.startsWith("xb"))) return "xbox";
  return "pc";
}
