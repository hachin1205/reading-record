import type { MediaItem } from "@/lib/types";

const NDL_ENDPOINT = "https://ndlsearch.ndl.go.jp/api/opensearch";
const OPEN_BD_ENDPOINT = "https://api.openbd.jp/v1/get";
const RAKUTEN_BOOKS_ENDPOINT = "https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404";
const GOOGLE_BOOKS_ENDPOINT = "https://www.googleapis.com/books/v1/volumes";
const OPEN_LIBRARY_ENDPOINT = "https://openlibrary.org/search.json";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query || query.length < 2) return Response.json({ data: [] });

  try {
    const data = containsJapanese(query)
      ? await searchJapaneseBooks(query)
      : await searchEnglishBooks(query);
    return Response.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Book search failed";
    return Response.json({ error: message }, { status: 502 });
  }
}

async function searchJapaneseBooks(query: string): Promise<MediaItem[]> {
  const applicationId = process.env.RAKUTEN_APPLICATION_ID?.trim();
  const accessKey = process.env.RAKUTEN_ACCESS_KEY?.trim();
  if (applicationId && accessKey) {
    try {
      const results = await searchRakutenBooks(query, applicationId, accessKey);
      if (results.length > 0) return results;
    } catch (error) {
      console.warn(
        "Rakuten Books search failed; using NDL fallback:",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }
  return searchNdl(query);
}

type RakutenBook = {
  title?: string;
  author?: string;
  publisherName?: string;
  isbn?: string;
  salesDate?: string;
  itemUrl?: string;
  largeImageUrl?: string;
  mediumImageUrl?: string;
  smallImageUrl?: string;
};

type RakutenBooksPayload = {
  Items?: RakutenBook[];
  errors?: {
    errorCode?: number;
    errorMessage?: string;
  };
};

async function searchRakutenBooks(
  query: string,
  applicationId: string,
  accessKey: string,
): Promise<MediaItem[]> {
  const normalizedIsbn = query.replace(/[^0-9Xx]/g, "");
  const baseParams = {
    applicationId,
    formatVersion: "2",
    hits: "12",
    outOfStockFlag: "1",
  };
  let payload: RakutenBooksPayload;
  if (normalizedIsbn.length === 10 || normalizedIsbn.length === 13) {
    payload = await fetchRakutenBooks(
      new URLSearchParams({ ...baseParams, isbn: normalizedIsbn }),
      accessKey,
    );
  } else {
    payload = await fetchRakutenBooks(
      new URLSearchParams({ ...baseParams, title: query }),
      accessKey,
    );
    if (!payload.Items?.length) {
      payload = await fetchRakutenBooks(
        new URLSearchParams({ ...baseParams, author: query }),
        accessKey,
      );
    }
  }

  const now = new Date().toISOString();
  const seen = new Set<string>();
  return (payload.Items ?? [])
    .filter((book) => book.title)
    .filter((book) => {
      const key = book.isbn || book.itemUrl || `${book.title}-${book.author}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8)
    .map((book, index) => ({
      id: `rakuten-${stableId(book.isbn || book.itemUrl || `${book.title}-${index}`)}`,
      type: "book",
      title: book.title!,
      creator: normalizeCreator(book.author),
      status: "planned",
      publishedAt: normalizeJapaneseDate(book.salesDate),
      updatedAt: now,
      coverUrl: book.largeImageUrl || book.mediumImageUrl || book.smallImageUrl,
      isbn: book.isbn,
      publisher: book.publisherName,
      sourceUrl: book.itemUrl,
      sourceName: "Rakuten Books",
      coverTone: ["#8b3f35", "#d9c9ad"],
    }));
}

async function fetchRakutenBooks(params: URLSearchParams, accessKey: string) {
  const response = await fetch(`${RAKUTEN_BOOKS_ENDPOINT}?${params.toString()}`, {
    headers: { accessKey },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(10_000),
  });
  const payload = (await response.json().catch(() => ({}))) as RakutenBooksPayload;
  if (!response.ok) {
    throw new Error(payload.errors?.errorMessage || `Rakuten Books returned ${response.status}`);
  }
  return payload;
}

async function searchNdl(query: string): Promise<MediaItem[]> {
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
    return data;
}

async function searchEnglishBooks(query: string): Promise<MediaItem[]> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY?.trim();
  if (apiKey) {
    try {
      return await searchGoogleBooks(query, apiKey);
    } catch (error) {
      console.warn(
        "Google Books search failed; using Open Library fallback:",
        error instanceof Error ? error.message : "Unknown error",
      );
      // Open Library keeps English search usable if Google Books is unavailable.
    }
  }
  return searchOpenLibrary(query);
}

type GoogleVolume = {
  id: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    pageCount?: number;
    industryIdentifiers?: Array<{ identifier?: string }>;
    imageLinks?: {
      smallThumbnail?: string;
      thumbnail?: string;
      small?: string;
      medium?: string;
      large?: string;
      extraLarge?: string;
    };
    infoLink?: string;
  };
};

async function searchGoogleBooks(query: string, apiKey: string): Promise<MediaItem[]> {
  const normalizedIsbn = query.replace(/[^0-9Xx]/g, "");
  const searchTerm = normalizedIsbn.length === 10 || normalizedIsbn.length === 13
    ? `isbn:${normalizedIsbn}`
    : query;
  const params = new URLSearchParams({
    q: searchTerm,
    printType: "books",
    langRestrict: "en",
    orderBy: "relevance",
    maxResults: "12",
    projection: "lite",
    key: apiKey,
  });
  const response = await fetch(`${GOOGLE_BOOKS_ENDPOINT}?${params.toString()}`, {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Google Books returned ${response.status}`);

  const payload = (await response.json()) as { items?: GoogleVolume[] };
  const now = new Date().toISOString();
  return (payload.items ?? [])
    .filter((volume) => volume.volumeInfo?.title)
    .slice(0, 8)
    .map((volume) => {
      const info = volume.volumeInfo!;
      const isbn = preferredIsbn(info.industryIdentifiers?.map((entry) => entry.identifier ?? "") ?? []);
      const coverUrl = info.imageLinks?.extraLarge
        || info.imageLinks?.large
        || info.imageLinks?.medium
        || info.imageLinks?.small
        || info.imageLinks?.thumbnail
        || info.imageLinks?.smallThumbnail;
      return {
        id: `google-${volume.id}`,
        type: "book" as const,
        title: info.title!,
        creator: info.authors?.join(", ") || "Unknown creator",
        status: "planned" as const,
        publishedAt: normalizeDate(info.publishedDate),
        updatedAt: now,
        pageCount: info.pageCount,
        coverUrl: coverUrl?.replace(/^http:/, "https:"),
        isbn,
        publisher: info.publisher,
        sourceUrl: info.infoLink,
        sourceName: "Google Books",
        coverTone: ["#31536f", "#d6c7a8"] as [string, string],
      };
    });
}

type OpenLibraryRecord = {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  isbn?: string[];
  cover_i?: number;
  publisher?: string[];
};

async function searchOpenLibrary(query: string): Promise<MediaItem[]> {
  const normalizedIsbn = query.replace(/[^0-9Xx]/g, "");
  const params = new URLSearchParams({
    limit: "12",
    lang: "en",
    fields: "key,title,author_name,first_publish_year,isbn,cover_i,publisher",
  });
  if (normalizedIsbn.length === 10 || normalizedIsbn.length === 13) {
    params.set("isbn", normalizedIsbn);
  } else {
    params.set("title", query);
  }
  const response = await fetch(`${OPEN_LIBRARY_ENDPOINT}?${params.toString()}`, {
    headers: { "user-agent": "ReadingRecord/0.1 (personal media library)" },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Open Library returned ${response.status}`);

  const payload = (await response.json()) as { docs?: OpenLibraryRecord[] };
  const now = new Date().toISOString();
  return (payload.docs ?? [])
    .filter((record) => record.title)
    .slice(0, 8)
    .map((record, index) => ({
      id: `openlibrary-${stableId(record.key || `${record.title}-${index}`)}`,
      type: "book",
      title: record.title!,
      creator: record.author_name?.join(", ") || "Unknown creator",
      status: "planned",
      publishedAt: record.first_publish_year ? normalizeDate(String(record.first_publish_year)) : undefined,
      updatedAt: now,
      coverUrl: record.cover_i ? `https://covers.openlibrary.org/b/id/${record.cover_i}-L.jpg` : undefined,
      isbn: preferredIsbn(record.isbn ?? []),
      publisher: record.publisher?.[0],
      sourceUrl: record.key ? `https://openlibrary.org${record.key}` : undefined,
      sourceName: "Open Library",
      coverTone: ["#31536f", "#d6c7a8"],
    }));
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

function containsJapanese(value: string) {
  return /[\u3040-\u30ff\u3400-\u9fff]/u.test(value);
}

function normalizeCreator(value?: string) {
  if (!value?.trim()) return "Unknown creator";
  const trimmed = value.trim();
  return containsJapanese(trimmed) ? trimmed.replace(/\s+/g, "") : trimmed;
}

function normalizeJapaneseDate(value?: string) {
  if (!value) return undefined;
  const match = value.match(/(\d{4})年(?:\s*(\d{1,2})月)?(?:\s*(\d{1,2})日)?/);
  if (!match) return normalizeDate(value);
  const month = String(match[2] || 1).padStart(2, "0");
  const day = String(match[3] || 1).padStart(2, "0");
  return new Date(`${match[1]}-${month}-${day}T00:00:00.000Z`).toISOString();
}

function preferredIsbn(values: string[]) {
  const normalized = values.map((value) => value.replace(/[^0-9Xx]/g, ""));
  return normalized.find((value) => value.length === 13)
    ?? normalized.find((value) => value.length === 10);
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
