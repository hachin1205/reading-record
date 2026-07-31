"use client";

import { motion } from "framer-motion";
import { Archive, BookOpen, Grid2X2, Library, Lock, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  belongsOnHome,
  belongsInActiveYear,
  activeYear,
  isCurrent,
  mediaItems,
  statusCounts,
  type MediaItem,
} from "@/lib/sample-data";
import { cn } from "@/lib/utils";
import { AuthorBookmark, MediaObject } from "./media-object";
import { ContentDetail } from "./content-detail";
import { ThemeToggle } from "./theme-shell";

type ViewMode = "shelf" | "matrix";

export function HomePage({ initialItems = mediaItems }: { initialItems?: MediaItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [viewMode, setViewMode] = useState<ViewMode>("shelf");
  const [activeTheme, setActiveTheme] = useState<MediaItem | null>(null);
  const [themeProgress, setThemeProgress] = useState(0);
  const [expandedFilms, setExpandedFilms] = useState<Record<string, boolean>>({});
  const [detailItem, setDetailItem] = useState<MediaItem | null>(null);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    const refreshLibrary = async () => {
      try {
        const response = await fetch("/api/media", { cache: "no-store" });
        if (!response.ok) return;

        const payload = (await response.json()) as { data?: MediaItem[] };
        if (Array.isArray(payload.data)) {
          setItems(payload.data);
        }
      } catch {
        // Keep the last rendered shelf available during a temporary connection failure.
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshLibrary();
      }
    };

    window.addEventListener("pageshow", refreshLibrary);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pageshow", refreshLibrary);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!activeTheme?.themeYoutubeId) {
      setThemeProgress(0);
      return;
    }

    const duration = Math.max(
      1,
      (activeTheme.themeEndSeconds ?? 30) - (activeTheme.themeStartSeconds ?? 0),
    );
    const startedAt = Date.now();
    setThemeProgress(0);

    const timer = window.setInterval(() => {
      const next = Math.min(1, (Date.now() - startedAt) / (duration * 1000));
      setThemeProgress(next);
      if (next >= 1) {
        window.clearInterval(timer);
        setExpandedFilms((current) => ({ ...current, [activeTheme.id]: false }));
        setActiveTheme(null);
      }
    }, 200);

    return () => window.clearInterval(timer);
  }, [activeTheme]);

  const shelfHomeItems = useMemo(
    () => items.filter(belongsOnHome).sort(sortHomeItems),
    [items],
  );
  const matrixItems = useMemo(
    () => items.filter(belongsInActiveYear).sort(sortHomeItems),
    [items],
  );
  const currentItems = shelfHomeItems.filter(isCurrent);
  const currentIds = new Set(currentItems.map((item) => item.id));
  const shelfItems = shelfHomeItems.filter((item) => !currentIds.has(item.id));
  const counts = statusCounts(matrixItems);

  return (
    <main className="min-h-screen px-2 py-5 sm:px-3 lg:px-4">
      <header className="mx-auto flex max-w-7xl items-start justify-between gap-3 border-b border-line/70 pb-5">
        <div className="min-w-0">
          <p className="mb-2 inline-flex rounded-full border border-line bg-panel px-2.5 py-1 text-xs font-semibold text-muted shadow-sm">
            {activeYear}
          </p>
          <h1 className="whitespace-nowrap font-serif text-4xl font-semibold leading-none sm:text-6xl">
            Reading Record
          </h1>
          <p className="mt-2 truncate text-sm text-muted">
            {counts.total} records · {counts.finished} completed · {counts.in_progress} in
            progress · {counts.dropped} dropped
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <nav className="hidden items-center gap-4 text-sm text-muted md:flex">
            <a className="text-ink" href="#">
              Home
            </a>
            <a href="#">Archive</a>
            <Link href="/admin">Admin</Link>
          </nav>
          <Link
            aria-label="Admin"
            className="grid h-9 w-9 place-items-center rounded-full border border-line bg-panel text-ink shadow-sm transition hover:-translate-y-0.5 md:hidden"
            href="/admin"
          >
            <Lock size={15} />
          </Link>
          <div className="flex rounded-full border border-line bg-panel p-1 shadow-sm md:ml-2">
            <ViewButton
              active={viewMode === "shelf"}
              icon={<Library size={15} />}
              label="Shelf"
              onClick={() => setViewMode("shelf")}
            />
            <ViewButton
              active={viewMode === "matrix"}
              icon={<Grid2X2 size={15} />}
              label="Matrix"
              onClick={() => setViewMode("matrix")}
            />
          </div>
          <ThemeToggle />
        </div>
      </header>

      {viewMode === "shelf" ? (
        <ShelfView
          currentItems={currentItems}
          shelfItems={shelfItems}
          activeThemeId={activeTheme?.id}
          themeProgress={themeProgress}
          onPlayTheme={(item) => {
            setActiveTheme((current) => {
              if (current?.id === item.id) {
                setExpandedFilms((expanded) => ({ ...expanded, [item.id]: false }));
                return null;
              }
              return item;
            });
          }}
          expandedFilms={expandedFilms}
          onToggleFilmExpand={(id) =>
            setExpandedFilms((current) => ({ ...current, [id]: !current[id] }))
          }
          onOpenDetail={setDetailItem}
        />
      ) : (
        <MatrixView items={matrixItems} counts={counts} onOpenDetail={setDetailItem} />
      )}
      {activeTheme ? <HiddenThemePlayer item={activeTheme} /> : null}
      <ContentDetail item={detailItem} onClose={() => setDetailItem(null)} />
    </main>
  );
}

function ViewButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition",
        active ? "bg-ink text-paper" : "text-muted hover:text-ink",
      )}
      type="button"
      onClick={onClick}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function ShelfView({
  currentItems,
  shelfItems,
  activeThemeId,
  themeProgress,
  onPlayTheme,
  expandedFilms,
  onToggleFilmExpand,
  onOpenDetail,
}: {
  currentItems: MediaItem[];
  shelfItems: MediaItem[];
  activeThemeId?: string;
  themeProgress: number;
  onPlayTheme: (item: MediaItem) => void;
  expandedFilms: Record<string, boolean>;
  onToggleFilmExpand: (id: string) => void;
  onOpenDetail: (item: MediaItem) => void;
}) {
  const initialBooks = useMemo(
    () => shelfItems.filter((item) => item.type === "book"),
    [shelfItems],
  );
  const [bookOrder, setBookOrder] = useState<string[]>(() => initialBooks.map((item) => item.id));
  const initialGames = useMemo(
    () => shelfItems.filter((item) => item.type === "game"),
    [shelfItems],
  );
  const [gameOrder, setGameOrder] = useState<string[]>(() => initialGames.map((item) => item.id));
  const books = useMemo(() => {
    const byId = new Map(initialBooks.map((item) => [item.id, item]));
    return bookOrder.map((id) => byId.get(id)).filter(Boolean) as MediaItem[];
  }, [bookOrder, initialBooks]);
  const games = useMemo(() => {
    const byId = new Map(initialGames.map((item) => [item.id, item]));
    return gameOrder.map((id) => byId.get(id)).filter(Boolean) as MediaItem[];
  }, [gameOrder, initialGames]);

  return (
    <section className="bookcase-frame relative mx-auto mt-1 max-w-7xl space-y-6 rounded-[12px] px-3 py-5 sm:px-4 lg:px-5">
      <ShelfRow title="Currently Enjoying" items={currentItems} current activeThemeId={activeThemeId} themeProgress={themeProgress} onPlayTheme={onPlayTheme} onOpenDetail={onOpenDetail} />
      <ShelfRow
        title="Books"
        items={books}
        reorderable
        onReorder={setBookOrder}
        activeThemeId={activeThemeId}
        themeProgress={themeProgress}
        onPlayTheme={onPlayTheme}
        onOpenDetail={onOpenDetail}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <ShelfRow
          title="Videos"
          items={shelfItems.filter((item) => item.type === "video")}
          dense
          activeThemeId={activeThemeId}
          themeProgress={themeProgress}
          softOverlap
          onPlayTheme={onPlayTheme}
          expandedFilms={expandedFilms}
          onToggleFilmExpand={onToggleFilmExpand}
          onOpenDetail={onOpenDetail}
        />
        <ShelfRow
          title="Games"
          items={games}
          dense
          activeThemeId={activeThemeId}
          themeProgress={themeProgress}
          stackOverlap
          onReorder={setGameOrder}
          onPlayTheme={onPlayTheme}
          onOpenDetail={onOpenDetail}
        />
      </div>
      <ShelfRow title="Writings" items={shelfItems.filter((item) => item.type === "writing")} activeThemeId={activeThemeId} themeProgress={themeProgress} onPlayTheme={onPlayTheme} onOpenDetail={onOpenDetail} />
      <div className="flex justify-center pb-8">
        <a
          className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:-translate-y-0.5"
          href="#"
        >
          <Archive size={16} />
          Browse archive
        </a>
      </div>
    </section>
  );
}

