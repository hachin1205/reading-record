"use client";

import { isCustomSubtype } from "@/lib/subtypes";
import { finishDates, ordinal, recordYears } from "@/lib/viewings";
import { DefaultCover } from "./default-cover";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MediaItem, MediaType } from "@/lib/sample-data";
import { cn } from "@/lib/utils";
import type { DetailOrigin } from "./content-detail";
import { FireBurst } from "./fire-burst";
import { parseTagline } from "@/lib/tags";
import { FilterSelect, YearSelect } from "./year-select";

type Filter = "all" | MediaType;

const PAGE_SIZE = 20;

const filters: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "book", label: "Books" },
  { id: "video", label: "Screen" },
  { id: "game", label: "Games" },
  { id: "writing", label: "Writing" },
];

export function JournalView({
  items,
  onOpenDetail,
  fire,
  initialFilter = "all",
  initialYear = "all",
  reveal,
}: {
  items: MediaItem[];
  onOpenDetail: (item: MediaItem, origin: DetailOrigin) => void;
  fire?: { id: string; key: number } | null;
  initialFilter?: Filter;
  initialYear?: string;
  reveal?: { id: string; type: MediaType; key: number } | null;
}) {
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [query, setQuery] = useState("");
  const [year, setYear] = useState(initialYear);
  const [tag, setTag] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState<"year" | "updated" | "title">("year");
  const normalizedQuery = query.trim().toLowerCase();

  // Something was just added: clear any filter that would hide it.
  useEffect(() => {
    if (!reveal) return;
    setYear("all");
    setTag("all");
    setQuery("");
    setStatusFilter("all");
    setFilter((current) => (current === "all" || current === reveal.type ? current : "all"));
  }, [reveal]);

  // Tags (#吐槽 #評論 …) are read from each record's tagline; counted over the current type tab.
  const tagOptions = useMemo(() => {
    const counts = new Map<string, number>();
    items
      .filter((item) => filter === "all" || item.type === filter)
      .forEach((item) =>
        parseTagline(item.note).tags.forEach((name) => counts.set(name, (counts.get(name) ?? 0) + 1)),
      );
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ value: name, label: `#${name} (${count})` }));
  }, [items, filter]);

  useEffect(() => {
    if (tag !== "all" && !tagOptions.some((option) => option.value === tag)) setTag("all");
  }, [tagOptions, tag]);

  const visible = useMemo(
    () =>
      items.filter((item) => {
        if (filter !== "all" && item.type !== filter) return false;
        if (tag !== "all" && !parseTagline(item.note).tags.includes(tag)) return false;
        if (statusFilter !== "all" && statusKey(item) !== statusFilter) return false;
        if (!normalizedQuery) return true;
        return `${item.title} ${item.creator} ${item.subtype ?? ""} ${item.note ?? ""}`
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    [items, filter, tag, statusFilter, normalizedQuery],
  );

  const now = useMemo(
    () =>
      visible
        .filter((item) => item.status === "in_progress")
        .sort((a, b) => time(b.updatedAt) - time(a.updatedAt)),
    [visible],
  );

  const allYears = useMemo(() => {
    const set = new Set<string>();
    visible
      .filter((item) => item.status !== "in_progress" && item.status !== "planned")
      .forEach((item) => recordYears(item).forEach((value) => set.add(value)));
    return [...set].sort((a, b) => Number(b) - Number(a));
  }, [visible]);

  useEffect(() => {
    if (year !== "all" && !allYears.includes(year)) setYear("all");
  }, [allYears, year]);

  const years = useMemo(() => {
    // A record finished more than once (rewatch / reread) appears in every year it was finished,
    // dated to that viewing and marked "2nd time", "3rd time"…
    const groups = new Map<string, MediaItem[]>();
    visible
      .filter((item) => item.status !== "in_progress" && item.status !== "planned")
      .flatMap((item) => {
        const dates = finishDates(item);
        if (item.status !== "finished" || dates.length < 2) return [item];
        const latestPerYear = new Map<string, { date: string; number: number }>();
        dates.forEach((date, index) => latestPerYear.set(String(new Date(date).getUTCFullYear()), { date, number: index + 1 }));
        return [...latestPerYear.values()].map(({ date, number }) => ({ ...item, finishedAt: date, viewingNumber: number }));
      })
      .sort((a, b) => time(entryDate(b)) - time(entryDate(a)))
      .forEach((item) => {
        const year = String(new Date(entryDate(item)).getUTCFullYear());
        groups.set(year, [...(groups.get(year) ?? []), item]);
      });
    const entries = [...groups.entries()].sort((a, b) => Number(b[0]) - Number(a[0]));
    return year === "all" ? entries : entries.filter(([groupYear]) => groupYear === year);
  }, [visible, year]);

  const planned = useMemo(() => visible.filter((item) => item.status === "planned"), [visible]);

  // Status filter or a non-year sort: one flat list (like the library view), still honouring the year menu.
  const flat = sort !== "year" || statusFilter !== "all";
  const flatItems = useMemo(() => {
    if (!flat) return [];
    return visible
      .filter((item) => year === "all" || recordYears(item).includes(year))
      .sort((a, b) =>
        sort === "title"
          ? a.title.localeCompare(b.title, ["ja", "zh", "en"])
          : sort === "updated"
            ? time(b.updatedAt) - time(a.updatedAt)
            : time(entryDate(b)) - time(entryDate(a)),
      );
  }, [flat, visible, year, sort]);

  const statusOptions =
    filter === "writing"
      ? [
          { value: "published", label: "Published" },
          { value: "draft", label: "Draft" },
        ]
      : [
          { value: "in_progress", label: "In progress" },
          { value: "finished", label: filter === "all" ? "Finished / published" : "Finished" },
          { value: "planned", label: "Up next" },
          { value: "dropped", label: "Set aside" },
          ...(filter === "all" ? [{ value: "draft", label: "Draft" }] : []),
        ];

  // Everything shown, in reading order, as sections — then cut into pages of PAGE_SIZE records.
  const sections = useMemo(() => {
    if (flat) {
      return [
        {
          id: "flat",
          label: sort === "updated" ? "Recently updated" : sort === "title" ? "A–Z" : "Matching",
          items: flatItems,
        },
      ];
    }
    const list: Array<{ id: string; label: string; items: MediaItem[] }> = [];
    if (now.length && year === "all" && tag === "all") list.push({ id: "now", label: "Now", items: now });
    years.forEach(([groupYear, entries]) => list.push({ id: `year-${groupYear}`, label: groupYear, items: entries }));
    if (planned.length && year === "all" && tag === "all") list.push({ id: "planned", label: "Up next", items: planned });
    return list;
  }, [flat, sort, flatItems, now, years, planned, year, tag]);

  const totalShown = sections.reduce((sum, section) => sum + section.items.length, 0);
  const pageCount = Math.max(1, Math.ceil(totalShown / PAGE_SIZE));
  const [page, setPage] = useState(1);
  const listTop = useRef<HTMLDivElement>(null);

  // New filters start again from the first page.
  useEffect(() => {
    setPage(1);
  }, [filter, year, tag, statusFilter, sort, normalizedQuery, reveal]);
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const pageSections = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    let index = 0;
    const out: Array<{ id: string; label: string; total: number; items: MediaItem[] }> = [];
    for (const section of sections) {
      const from = Math.max(start - index, 0);
      const to = Math.min(end - index, section.items.length);
      if (from < to) out.push({ id: section.id, label: section.label, total: section.items.length, items: section.items.slice(from, to) });
      index += section.items.length;
    }
    return out;
  }, [sections, page]);

  function goToPage(next: number) {
    setPage(Math.min(Math.max(1, next), pageCount));
    window.requestAnimationFrame(() => listTop.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return (
    <div className="journal mx-auto w-full max-w-5xl pb-24">
      {/* Row 1: what to show (tabs) + search. Row 2: small filter pills. */}
      <div className="mt-10 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-line pb-3">
        <nav aria-label="Filter by type" className="flex flex-wrap gap-x-5 gap-y-1 text-[15px]">
          {filters.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-pressed={filter === entry.id}
              className={cn(
                "underline-offset-[6px] transition-colors",
                filter === entry.id
                  ? "text-ink underline decoration-accent decoration-2"
                  : "text-muted hover:text-ink",
              )}
              onClick={() => {
                setFilter(entry.id);
                setTag("all");
                setStatusFilter("all");
              }}
            >
              {entry.label}
            </button>
          ))}
        </nav>
        <label className="relative flex w-full items-center sm:w-44">
          <span className="sr-only">Search the record</span>
          <Search size={14} className="pointer-events-none absolute left-0 text-muted" />
          <input
            type="search"
            value={query}
            placeholder="Search"
            onChange={(event) => setQuery(event.target.value)}
            className="h-7 w-full border-0 bg-transparent pl-5 pr-6 text-[14px] text-ink outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              className="absolute right-0 grid h-6 w-6 place-items-center text-muted hover:text-ink"
              onClick={() => setQuery("")}
            >
              <X size={13} />
            </button>
          ) : null}
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {allYears.length > 1 ? (
          <YearSelect compact label="Filter by year" years={allYears} value={year} onChange={setYear} />
        ) : null}
        {tagOptions.length ? (
          <FilterSelect compact label="Filter by tag" allLabel="All tags" options={tagOptions} value={tag} onChange={setTag} />
        ) : null}
        <FilterSelect compact label="Filter by status" allLabel="Any status" options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
        <FilterSelect
          compact
          label="Sort"
          allLabel="By year"
          options={[
            { value: "updated", label: "Recently updated" },
            { value: "title", label: "Title A–Z" },
          ]}
          value={sort === "year" ? "all" : sort}
          onChange={(value) => setSort(value === "all" ? "year" : (value as "updated" | "title"))}
        />
        {year !== "all" || tag !== "all" || statusFilter !== "all" || sort !== "year" ? (
          <button
            type="button"
            className="ml-1 text-[12.5px] text-muted underline-offset-4 hover:text-ink hover:underline"
            onClick={() => {
              setYear("all");
              setTag("all");
              setStatusFilter("all");
              setSort("year");
            }}
          >
            Clear
          </button>
        ) : null}
      </div>

      <div ref={listTop} className="scroll-mt-6" />
      {pageSections.map((section) => (
        <section key={section.id} className={section.id === "flat" ? "mt-10" : "mt-14"} aria-labelledby={`${section.id}-heading`}>
          <SectionHeading id={`${section.id}-heading`} label={section.label} count={section.total} />
          <ul className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2 [&>li]:min-w-0">
            {section.items.map((item) => (
              <li key={item.id}>
                <EntryRow
                  item={item}
                  onOpenDetail={onOpenDetail}
                  showProgress={section.id === "now" || section.id === "flat"}
                  fire={fire}
                  activeTag={tag}
                  onTag={setTag}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {pageCount > 1 ? (
        <nav aria-label="Pages" className="mt-12 flex items-center justify-between gap-3 border-t border-line pt-6 text-[14px]">
          <button
            type="button"
            disabled={page <= 1}
            className="rounded-full border border-line px-3.5 py-1.5 text-muted transition-colors hover:border-ink/40 hover:text-ink disabled:opacity-35"
            onClick={() => goToPage(page - 1)}
          >
            ← Newer
          </button>
          <span className="flex flex-wrap items-center justify-center gap-1">
            {pageNumbers(page, pageCount).map((entry, index) =>
              entry === "…" ? (
                <span key={`gap-${index}`} className="px-1 text-muted">…</span>
              ) : (
                <button
                  key={entry}
                  type="button"
                  aria-current={entry === page ? "page" : undefined}
                  className={cn(
                    "h-8 min-w-8 rounded-full px-2 tabular-nums transition-colors",
                    entry === page ? "bg-ink text-paper" : "text-muted hover:text-ink",
                  )}
                  onClick={() => goToPage(entry)}
                >
                  {entry}
                </button>
              ),
            )}
          </span>
          <button
            type="button"
            disabled={page >= pageCount}
            className="rounded-full border border-line px-3.5 py-1.5 text-muted transition-colors hover:border-ink/40 hover:text-ink disabled:opacity-35"
            onClick={() => goToPage(page + 1)}
          >
            Older →
          </button>
        </nav>
      ) : null}

      {visible.length === 0 ? (
        <p className="mt-20 text-center font-serif text-xl italic text-muted">
          Nothing here yet{normalizedQuery ? ` for “${query.trim()}”` : ""}.
        </p>
      ) : null}
    </div>
  );
}

function SectionHeading({ id, label, count }: { id: string; label: string; count: number }) {
  return (
    <div className="flex items-baseline justify-between border-b border-line pb-3">
      <h2 id={id} className="font-serif text-[28px] font-medium tracking-[-0.01em]">
        {label}
      </h2>
      <span className="text-sm tabular-nums text-muted">{count}</span>
    </div>
  );
}

function EntryRow({
  item,
  onOpenDetail,
  showProgress = false,
  fire,
  activeTag,
  onTag,
}: {
  fire?: { id: string; key: number } | null;
  activeTag?: string;
  onTag?: (tag: string) => void;
  item: MediaItem;
  onOpenDetail: (item: MediaItem, origin: DetailOrigin) => void;
  showDate?: boolean;
  showProgress?: boolean;
}) {
  const { tags } = parseTagline(item.note);
  const writing = item.type === "writing";
  const open = (target: HTMLElement) => onOpenDetail(item, originFrom(target));
  return (
    <div
      role="button"
      tabIndex={0}
      className="group relative flex w-full cursor-pointer gap-4 rounded-[10px] border border-line bg-panel/60 p-4 text-left transition-colors hover:border-ink/30 hover:bg-panel focus-visible:border-ink/40 focus-visible:outline-none sm:gap-5 sm:p-5"
      data-fire-target={item.id}
      onClick={(event) => open(event.currentTarget)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open(event.currentTarget);
        }
      }}
    >
      <span className="relative shrink-0 self-start">
        <Thumb item={item} />
        {fire?.id === item.id ? <FireBurst key={fire.key} seed={fire.key % 997} height={90} /> : null}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate text-[17px] font-medium leading-snug text-ink decoration-accent decoration-1 underline-offset-4 group-hover:underline sm:text-[18px]">
              {item.title}
              {item.favorite ? <span className="ml-1.5 text-accent" aria-label="Favorite">♥</span> : null}
            </span>
            <span className="mt-0.5 block truncate text-[14px] text-muted">{item.creator}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {item.viewingNumber && item.viewingNumber > 1 ? (
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11.5px] font-medium text-accent">↻ {ordinal(item.viewingNumber)}</span>
            ) : !item.viewingNumber && (item.viewings?.length ?? 0) > 1 ? (
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11.5px] font-medium text-accent">↻ ×{item.viewings!.length}</span>
            ) : null}
            <span className="rounded-full border border-line px-2.5 py-0.5 text-[12px] text-muted">{typeBadge(item)}</span>
          </span>
        </span>

        <span className="mt-3 grid grid-cols-3 gap-3 text-[12px]">
          <span className="min-w-0">
            <span className="block font-medium text-ink/80">Status</span>
            <span className={cn("block truncate text-muted", item.status === "in_progress" && !writing && "text-[#2f7181]")}>
              {statusText(item)}
            </span>
          </span>
          <span className="min-w-0">
            <span className="block font-medium text-ink/80">{writing ? "Tags" : "Rating"}</span>
            <span className="block truncate text-muted">
              {writing ? (tags.length ? `${tags.length}` : "–") : item.rating != null ? `★ ${formatRating(item.rating)}` : "–"}
            </span>
          </span>
          <span className="min-w-0">
            <span className="block font-medium text-ink/80">{writing ? "Written" : item.finishedAt ? "Finished" : "Updated"}</span>
            <span className="block truncate tabular-nums text-muted">
              {shortDate(writing ? item.publishedAt ?? item.updatedAt : item.finishedAt ?? item.updatedAt)}
            </span>
          </span>
        </span>

        {showProgress && item.status === "in_progress" && item.progressPercent != null && !writing ? (
          <span className="mt-3 block h-[3px] overflow-hidden rounded-full bg-line">
            <span
              className="block h-full rounded-full bg-[#2f7181]"
              style={{ width: `${Math.max(2, Math.min(100, item.progressPercent))}%` }}
            />
          </span>
        ) : null}

        {tags.length ? (
          <span className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((name) => (
              <button
                key={name}
                type="button"
                title={`Show only #${name}`}
                className={cn(
                  "rounded-full border px-2 py-px text-[12px] leading-5 transition-colors",
                  activeTag === name
                    ? "border-ink bg-ink text-paper"
                    : "border-line text-muted hover:border-ink/40 hover:text-ink",
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  onTag?.(activeTag === name ? "all" : name);
                }}
              >
                #{name}
              </button>
            ))}
          </span>
        ) : null}
      </span>
    </div>
  );
}

