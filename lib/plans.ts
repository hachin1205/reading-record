import type { MediaItem } from "./sample-data";
import { parseTagline } from "./tags";

export type Plan = { name: string; items: MediaItem[]; done: number; finished: boolean; updatedAt: string };

/** Group records that share a plan ("#plan:Name" in their tagline) into watch / read plans. */
export function groupPlans(items: MediaItem[]): Plan[] {
  const byName = new Map<string, MediaItem[]>();
  items.forEach((item) => {
    const plan = parseTagline(item.note).plan;
    if (plan) byName.set(plan, [...(byName.get(plan) ?? []), item]);
  });
  return [...byName.entries()]
    .map(([name, members]) => {
      const done = members.filter((item) => item.status === "finished" || item.status === "dropped").length;
      const updatedAt = members.map((item) => item.updatedAt).sort().at(-1) ?? "";
      return { name, items: members, done, finished: done === members.length, updatedAt };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Ids of records that belong to a plan still in progress (they show inside the plan, not on the shelves). */
export function activePlanIds(plans: Plan[]) {
  return new Set(plans.filter((plan) => !plan.finished).flatMap((plan) => plan.items.map((item) => item.id)));
}
