"use client";

import { useMemo } from "react";
import type { MediaItem, MediaType } from "@/lib/sample-data";
import { cn } from "@/lib/utils";
import type { DetailOrigin } from "./content-detail";
import { kindLabel } from "./journal-view";

const sections: Array<{ type: MediaType; label: string }> = [
  { type: "book", label: "Books" },
  { type: "video", label: "Screen" },
  { type: "game", label: "Games" },
  { type: "writing", label: "Writing" },
];

const statusOrder: Record<MediaItem["status"], number> = {
  in_progress: 0,
  finished: 1,
  dropped: 2,
  planned: 3,
};

export function ShelfView({
  items,
  activeThemeId,
  themeProgress,
  onPlayTheme,
  onOpenDetail,
}: {
  items: MediaItem[];
  activeThemeId?: string;
  themeProgress: number;
  onPlayTheme: (item: MediaItem) => void;
  onOpenDetail: (item: MediaItem, origin: DetailOrigin) => void;
}) {
  const grouped = useMemo(
    () =>
      sections
        .map((section) => ({
          ...section,
          entries: items
            .filter((item) => item.type === section.type)
            .sort(
              (a, b) =>
                statusOrder[a.status] - statusOrder[b.status] ||
                Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) ||
                time(entryDate(b)) - time(entryDate(a)),
            ),
        }))
        .filter((section) => section.entries.length > 0),
    [items],
  );

  return (
    <div className="mx-auto w-full max-w-[42rem] pb-24">
      {grouped.map((section) => (
        <section key={section.type} className="mt-14 first:mt-12" aria-labelledby={`shelf-${section.type}`}>
          <div className="flex items-baseline justify-between">
            <h2 id={`shelf-${section.type}`} className="font-serif text-[28px] font-medium tracking-[-0.01em]">
              {section.label}
            </h2>
            <span className="text-sm tabular-nums text-muted">{section.entries.length}</span>
          </div>

          <ul className="mt-6 grid grid-cols-3 gap-y-10 sm:grid-cols-4">
            {section.entries.map((item) => (
              <li key={item.id} className="flex flex-col">
                <ShelfItem
                  item={item}
                  playing={item.id === activeThemeId}
                  themeProgress={item.id === activeThemeId ? themeProgress : 0}
                  onPlayTheme={onPlayTheme}
                  onOpenDetail={onOpenDetail}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {grouped.length === 0 ? (
        <p className="mt-20 text-center font-serif text-xl italic text-muted">The shelf is empty for now.</p>
      ) : null}
    </div>
  );
}

function ShelfItem({
  item,
  playing,
  themeProgress,
  onPlayTheme,
  onOpenDetail,
}: {
  item: MediaItem;
  playing: boolean;
  themeProgress: number;
  onPlayTheme: (item: MediaItem) => void;
  onOpenDetail: (item: MediaItem, origin: DetailOrigin) => void;
}) {
  const muted = item.status === "dropped" || item.status === "planned";

  return (
    <>
      {/* The ledge: cover sits on a hairline that runs edge to edge across the cell,
          so a full row reads as one continuous shelf. */}
      <button
        type="button"
        aria-label={`Open ${item.title}`}
        className="group flex h-44 items-end border-b border-line px-2.5 sm:h-52 sm:px-3"
        onClick={(event) => onOpenDetail(item, originFrom(event.currentTarget))}
      >
        <span
          className={cn(
            "cover-fallback relative block w-full overflow-hidden rounded-t-[2px] shadow-[0_1px_2px_rgba(0,0,0,0.08),0_8px_18px_-8px_rgba(0,0,0,0.28)] transition-transform duration-200 ease-out group-hover:-translate-y-1",
            "aspect-[2/3]",
            muted && "opacity-55 grayscale-[0.4]",
          )}
          style={
            {
              "--fallback-a": item.coverTone[0],
              "--fallback-b": item.coverTone[1],
            } as React.CSSProperties
          }
        >
          {item.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              src={item.coverUrl}
            />
          ) : (
            <span className="absolute inset-x-0 bottom-0 p-2.5 text-left font-serif text-[13px] leading-tight text-white/95">
              {item.title}
            </span>
          )}
          {item.status === "in_progress" && item.progressPercent ? (
            <span className="absolute inset-x-0 bottom-0 h-[3px] bg-black/25" aria-hidden="true">
              <span
                className="block h-full bg-white/90"
                style={{ width: `${Math.max(2, Math.min(100, item.progressPercent))}%` }}
              />
            </span>
          ) : null}
        </span>
      </button>

      <div className="mt-3 min-w-0 px-2.5 sm:px-3">
        <p className="line-clamp-2 font-serif text-[15px] leading-snug text-ink">
          {item.title}
          {item.favorite ? <span className="ml-1 text-accent" aria-label="Favorite">*</span> : null}
        </p>
        <p className="mt-1 truncate text-[13px] text-muted">{item.creator}</p>
        <p className="mt-0.5 text-[12px] text-muted/80">
          {captionStatus(item)}
          {item.themeYoutubeId ? (
            <>
              <span className="mx-1 opacity-60">·</span>
              <button
                type="button"
                className={cn(
                  "underline-offset-2 transition-colors hover:text-ink hover:underline",
                  playing && "text-accent",
                )}
                onClick={() => onPlayTheme(item)}
              >
                {playing ? `Stop theme ${Math.round(themeProgress * 100)}%` : "♪ Theme"}
              </button>
            </>
          ) : null}
        </p>
      </div>
    </>
  );
}

function captionStatus(item: MediaItem) {
  if (item.status === "in_progress") {
    const verb = item.type === "book" ? "Reading" : item.type === "game" ? "Playing" : "Watching";
    return item.progressPercent ? `${verb} · ${item.progressPercent}%` : verb;
  }
  if (item.status === "planned") return "Up next";
  if (item.status === "dropped") return "Set aside";
  return item.type === "book" ? new Date(entryDate(item)).getUTCFullYear().toString() : kindLabel(item);
}

function originFrom(element: HTMLElement): DetailOrigin {
  const rect = element.getBoundingClientRect();
  return {
    centerX: rect.left + rect.width / 2,
    centerY: rect.top + rect.height / 2,
    width: rect.width,
    height: rect.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };
}

function entryDate(item: MediaItem) {
  return item.finishedAt ?? item.publishedAt ?? item.updatedAt;
}

function time(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}
