import type { MediaItem } from "@/lib/types";

const JIKAN_ENDPOINT = "https://api.jikan.moe/v4/anime";
const ANILIST_ENDPOINT = "https://graphql.anilist.co";

type JikanAnime = {
  mal_id: number;
  url?: string;
  title?: string;
  title_english?: string | null;
  title_japanese?: string | null;
  images?: {
    webp?: { large_image_url?: string | null; image_url?: string | null };
    jpg?: { large_image_url?: string | null; image_url?: string | null };
  };
  aired?: { from?: string | null };
  studios?: Array<{ name?: string | null }>;
  producers?: Array<{ name?: string | null }>;
};

type JikanResponse = {
  data?: JikanAnime[];
  message?: string;
};

const mediaQuery = `
  query SearchAnime($search: String!) {
    Page(page: 1, perPage: 10) {
      media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        id
        title { native romaji english }
        coverImage { extraLarge large }
        startDate { year month day }
        studios(isMain: true) { nodes { name } }
      }
    }
  }
`;

type AniListMedia = {
  id: number;
  title: {
    native?: string | null;
    romaji?: string | null;
    english?: string | null;
  };
  coverImage?: {
    extraLarge?: string | null;
    large?: string | null;
  } | null;
  startDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
  } | null;
  studios?: { nodes?: Array<{ name?: string | null }> } | null;
};

type AniListResponse = {
  data?: { Page?: { media?: AniListMedia[] } };
  errors?: Array<{ message?: string }>;
};

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query || query.length < 2) return Response.json({ data: [] });

  try {
    return Response.json({ data: await searchJikan(query) });
  } catch (jikanError) {
    console.warn(
      "Jikan search failed; using AniList fallback:",
      jikanError instanceof Error ? jikanError.message : "Unknown error",
    );

    try {
      return Response.json({ data: await searchAniList(query) });
    } catch (fallbackError) {
      const message = fallbackError instanceof Error ? fallbackError.message : "Anime search failed";
      return Response.json({ error: message }, { status: 502 });
    }
  }
}

async function searchJikan(query: string): Promise<MediaItem[]> {
  const params = new URLSearchParams({ q: query, limit: "10", sfw: "true" });
  const response = await fetch(`${JIKAN_ENDPOINT}?${params.toString()}`, {
    headers: { accept: "application/json" },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(10_000),
  });
  const payload = (await response.json().catch(() => ({}))) as JikanResponse;
  if (!response.ok) throw new Error(payload.message || `Jikan returned ${response.status}`);

  const now = new Date().toISOString();
  const preferJapanese = containsJapanese(query);
  return (payload.data ?? []).map((media) => ({
    id: `jikan-${media.mal_id}`,
    type: "video",
    subtype: "anime",
    title: chooseJikanTitle(media, preferJapanese),
    creator:
      media.studios?.find((studio) => studio.name)?.name ||
      media.producers?.find((producer) => producer.name)?.name ||
      "Unknown studio",
    status: "planned",
    publishedAt: normalizeIsoDate(media.aired?.from),
    updatedAt: now,
    coverUrl:
      media.images?.webp?.large_image_url ||
      media.images?.jpg?.large_image_url ||
      media.images?.webp?.image_url ||
      media.images?.jpg?.image_url ||
      undefined,
    sourceUrl: media.url || `https://myanimelist.net/anime/${media.mal_id}`,
    sourceName: "Jikan / MyAnimeList",
    coverTone: ["#27374a", "#a8bdc8"],
  }));
}

async function searchAniList(query: string): Promise<MediaItem[]> {
  const response = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ query: mediaQuery, variables: { search: query } }),
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`AniList returned ${response.status}`);

  const payload = (await response.json()) as AniListResponse;
  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message || "AniList search failed");
  }

  const now = new Date().toISOString();
  return (payload.data?.Page?.media ?? []).map((media) => ({
    id: `anilist-${media.id}`,
    type: "video",
    subtype: "anime",
    title: media.title.native || media.title.english || media.title.romaji || "Untitled anime",
    creator: media.studios?.nodes?.find((studio) => studio.name)?.name || "Unknown studio",
    status: "planned",
    publishedAt: normalizeAniListDate(media.startDate),
    updatedAt: now,
    coverUrl: media.coverImage?.extraLarge || media.coverImage?.large || undefined,
    sourceUrl: `https://anilist.co/anime/${media.id}`,
    sourceName: "AniList fallback",
    coverTone: ["#27374a", "#a8bdc8"],
  }));
}

function chooseJikanTitle(media: JikanAnime, preferJapanese: boolean) {
  if (preferJapanese) return media.title_japanese || media.title || media.title_english || "Untitled anime";
  return media.title_english || media.title || media.title_japanese || "Untitled anime";
}

function normalizeIsoDate(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalizeAniListDate(date?: AniListMedia["startDate"]) {
  if (!date?.year) return undefined;
  const month = String(date.month || 1).padStart(2, "0");
  const day = String(date.day || 1).padStart(2, "0");
  return new Date(`${date.year}-${month}-${day}T00:00:00.000Z`).toISOString();
}

function containsJapanese(value: string) {
  return /[\u3040-\u30ff\u3400-\u9fff]/u.test(value);
}
