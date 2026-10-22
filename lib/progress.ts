import type { MediaItem } from "./sample-data";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Progress for something with an expected finish date: it grows in a straight line from the
 * last hand-set value (at progressSetAt) to 100% on targetFinishAt. Without a target it is
 * just the stored value. It never marks anything finished by itself.
 */
export function liveProgress(item: MediaItem, now = Date.now()): number | undefined {
  const base = item.progressPercent ?? undefined;
  if (item.status !== "in_progress" || !item.targetFinishAt) return base;
  const target = Date.parse(item.targetFinishAt);
  const from = Date.parse(item.progressSetAt ?? item.updatedAt);
  if (!Number.isFinite(target) || !Number.isFinite(from)) return base;
  const start = base ?? 0;
  if (target <= from) return Math.max(start, 100);
  const share = Math.min(1, Math.max(0, (now - from) / (target - from)));
  return Math.round(start + (100 - start) * share);
}

export function withLiveProgress(item: MediaItem, now = Date.now()): MediaItem {
  if (item.status !== "in_progress" || !item.targetFinishAt) return item;
  return { ...item, progressPercent: liveProgress(item, now) };
}

/** "≈ 2% a day · 18 days left" for the edit panel. */
export function paceLabel(progress: number, targetFinishAt: string, now = Date.now()) {
  const days = (Date.parse(targetFinishAt) - now) / DAY;
  if (!Number.isFinite(days)) return "";
  if (days <= 0) return "Expected finish date has passed";
  const perDay = (100 - progress) / days;
  const left = Math.ceil(days);
  return `≈ ${perDay < 1 ? perDay.toFixed(1) : Math.round(perDay)}% a day · ${left} day${left === 1 ? "" : "s"} left`;
}
