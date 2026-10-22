"use client";

import type { Plan } from "@/lib/plans";
import type { MediaItem } from "@/lib/sample-data";
import { cn } from "@/lib/utils";
import type { DetailOrigin } from "./content-detail";
import { DefaultCover } from "./default-cover";

const HEIGHT = 100; // same height as the other covers on the "Currently Enjoying" shelf
const WIDTH = Math.round((HEIGHT * 2) / 3);
const STEP = 22; // how much of each tucked-behind cover shows

/**
 * A plan on the shelf: its covers stacked like a box set, wrapped in a paper band (an "obi")
 * that carries the plan's name and how many titles are done.
 */
export function PlanBundle({
  plan,
  onOpenDetail,
  onOpenPlan,
}: {
  plan: Plan;
  onOpenDetail: (item: MediaItem, origin: DetailOrigin) => void;
  /** Open the plan's own page (notes about the whole plan). */
  onOpenPlan?: (plan: Plan, origin: DetailOrigin) => void;
}) {
  const shown = plan.items.slice(0, 5);
  const share = plan.items.length ? plan.done / plan.items.length : 0;
  const width = WIDTH + STEP * (shown.length - 1);
  return (
    <div
      className="group/plan relative mr-3 shrink-0 self-end"
      style={{ width, height: HEIGHT }}
      title={`${plan.name} — ${plan.done} of ${plan.items.length} done`}
    >
      {shown.map((item, index) => {
        const done = item.status === "finished" || item.status === "dropped";
        return (
          <button
            key={item.id}
            type="button"
            aria-label={`Open ${item.title}`}
            className={cn(
              "absolute bottom-0 overflow-hidden rounded-[2px] shadow-[1px_0_0_rgba(255,255,255,0.4),2px_2px_6px_-2px_rgba(0,0,0,0.35)] ring-1 ring-black/10 transition-transform duration-200 hover:z-30 hover:-translate-y-2",
              done && "grayscale-[0.6]",
            )}
            style={{ left: index * STEP, width: WIDTH, height: HEIGHT, zIndex: shown.length - index }}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              onOpenDetail(item, {
                centerX: rect.left + rect.width / 2,
                centerY: rect.top + rect.height / 2,
                width: rect.width,
                height: rect.height,
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
              });
            }}
          >
            {item.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" referrerPolicy="no-referrer" src={item.coverUrl} />
            ) : (
              <DefaultCover item={item} />
            )}
          </button>
        );
      })}

      {/* the obi: paper band around the set */}
      <button
        type="button"
        title="Open the plan — notes about the whole plan"
        className="absolute inset-x-[-3px] bottom-[14%] z-40 block rounded-[1px] bg-[#f6efe1] px-2 py-1 text-left text-[#2b2722] shadow-[0_2px_5px_-2px_rgba(0,0,0,0.4)] transition-transform hover:-translate-y-0.5"
        style={{ borderTop: "2px solid rgb(var(--accent))" }}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          onOpenPlan?.(plan, {
            centerX: rect.left + rect.width / 2,
            centerY: rect.top + rect.height / 2,
            width: rect.width,
            height: rect.height,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
          });
        }}
      >
        <div className="flex items-baseline justify-between gap-1.5">
          <span className="truncate font-serif text-[11.5px] leading-tight">{plan.name}</span>
          <span className="shrink-0 text-[9.5px] font-semibold tabular-nums tracking-wide text-[#7a6f60]">
            {plan.done}/{plan.items.length}
          </span>
        </div>
        <span className="mt-0.5 block h-[2px] overflow-hidden rounded-full bg-black/10">
          <span className="block h-full bg-[rgb(var(--accent))]" style={{ width: `${Math.round(share * 100)}%` }} />
        </span>
      </button>
      {plan.items.length > shown.length ? (
        <span className="absolute -right-1 -top-2 z-50 rounded-full bg-ink px-1.5 py-0.5 text-[10px] font-semibold text-paper">
          +{plan.items.length - shown.length}
        </span>
      ) : null}
    </div>
  );
}