function Thumb({ item }: { item: MediaItem }) {
  const square = item.type === "video" && item.subtype !== "movie";
  return (
    <span
      className={cn(
        "cover-fallback relative block w-12 overflow-hidden rounded-[3px] ring-1 ring-black/10 sm:w-14",
        square ? "aspect-square" : "aspect-[2/3]",
      )}
      style={
        {
          "--fallback-a": item.coverTone[0],
          "--fallback-b": item.coverTone[1],
        } as React.CSSProperties
      }
      aria-hidden="true"
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
        <DefaultCover item={item} />
      )}
    </span>
  );
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

function formatRating(rating: number) {
  return `${rating % 1 === 0 ? rating : rating.toFixed(1)}/5`;
}

export function kindLabel(item: MediaItem) {
  switch (item.subtype) {
    case "movie":
      return "Film";
    case "anime":
      return "Anime";
    case "j_drama":
      return "J-drama";
    case "k_drama":
      return "K-drama";
    case "us_tv":
      return "Series";
    case "documentary":
      return "Documentary";
    case "visual_novel":
      return "Visual novel";
    case "essay":
      return "Essay";
    case "short_story":
      return "Short story";
    case "note":
      return "Note";
    default:
      if (item.subtype) return item.subtype;
      break;
  }
  if (item.type === "book") return "Book";
  if (item.type === "video") return "Film";
  if (item.type === "game") return "Game";
  return "Writing";
}