function ShelfRow({
  title,
  items,
  current = false,
  reorderable = false,
  onReorder,
  dense = false,
  activeThemeId,
  themeProgress = 0,
  stackOverlap = false,
  softOverlap = false,
  onPlayTheme,
  expandedFilms,
  onToggleFilmExpand,
  onOpenDetail,
}: {
  title: string;
  items: MediaItem[];
  current?: boolean;
  reorderable?: boolean;
  onReorder?: (ids: string[]) => void;
  dense?: boolean;
  activeThemeId?: string;
  themeProgress?: number;
  stackOverlap?: boolean;
  softOverlap?: boolean;
  onPlayTheme?: (item: MediaItem) => void;
  expandedFilms?: Record<string, boolean>;
  onToggleFilmExpand?: (id: string) => void;
  onOpenDetail: (item: MediaItem) => void;
}) {
  const arranged = reorderable ? withAuthorBookmarks(items) : items;

  return (
    <section>
      {current ? (
        <div className="mb-2 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-2xl font-semibold">{title}</h2>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">
              Pinned and in-progress
            </p>
          </div>
        </div>
      ) : null}
      <div
        className={cn(
          "shelf-bay relative rounded-[8px] border border-line/80 px-2 sm:px-3",
          "overflow-hidden",
          current ? "pt-3" : "pt-7",
        )}
      >
        <div
          className={cn(
            "absolute inset-x-3 top-0 rounded-b-sm shadow-sm",
            current ? "h-3 bg-shelf/35" : "h-5 bg-shelf/65",
          )}
        />
        {!current ? (
          <div className="absolute left-5 top-1 z-20 -rotate-[0.6deg] rounded-[3px] border border-[#d8ceb8] bg-[#fffaf0] px-3 py-1 shadow-[0_1px_2px_rgba(0,0,0,0.14),inset_0_1px_rgba(255,255,255,0.9)]">
            <span className="font-serif text-sm font-semibold leading-none text-[#4c3620]">
              {title}
            </span>
          </div>
        ) : null}
        <div
          className={cn(
            "shelf-scroll relative z-10 flex items-end gap-0.5 overflow-x-auto",
            current ? "min-h-[128px] pb-5" : dense ? "min-h-[148px] pb-6" : "min-h-[178px] pb-7",
          )}
        >
          {arranged.map((entry, visualIndex) =>
            "bookmark" in entry ? (
              <AuthorBookmark key={`bookmark-${entry.label}-${entry.index}`} label={entry.label} />
            ) : (
            <motion.div
              key={entry.id}
              className="relative shrink-0 cursor-grab touch-none border-0 bg-transparent p-0 text-left active:cursor-grabbing"
              role="button"
              tabIndex={0}
              aria-label={`Open ${entry.title}`}
              onClick={() => {
                const isCollapsedPlayableFilm =
                  entry.type === "video" &&
                  entry.themeYoutubeId &&
                  visualIndex >= 3 &&
                  !entry.favorite &&
                  !expandedFilms?.[entry.id] &&
                  activeThemeId !== entry.id;

                if (isCollapsedPlayableFilm) {
                  onToggleFilmExpand?.(entry.id);
                  return;
                }

                if (entry.type === "video" && entry.themeYoutubeId && (activeThemeId === entry.id || expandedFilms?.[entry.id])) {
                  onPlayTheme?.(entry);
                  return;
                }

                onOpenDetail(entry);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.currentTarget.click();
                }
              }}
              drag={reorderable || stackOverlap ? "x" : true}
              dragSnapToOrigin
              dragElastic={reorderable ? 0.02 : 0.16}
              dragConstraints={
                stackOverlap
                  ? { left: -44, right: 44 }
                  : reorderable
                    ? { left: -46, right: 46 }
                    : { left: -42, right: 42, top: -22, bottom: 10 }
              }
              style={
                stackOverlap
                  ? { marginLeft: visualIndex > 0 ? -6 : 0, zIndex: visualIndex }
                  : softOverlap
                    ? {
                        marginLeft:
                          visualIndex > 0 && !isVideoSpine(entry, visualIndex, activeThemeId, expandedFilms)
                            ? -24
                            : 0,
                        zIndex: visualIndex,
                      }
                    : undefined
              }
              onDragEnd={(_, info) => {
                if ((!reorderable && !stackOverlap) || !onReorder) return;
                const index = items.findIndex((item) => item.id === entry.id);
                if (index < 0) return;
                const threshold = 22;
                const direction = info.offset.x > threshold ? 1 : info.offset.x < -threshold ? -1 : 0;
                if (!direction) return;
                const nextIndex = Math.max(0, Math.min(items.length - 1, index + direction));
                if (nextIndex === index) return;
                const next = [...items];
                const [moved] = next.splice(index, 1);
                next.splice(nextIndex, 0, moved);
                onReorder(next.map((item) => item.id));
              }}
              whileHover={reorderable ? undefined : { y: -4 }}
              whileDrag={
                reorderable || stackOverlap
                  ? { zIndex: 40 }
                  : {
                      y: -18,
                      scale: 1.045,
                      rotate: current ? 0 : entry.type === "book" ? -1.5 : entry.type === "video" ? 0 : 1,
                      zIndex: 40,
                    }
              }
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
            >
              <MediaObject
                item={entry}
                compact={current}
                playing={entry.id === activeThemeId}
                progress={entry.id === activeThemeId ? themeProgress : 0}
                shelfIndex={visualIndex}
                expanded={Boolean(expandedFilms?.[entry.id])}
              />
              {entry.type === "video" && entry.themeYoutubeId ? (
                <button
                  aria-label={`Open details for ${entry.title}`}
                  className="absolute right-1 top-1 z-30 grid h-7 w-7 place-items-center rounded-full border border-white/30 bg-black/55 text-white opacity-0 shadow-sm transition hover:bg-black/75 group-hover:opacity-100 focus:opacity-100"
                  title="Open details"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenDetail(entry);
                  }}
                >
                  <BookOpen size={13} />
                </button>
              ) : null}
            </motion.div>
            )
          )}
        </div>
        <div
          className={cn(
            "shelf-rail absolute inset-x-0 bottom-0 rounded-b-[8px]",
            current ? "h-7" : "h-8",
          )}
        />
      </div>
    </section>
  );
}

