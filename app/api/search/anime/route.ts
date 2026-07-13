import type { MediaItem } from "@/lib/types";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

const mediaQuery = `
  query SearchAnime($search: String!) {
    Page(page: 1, perPage: 10) {
      media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        id
        format
        title {
          native
          romaji
          english
        }
        coverImage {
          extraLarge
          large
        }
        startDate {
          year
          month
          day
        }
        studios(isMain: true) {
          nodes {
            name
          }
        }
      }
    }
  }
`;

type AniListMedia = {
  id: number;
  format?: string | null;
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
  studios?: {
    nodes?: Array<{ name?: string | null }>;
  } | null;
};

type AniListResponse = {
  data?: { Page?: { media?: AniListMedia[] } };
  errors?: Array<{ message?: string }>;
};

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query || query.length < 2) return Response.json({ data: [] });

  try {
    const response = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
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
    const data: MediaItem[] = (payload.data?.Page?.media ?? []).map((media) => ({
      id: `anilist-${media.id}`,
      type: "video",
      subtype: "anime",
      title: media.title.native || media.title.romaji || media.title.english || "Untitled anime",
      creator: media.studios?.nodes?.find((studio) => studio.name)?.name || "Unknown studio",
      status: "planned",
      publishedAt: normalizeDate(media.startDate),
      updatedAt: now,
      coverUrl: media.coverImage?.extraLarge || media.coverImage?.large || undefined,
      sourceUrl: `https://anilist.co/anime/${media.id}`,
      sourceName: "AniList",
      coverTone: ["#27374a", "#a8bdc8"],
    }));

    return Response.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Anime search failed";
    return Response.json({ error: message }, { status: 502 });
  }
}

function normalizeDate(date?: AniListMedia["startDate"]) {
  if (!date?.year) return undefined;
  const month = String(date.month || 1).padStart(2, "0");
  const day = String(date.day || 1).padStart(2, "0");
  return new Date(`${date.year}-${month}-${day}T00:00:00.000Z`).toISOString();
}