/** Status as shown in the list: writing is Published / Draft, everything else uses its record status. */
function statusKey(item: MediaItem) {
  if (item.type === "writing") return /(^|·\s*)Draft(\s*·|$)/i.test(parseTagline(item.note).text) ? "draft" : "published";
  return item.status;
}

function statusText(item: MediaItem) {
  switch (statusKey(item)) {
    case "draft":
      return "Draft";
    case "published":
      return "Published";
    case "in_progress":
      return item.progressPercent ? `In progress · ${item.progressPercent}%` : "In progress";
    case "finished":
      return "Finished";
    case "planned":
      return "Up next";
    case "dropped":
      return "Set aside";
    default:
      return item.status;
  }
}

function typeBadge(item: MediaItem) {
  if (isCustomSubtype(item.subtype)) return item.subtype as string;
  if (item.type === "book") return "Book";
  if (item.type === "game") return "Game";
  if (item.type === "writing") return "Writing";
  return kindLabel(item);
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

/** 1 … 4 5 6 … 12 */
function pageNumbers(page: number, count: number): Array<number | "…"> {
  if (count <= 7) return Array.from({ length: count }, (_, index) => index + 1);
  const pages = new Set([1, count, page - 1, page, page + 1]);
  const sorted = [...pages].filter((value) => value >= 1 && value <= count).sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  sorted.forEach((value, index) => {
    if (index && value - sorted[index - 1] > 1) out.push("…");
    out.push(value);
  });
  return out;
}
