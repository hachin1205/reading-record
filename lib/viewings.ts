import type { ContentExperience } from "./types";
import type { MediaItem } from "./sample-data";

/** Every date this record was finished (each read / watch / play), oldest first. */
export function finishDates(item: MediaItem): string[] {
  if (item.viewings?.length) return item.viewings;
  return item.finishedAt ? [item.finishedAt] : [];
}

function year(value: string) {
  const parsed = new Date(value).getUTCFullYear();
  return Number.isFinite(parsed) ? String(parsed) : "Undated";
}

/** Years this record belongs to: every year it was finished in, or its single entry year otherwise. */
export function recordYears(item: MediaItem): string[] {
  const dates = item.status === "finished" || item.viewings?.length ? finishDates(item) : [];
  if (dates.length) return [...new Set(dates.map(year))];
  return [year(item.finishedAt ?? item.publishedAt ?? item.updatedAt)];
}

/** Attach finish dates from the experiences table (rewatches) to each record. */
export function withViewings(items: MediaItem[], experiences: ContentExperience[]): MediaItem[] {
  if (!experiences.length) return items;
  const byContent = new Map<string, string[]>();
  experiences.forEach((experience) => {
    if (experience.status !== "finished" || !experience.finishedAt) return;
    byContent.set(experience.contentId, [...(byContent.get(experience.contentId) ?? []), experience.finishedAt]);
  });
  return items.map((item) => {
    const dates = byContent.get(item.id);
    if (!dates) return item;
    const all = [...dates, ...(item.finishedAt ? [item.finishedAt] : [])];
    // Same day counts once (the record's finishedAt usually equals its latest experience).
    const unique = [...new Map(all.map((date) => [date.slice(0, 10), date])).values()].sort();
    return { ...item, viewings: unique };
  });
}

export function ordinal(n: number) {
  if (n === 2) return "2nd time";
  if (n === 3) return "3rd time";
  return `${n}th time`;
}
