import type { MediaItem } from "./sample-data";

/** Title key that ignores case, width, spacing, punctuation and brackets: "ノルウェイの森 （上）" ≈ "ノルウェイの森(上)". */
export function titleKey(title: string) {
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

function isbnKey(isbn?: string | null) {
  const digits = (isbn ?? "").replace(/[^0-9xX]/g, "").toUpperCase();
  return digits.length >= 10 ? digits : "";
}

/** The record already in the library that `candidate` would duplicate, if any. */
export function findDuplicate(
  existing: MediaItem[],
  candidate: Pick<MediaItem, "type" | "title"> & Partial<Pick<MediaItem, "isbn" | "sourceUrl" | "id">>,
): MediaItem | null {
  const key = titleKey(candidate.title ?? "");
  const isbn = isbnKey(candidate.isbn);
  const source = candidate.sourceUrl?.trim();
  return (
    existing.find((item) => {
      if (item.id === candidate.id) return false;
      if (item.type !== candidate.type) return false;
      if (isbn && isbnKey(item.isbn) === isbn) return true;
      if (source && item.sourceUrl?.trim() === source) return true;
      return Boolean(key) && titleKey(item.title) === key;
    }) ?? null
  );
}