function HiddenThemePlayer({ item }: { item: MediaItem }) {
  if (!item.themeYoutubeId) return null;

  const params = new URLSearchParams({
    autoplay: "1",
    rel: "0",
    start: String(item.themeStartSeconds ?? 0),
  });

  if (item.themeEndSeconds) params.set("end", String(item.themeEndSeconds));

  return (
    <div className="pointer-events-none fixed bottom-0 right-0 h-px w-px overflow-hidden opacity-0" aria-hidden="true">
      <iframe
        className="h-px w-px"
        src={`https://www.youtube.com/embed/${item.themeYoutubeId}?${params.toString()}`}
        title={`${item.title} theme song`}
        allow="autoplay; encrypted-media"
      />
    </div>
  );
}

function MatrixView({
  items,
  counts,
  onOpenDetail,
}: {
  items: MediaItem[];
  counts: ReturnType<typeof statusCounts>;
  onOpenDetail: (item: MediaItem) => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    if (!normalizedQuery) return true;
    return `${item.title} ${item.creator} ${item.type} ${item.subtype ?? ""}`
      .toLowerCase()
      .includes(normalizedQuery);
  });
  const columns = 20;
  const fillerCount =
    filteredItems.length === 0
      ? 0
      : (columns - (filteredItems.length % columns)) % columns;

  return (
    <section className="mx-auto mt-6 max-w-[92rem] px-3 pb-8 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-serif text-4xl font-semibold sm:text-5xl">{activeYear}</h2>
          <p className="mt-2 text-sm text-muted">
            {counts.finished} completed · {counts.in_progress} in progress · {counts.dropped}{" "}
            dropped · {counts.planned} planned
          </p>
        </div>
        <label className="relative block w-full sm:w-72">
          <span className="sr-only">Search records</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            size={16}
          />
          <input
            className="h-10 w-full rounded-full border border-line bg-panel pl-9 pr-10 text-sm shadow-sm outline-none transition focus:border-ink"
            placeholder="Search title or creator"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query ? (
            <button
              aria-label="Clear search"
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted transition hover:bg-paper hover:text-ink"
              type="button"
              onClick={() => setQuery("")}
            >
              <X size={14} />
            </button>
          ) : null}
        </label>
      </div>

      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8 md:grid-cols-12 lg:grid-cols-16 xl:grid-cols-20">
        {filteredItems.map((item) => (
          <button
            key={item.id}
            aria-label={`Open ${item.title}`}
            className="group grid aspect-[2/3] place-items-center overflow-hidden rounded-[7px] border border-black/10 bg-panel shadow-sm transition hover:-translate-y-1"
            title={item.title}
            type="button"
            onClick={() => onOpenDetail(item)}
          >
            <div
              className="cover-fallback h-full w-full"
              style={
                {
                  "--fallback-a": item.coverTone[0],
                  "--fallback-b": item.coverTone[1],
                } as React.CSSProperties
              }
            >
              <span className="sr-only">{item.title}</span>
            </div>
          </button>
        ))}
        {Array.from({ length: fillerCount }).map((_, index) => (
          <div
            key={`matrix-filler-${index}`}
            className="grid aspect-[2/3] place-items-center rounded-[8px] border border-[#4c3b2a]/70 bg-[linear-gradient(145deg,#6f563b,#2f2923)] p-1 shadow-[inset_0_1px_rgba(255,255,255,0.18),0_3px_8px_rgba(0,0,0,0.16)]"
            aria-hidden="true"
          >
            <div className="relative h-full w-full rounded-[5px] border border-[#1f1a15]/70 bg-[#d8cdb7]/50 shadow-inner">
              <div className="absolute inset-1 rounded-[3px] border border-[#5d4a35]/45 bg-[#efe5d2]/28" />
              <div className="absolute left-1 top-1 h-2 w-2 border-l border-t border-[#35291d]/80" />
              <div className="absolute right-1 top-1 h-2 w-2 border-r border-t border-[#35291d]/80" />
              <div className="absolute bottom-1 left-1 h-2 w-2 border-b border-l border-[#35291d]/80" />
              <div className="absolute bottom-1 right-1 h-2 w-2 border-b border-r border-[#35291d]/80" />
            </div>
          </div>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-panel/60 px-6 py-14 text-center">
          <p className="font-serif text-2xl font-semibold">No matching records</p>
          <p className="mt-2 text-sm text-muted">Try a title, creator, or media type.</p>
        </div>
      ) : null}

      <p className="py-8 text-center text-sm text-muted">
        {normalizedQuery
          ? `${filteredItems.length} of ${items.length} records shown.`
          : "Older records live in Archive by year."}
      </p>
    </section>
  );
}

