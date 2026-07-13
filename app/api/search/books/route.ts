import type { MediaItem } from "@/lib/types";

const NDL_ENDPOINT = "https://ndlsearch.ndl.go.jp/api/opensearch";
const OPEN_BD_ENDPOINT = "https://api.openbd.jp/v1/get";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query || query.length < 2) return Response.json({ data: [] });

  try {
    const params = new URLSearchParams({ cnt: "100", dpid: "iss-ndl-opac" });
    const normalizedIsbn = query.replace(/[^0-9Xx]/g, "");
    if (normalizedIsbn.length === 10 || normalizedIsbn.length === 13) {
      params.set("isbn", normalizedIsbn);
    } else {
      params.set("title", query);
    }

    const response = await fetch(`${NDL_ENDPOINT}?${params.toString()}`, {
      headers: { "user-agent": "ReadingRecord/0.1 (NDL Search integration)" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`NDL Search returned ${response.status}`);

    const records = rankRecords(parseNdlRss(await response.text()), query).slice(0, 8);
    const covers = await findOpenBdCovers(records.map((record) => record.isbn).filter(Boolean) as string[]);
    const now = new Date().toISOString();
    const data: MediaItem[] = records.map((record, index) => ({
      id: `ndl-${stableId(record.sourceUrl || `${record.title}-${record.isbn ?? index}`)}`,
      type: "book",
      title: record.title,
      creator: record.creator || "Unknown creator",
      status: "planned",
      publishedAt: normalizeDate(record.date),
      updatedAt: now,
      coverUrl: record.isbn ? covers.get(record.isbn) : undefined,
      isbn: record.isbn,
      publisher: record.publisher,
      sourceUrl: record.sourceUrl,
      sourceName: "NDL Search",
      coverTone: ["#7b5f42", "#d8c8aa"],
    }));

    return Response.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Book search failed";
    return Response.json({ error: message }, { status: 502 });
  }
}

type NdlRecord = {
  title: string;
  creator?: string;
  publisher?: string;
  date?: string;
  isbn?: string;
  sourceUrl?: string;
};

function parseNdlRss(xml: string): NdlRecord[] {
  return readElements(xml, "item")
    .map((item) => {
      const isbn = readIdentifiers(item, "ISBN")
        .map((value) => value.replace(/[^0-9Xx]/g, ""))
        .find((value) => value.length === 10 || value.length === 13);
      return {
        title: readValue(item, "title"),
        creator: readValue(item, "dc:creator") || undefined,
        publisher: readValue(item, "dc:publisher") || undefined,
        date: readValue(item, "dc:date") || undefined,
        isbn,
        sourceUrl: readValue(item, "link") || undefined,
      };
    })
    .filter((record) => record.title);
}

function rankRecords(records: NdlRecord[], query: string) {
  const normalizedQuery = normalizeSearchText(query);
  const seen = new Set<string>();
  return records
    .filter((record) => {
      const key = record.sourceUrl || `${record.title}-${record.creator}-${record.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => scoreRecord(right, normalizedQuery) - scoreRecord(left, normalizedQuery));
}

function scoreRecord(record: NdlRecord, normalizedQuery: string) {
  const title = normalizeSearchText(record.title);
  let score = title === normalizedQuery ? 100 : title.startsWith(normalizedQuery) ? 60 : title.includes(normalizedQuery) ? 30 : 0;
  if (record.isbn?.length === 13) score += 16;
  else if (record.isbn) score += 12;
  if (record.publisher) score += 4;
  const year = Number(record.date?.match(/\d{4}/)?.[0]);
  if (title === normalizedQuery && Number.isFinite(year)) {
    score += Math.max(0, Math.min(20, (year - 1950) / 4));
  }
  return score;
}

function normalizeSearchText(value: string) {
  return value.normalize("NFKC").replace(/[\s　:：・\-―—]/g, "").toLowerCase();
}

function readElements(xml: string, tag: string) {
  const escaped = tag.replace(":", "\\:");
  return Array.from(xml.matchAll(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "gi")), (match) => match[1]);
}

function readValues(xml: string, tag: string) {
  return readElements(xml, tag).map((value) => decodeXml(value.replace(/<[^>]+>/g, "").trim()));
}

function readValue(xml: string, tag: string) {
  return readValues(xml, tag)[0] ?? "";
}

function readIdentifiers(xml: string, type: string) {
  return Array.from(
    xml.matchAll(/<dc:identifier\b([^>]*)>([\s\S]*?)<\/dc:identifier>/gi),
    (match) => ({ attributes: match[1], value: decodeXml(match[2].replace(/<[^>]+>/g, "").trim()) }),
  )
    .filter((identifier) => identifier.attributes.toUpperCase().includes(type.toUpperCase()))
    .map((identifier) => identifier.value);
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

async function findOpenBdCovers(isbns: string[]) {
  const unique = [...new Set(isbns)];
  const covers = new Map<string, string>();
  if (unique.length === 0) return covers;

  try {
    const response = await fetch(`${OPEN_BD_ENDPOINT}?isbn=${unique.join(",")}`, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return covers;
    const books = (await response.json()) as Array<{
      summary?: { isbn?: string; cover?: string };
    } | null>;
    for (const [index, book] of books.entries()) {
      if (book?.summary?.isbn && book.summary.cover) {
        covers.set(book.summary.isbn, book.summary.cover);
        if (unique[index]) covers.set(unique[index], book.summary.cover);
      }
    }
  } catch {
    // Cover enrichment is optional; NDL metadata remains usable without it.
  }

  return covers;
}

function normalizeDate(value?: string) {
  if (!value) return undefined;
  const match = value.match(/\d{4}(?:-\d{2})?(?:-\d{2})?/);
  if (!match) return undefined;
  const [year, month = "01", day = "01"] = match[0].split("-");
  return new Date(`${year}-${month}-${day}T00:00:00.000Z`).toISOString();
}

function stableId(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
