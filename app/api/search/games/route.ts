import type { GamePlatformFamily, MediaItem } from "@/lib/types";

const VNDB_ENDPOINT = "https://api.vndb.org/kana/vn";

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

  try {
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
        results: 10,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`VNDB returned ${response.status}`);

    const payload = (await response.json()) as VndbResponse;
    const now = new Date().toISOString();
    const data: MediaItem[] = (payload.results ?? []).map((item) => ({
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
      platformFamily: platformFamily(item.platforms),
    }));

    return Response.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "VNDB search failed";
    return Response.json({ error: message }, { status: 502 });
  }
}

function normalizeDate(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function platformFamily(platforms: string[] = []): GamePlatformFamily {
  if (platforms.some((platform) => platform === "swi" || platform.startsWith("n"))) {
    return "nintendo";
  }
  if (platforms.some((platform) => platform.startsWith("ps"))) return "playstation";
  if (platforms.some((platform) => platform.startsWith("xb"))) return "xbox";
  return "pc";
}