function isVideoSpine(
  entry: MediaItem,
  visualIndex: number,
  activeThemeId?: string,
  expandedFilms?: Record<string, boolean>,
) {
  return (
    entry.type === "video" &&
    visualIndex >= 3 &&
    !entry.favorite &&
    entry.id !== activeThemeId &&
    !expandedFilms?.[entry.id]
  );
}

function sortHomeItems(a: MediaItem, b: MediaItem) {
  const aFeatured = a.featured ? 1 : 0;
  const bFeatured = b.featured ? 1 : 0;
  if (aFeatured !== bFeatured) return bFeatured - aFeatured;
  const aFavorite = a.favorite ? 1 : 0;
  const bFavorite = b.favorite ? 1 : 0;
  if (aFavorite !== bFavorite) return bFavorite - aFavorite;
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function withAuthorBookmarks(items: MediaItem[]) {
  if (items.length < 8) return items;

  const output: Array<MediaItem | { bookmark: true; label: string; index: number }> = [];
  let lastBookmarkAt = -8;

  items.forEach((item, index) => {
    const nextLabel = item.creatorSortLabel ?? (item.creatorGroup ?? item.creator).slice(0, 1);
    const shouldPlaceBookmark =
      index > 0 && index - lastBookmarkAt >= 5 && (item.favorite || index % 7 === 0);

    if (shouldPlaceBookmark) {
      lastBookmarkAt = index;
      output.push({ bookmark: true, label: nextLabel, index });
    }
    output.push(item);
  });

  return output;
}
