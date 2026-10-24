"use client";

import { activePlanIds, groupPlans, type Plan } from "@/lib/plans";
import { PlanBundle } from "./plan-bundle";
import { recordYears, withViewings } from "@/lib/viewings";
import type { ContentExperience } from "@/lib/types";
import { DefaultCover } from "./default-cover";
import { withLiveProgress } from "@/lib/progress";
import { motion, Reorder } from "framer-motion";
import { Search, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  belongsOnHome,
  belongsInActiveYear,
  isCurrent,
  activeYear,
  mediaItems,
  statusCounts,
  type MediaItem,
} from "@/lib/sample-data";
import { cn } from "@/lib/utils";
import { AuthorBookmark, MediaObject, YearShelfTag } from "./media-object";
import { ContentDetail, type DetailOrigin } from "./content-detail";
import { AddPanel } from "./add-panel";
import { FireBurst } from "./fire-burst";
import { parseTagline } from "@/lib/tags";
import { FilterSelect, YearSelect } from "./year-select";
import { JournalView } from "./journal-view";
import { ThemeToggle } from "./theme-shell";
import { apiFetch } from "@/lib/client-api";

type ViewMode = "journal" | "shelf" | "matrix";

export function HomePage({ initialItems = mediaItems }: { initialItems?: MediaItem[] }) {
  const [items, setItems] = useState(initialItems);
  // Records with an expected finish date move their progress forward on their own; re-check every 15 minutes.
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 15 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);
  // Every finish date per record (rewatches), so a record shows up in each year it was finished.
  const [experiences, setExperiences] = useState<ContentExperience[]>([]);
  const refreshExperiences = useCallback(async () => {
    try {
      const response = await apiFetch("/api/experiences", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { data?: ContentExperience[] };
      if (Array.isArray(payload.data)) setExperiences(payload.data);
    } catch {
      // Without history each record simply sits in its latest year.
    }
  }, []);
  useEffect(() => {
    void refreshExperiences();
  }, [refreshExperiences]);
  const liveItems = useMemo(
    () =>
      withViewings(
        items.filter((item) => item.subtype !== "plan"),
        experiences,
      ).map((item) => withLiveProgress(item, clock)),
    [items, experiences, clock],
  );
  const [viewMode, setViewMode] = useState<ViewMode>("shelf");
  const [activeTheme, setActiveTheme] = useState<MediaItem | null>(null);
  const [themeProgress, setThemeProgress] = useState(0);
  const [expandedFilms, setExpandedFilms] = useState<Record<string, boolean>>({});
  const [canEdit, setCanEdit] = useState(false);
  const [journalFilter, setJournalFilter] = useState<"all" | "writing">("all");
  const [journalYear, setJournalYear] = useState("all");
  const pendingFireId = useRef<string | null>(null);
  const [fire, setFire] = useState<{ id: string; key: number } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<MediaItem | null>(null);
  const [detailOrigin, setDetailOrigin] = useState<DetailOrigin | null>(null);
  // When the library was last changed from this page (add / edit / delete).
  const lastLocalChange = useRef(0);
  // Bumped when something new is added, so filters that would hide it are cleared.
  const [reveal, setReveal] = useState<{ id: string; type: MediaItem["type"]; key: number } | null>(null);

  // The open detail page uses the same enriched record (live progress + every finish date).
  const liveDetailItem = useMemo(() => {
    if (!detailItem) return null;
    return liveItems.find((entry) => entry.id === detailItem.id) ?? withLiveProgress(detailItem, clock);
  }, [detailItem, liveItems, clock]);

  // A plan's own page (for notes about the whole plan) is a hidden record titled with the plan name.
  async function openPlan(plan: Plan, origin: DetailOrigin) {
    const host = items.find((item) => item.subtype === "plan" && item.title === plan.name);
    if (host) {
      openDetail(host, origin);
      return;
    }
    if (!canEdit) return;
    const now = new Date().toISOString();
    try {
      const response = await apiFetch("/api/media", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "writing",
          subtype: "plan",
          title: plan.name,
          creator: "Plan",
          status: "in_progress",
          publishedAt: now,
          updatedAt: now,
          coverTone: plan.items[0]?.coverTone ?? ["#3d4a3f", "#c9c2a8"],
        }),
      });
      const payload = (await response.json()) as { data?: MediaItem };
      if (!response.ok || !payload.data) return;
      const created = payload.data;
      lastLocalChange.current = Date.now();
      setItems((current) => [...current, created]);
      openDetail(created, origin);
    } catch {
      // Leave the shelf as it is if the plan page can't be created right now.
    }
  }

  function openDetail(item: MediaItem, origin: DetailOrigin) {
    setDetailOrigin(origin);
    setDetailItem(item);
  }

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  // A password-reset email can land on the homepage; hand it to the reset page.
  useEffect(() => {
    if (window.location.hash.includes("type=recovery")) {
      window.location.replace(`/reset-password/${window.location.hash}`);
    }
  }, []);

  // Check sign-in on load and again whenever the tab comes back (e.g. after signing in on /admin),
  // so "+ Add" and editing appear without a manual reload.
  useEffect(() => {
    let cancelled = false;
    const check = () => {
      apiFetch("/api/auth/me", { cache: "no-store" })
        .then((response) => {
          if (!cancelled) setCanEdit(response.ok);
        })
        .catch(() => {
          // Keep the current state on a network blip.
        });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    check();
    window.addEventListener("pageshow", check);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", check);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    const refreshLibrary = async () => {
      const startedAt = Date.now();
      try {
        const response = await apiFetch("/api/media", { cache: "no-store" });
        if (!response.ok) return;

        const payload = (await response.json()) as { data?: MediaItem[] };
        // If something was added, edited or deleted while this was loading, the reply is
        // older than what's on screen — keep the on-screen list.
        if (Array.isArray(payload.data) && lastLocalChange.current < startedAt) {
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

  // Watch / read plans: while running they show as one bundle in "Currently Enjoying" (their titles
  // leave the other rows); once every title is done the plan moves to the "Finished plans" shelf.
  const plans = useMemo(() => groupPlans(liveItems), [liveItems]);
  const inActivePlan = useMemo(() => activePlanIds(plans), [plans]);
  const shelfHomeItems = useMemo(
    () => liveItems.filter((item) => !inActivePlan.has(item.id)).filter(belongsOnHome).sort(sortHomeItems),
    [liveItems, inActivePlan],
  );
  const currentItems = useMemo(
    () => shelfHomeItems.filter(isCurrent),
    [shelfHomeItems],
  );
  const shelfItems = useMemo(() => {
    const currentIds = new Set(currentItems.map((item) => item.id));
    const shelfHomeIds = new Set(shelfHomeItems.map((item) => item.id));
    return liveItems
      .filter((item) => !currentIds.has(item.id) && !inActivePlan.has(item.id))
      .filter((item) => item.type === "book" || item.type === "writing" || shelfHomeIds.has(item.id))
      .sort(sortHomeItems);
  }, [currentItems, liveItems, shelfHomeItems, inActivePlan]);
  const matrixItems = useMemo(
    () => liveItems.filter(belongsInActiveYear).sort(sortHomeItems),
    [liveItems],
  );
  const counts = statusCounts(matrixItems);

  return (
    <main className="min-h-screen px-4 sm:px-6">
      <header className="site-header mx-auto w-full max-w-5xl pt-8 sm:pt-12">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 text-[15px]">
          <Link href="/" className="whitespace-nowrap font-serif text-lg font-medium tracking-[-0.01em] text-ink">
            Reading Record
          </Link>
          <nav aria-label="Views" className="flex items-center gap-3.5 text-muted sm:gap-5">
            <ViewButton
              active={viewMode === "journal"}
              label="Journal"
              onClick={() => {
                setJournalFilter("all");
                setJournalYear("all");
                setViewMode("journal");
              }}
            />
            <ViewButton active={viewMode === "shelf"} label="Shelf" onClick={() => setViewMode("shelf")} />
            <ViewButton active={viewMode === "matrix"} label="Covers" onClick={() => setViewMode("matrix")} />
            {canEdit ? (
              <button
                type="button"
                className="whitespace-nowrap rounded-full bg-ink px-3 py-1 text-[14px] font-medium text-paper transition-opacity hover:opacity-85"
                onClick={() => setAddOpen(true)}
              >
                + Add
              </button>
            ) : null}
            <Link
              aria-label="Admin"
              title="Admin"
              className="grid h-8 w-8 place-items-center rounded-full text-muted transition-colors hover:text-ink"
              href="/admin"
            >
              <UserRound size={16} />
            </Link>
            <ThemeToggle />
          </nav>
        </div>

        <div className="mt-16 sm:mt-24">
          <h1 className="max-w-4xl font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.02em] sm:text-[52px] lg:text-[64px]">
            What I&rsquo;ve been <em className="text-accent">reading</em>, watching &amp; playing.
          </h1>
          <p className="mt-5 text-[15px] text-muted">
            {activeYear} so far — {counts.finished} finished, {counts.in_progress} in progress
            {counts.dropped ? `, ${counts.dropped} set aside` : ""}.
          </p>
        </div>
      </header>

      {viewMode === "journal" ? (
        <JournalView
          key={`${journalFilter}-${journalYear}`}
          items={liveItems}
          onOpenDetail={openDetail}
          fire={fire}
          initialFilter={journalFilter}
          initialYear={journalYear}
          reveal={reveal}
        />
      ) : viewMode === "shelf" ? (
        <ShelfView
          currentItems={currentItems}
          shelfItems={shelfItems}
          plans={plans}
          onOpenPlan={openPlan}
          activeThemeId={activeTheme?.id}
          themeProgress={themeProgress}
          onPlayTheme={(item) => {
            setActiveTheme((current) => (current?.id === item.id ? null : item));
          }}
          expandedFilms={expandedFilms}
          onToggleFilmExpand={(id, nextFacing) =>
            setExpandedFilms((current) => ({
              ...current,
              [id]: nextFacing ?? !current[id],
            }))
          }
          onOpenDetail={openDetail}
          fire={fire}
          reveal={reveal}
        />
      ) : (
        <MatrixView
          items={matrixItems.filter((item) => item.type !== "writing")}
          counts={statusCounts(matrixItems.filter((item) => item.type !== "writing"))}
          onOpenDetail={openDetail}
        />
      )}
      {activeTheme ? <HiddenThemePlayer item={activeTheme} /> : null}
      <AddPanel
        open={addOpen}
        onClose={() => setAddOpen(false)}
        existing={items}
        onOpenExisting={(item) => {
          setDetailOrigin(null);
          setDetailItem(item);
        }}
        onAdded={(item) => {
          lastLocalChange.current = Date.now();
          setItems((current) => [item, ...current.filter((entry) => entry.id !== item.id)]);
          setReveal({ id: item.id, type: item.type, key: Date.now() });
          setDetailItem(item);
        }}
      />
      <ContentDetail
        existing={items}
        onItemsSaved={(saved) => {
          lastLocalChange.current = Date.now();
          setItems((current) => {
            const byId = new Map(saved.map((entry) => [entry.id, entry]));
            const kept = current.map((entry) => byId.get(entry.id) ?? entry);
            const added = saved.filter((entry) => !current.some((existingItem) => existingItem.id === entry.id));
            return [...kept, ...added];
          });
        }}
        planItems={liveDetailItem?.subtype === "plan" ? plans.find((plan) => plan.name === liveDetailItem.title)?.items : undefined}
        item={liveDetailItem}
        origin={detailOrigin}
        onClose={() => {
          setDetailItem(null);
          if (pendingFireId.current) {
            const id = pendingFireId.current;
            pendingFireId.current = null;
            // Let the detail page fade out, then set the finished item alight on the shelf.
            window.setTimeout(() => {
              document
                .querySelector(`[data-fire-target="${CSS.escape(id)}"]`)
                ?.scrollIntoView({ block: "center", behavior: "smooth" });
              setFire({ id, key: Date.now() });
              window.setTimeout(() => setFire((current) => (current?.id === id ? null : current)), 2600);
            }, 380);
          }
        }}
        canEdit={canEdit}
        onDeleted={(id) => {
          pendingFireId.current = null;
          lastLocalChange.current = Date.now();
          setItems((current) => current.filter((entry) => entry.id !== id));
        }}
        onUpdated={(updated) => {
          const previous = items.find((entry) => entry.id === updated.id);
          if (updated.status === "finished" && previous?.status !== "finished") pendingFireId.current = updated.id;
          lastLocalChange.current = Date.now();
          setItems((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
          void refreshExperiences();
          setDetailItem(updated);
        }}
      />
    </main>
  );
}

function getDetailOrigin(element: HTMLElement): DetailOrigin {
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

function ViewButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "transition-colors underline-offset-[6px]",
        active ? "text-ink underline decoration-accent decoration-2" : "hover:text-ink",
      )}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

const ORDER_STORAGE_PREFIX = "reading-record:shelf-order:";

function usePersistentOrder(key: string, items: MediaItem[]) {
  const itemKey = items.map((item) => item.id).join("|");
  const [order, setOrder] = useState<string[]>(() => items.map((item) => item.id));

  useEffect(() => {
    let saved: string[] = [];
    try {
      const raw = window.localStorage.getItem(ORDER_STORAGE_PREFIX + key);
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;
      if (Array.isArray(parsed)) saved = parsed.filter((id): id is string => typeof id === "string");
    } catch {
      // Storage can be unavailable (private mode); fall back to the default order.
    }
    setOrder((current) => reconcileOrder(saved.length ? saved : current, items));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, itemKey]);

  const update = (next: string[]) => {
    setOrder(next);
    try {
      window.localStorage.setItem(ORDER_STORAGE_PREFIX + key, JSON.stringify(next));
    } catch {
      // Ignore storage failures; the order still applies for this visit.
    }
  };

  return [order, update] as const;
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
  fire,
  reveal,
  plans = [],
  onOpenPlan,
}: {
  plans?: Plan[];
  onOpenPlan?: (plan: Plan, origin: DetailOrigin) => void;
  fire?: { id: string; key: number } | null;
  reveal?: { id: string; key: number } | null;
  currentItems: MediaItem[];
  shelfItems: MediaItem[];
  activeThemeId?: string;
  themeProgress: number;
  onPlayTheme: (item: MediaItem) => void;
  expandedFilms: Record<string, boolean>;
  onToggleFilmExpand: (id: string, nextFacing?: boolean) => void;
  onOpenDetail: (item: MediaItem, origin: DetailOrigin) => void;
}) {
  const [currentOrder, setCurrentOrder] = usePersistentOrder("current", currentItems);
  const orderedCurrentItems = useMemo(() => {
    const byId = new Map(currentItems.map((item) => [item.id, item]));
    return currentOrder.map((id) => byId.get(id)).filter(Boolean) as MediaItem[];
  }, [currentOrder, currentItems]);

  const initialBooks = useMemo(
    () => shelfItems.filter((item) => item.type === "book").sort(sortBooksForShelf),
    [shelfItems],
  );
  const initialGames = useMemo(
    () => shelfItems.filter((item) => item.type === "game"),
    [shelfItems],
  );
  const [bookOrder, setBookOrder] = usePersistentOrder("books", initialBooks);
  const [gameOrder, setGameOrder] = usePersistentOrder("games", initialGames);
  const [shelfStyle, setShelfStyle] = useState<"flat" | "pixel">("flat");
  // Let the page header follow the shelf style (pixel header in pixel mode).
  useEffect(() => {
    document.documentElement.dataset.shelfStyle = shelfStyle;
    return () => {
      delete document.documentElement.dataset.shelfStyle;
    };
  }, [shelfStyle]);
  useEffect(() => {
    try {
      // Default: pixel on weekends, flat on weekdays. A style you pick only sticks for that day.
      const today = new Date().toDateString();
      const saved = JSON.parse(window.localStorage.getItem("reading-record:shelf-style-day") ?? "null") as { day?: string; style?: "flat" | "pixel" } | null;
      const weekend = [0, 6].includes(new Date().getDay());
      setShelfStyle(saved?.day === today && saved.style ? saved.style : weekend ? "pixel" : "flat");
    } catch {
      // Storage unavailable: stay on the default style.
    }
  }, []);
  function chooseShelfStyle(style: "flat" | "pixel") {
    setShelfStyle(style);
    try {
      window.localStorage.setItem("reading-record:shelf-style-day", JSON.stringify({ day: new Date().toDateString(), style }));
    } catch {
      // Ignore storage failures.
    }
  }
  const books = useMemo(() => {
    const orderIndex = new Map(bookOrder.map((id, index) => [id, index]));
    return [...initialBooks].sort((a, b) => {
      const yearDifference = bookShelfYearNumber(b) - bookShelfYearNumber(a);
      if (yearDifference !== 0) return yearDifference;
      return (orderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (orderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER);
    });
  }, [bookOrder, initialBooks]);
  const shelfYears = useMemo(
    () =>
      [...new Set(shelfItems.filter((item) => item.type !== "writing").flatMap(recordYears))].sort(
        (a, b) => Number(b) - Number(a),
      ),
    [shelfItems],
  );
  const [shelfYear, setShelfYear] = useState("all");
  // A newly added record goes under this year — never leave it hidden behind an older year filter.
  useEffect(() => {
    if (reveal) setShelfYear("all");
  }, [reveal]);
  useEffect(() => {
    if (shelfYear !== "all" && !shelfYears.includes(shelfYear)) setShelfYear("all");
  }, [shelfYear, shelfYears]);
  const writings = useMemo(
    () =>
      shelfItems
        .filter((item) => item.type === "writing")
        .sort(
          (a, b) =>
            new Date(b.publishedAt ?? b.updatedAt).getTime() - new Date(a.publishedAt ?? a.updatedAt).getTime(),
        ),
    [shelfItems],
  );
  const thisYear = String(new Date().getUTCFullYear());
  // Writings filter right on the shelf: click the "Writings" label to pick a year or a tag.
  const [writingFiltersOpen, setWritingFiltersOpen] = useState(false);
  const [writingYear, setWritingYear] = useState(thisYear);
  const [writingTag, setWritingTag] = useState("all");
  const writingYears = useMemo(
    () => [...new Set(writings.map(shelfItemYear))].sort((a, b) => Number(b) - Number(a)),
    [writings],
  );
  const writingTagOptions = useMemo(() => {
    const counts = new Map<string, number>();
    writings
      .filter((item) => writingYear === "all" || shelfItemYear(item) === writingYear)
      .forEach((item) => parseTagline(item.note).tags.forEach((name) => counts.set(name, (counts.get(name) ?? 0) + 1)));
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ value: name, label: `#${name} (${count})` }));
  }, [writings, writingYear]);
  useEffect(() => {
    if (writingTag !== "all" && !writingTagOptions.some((option) => option.value === writingTag)) setWritingTag("all");
  }, [writingTag, writingTagOptions]);
  const shownWritings = useMemo(
    () =>
      writings.filter(
        (item) =>
          (writingYear === "all" || shelfItemYear(item) === writingYear) &&
          (writingTag === "all" || parseTagline(item.note).tags.includes(writingTag)),
      ),
    [writings, writingYear, writingTag],
  );
  const writingSummary = [writingYear === "all" ? "all years" : writingYear, writingTag === "all" ? null : `#${writingTag}`]
    .filter(Boolean)
    .join(" · ");
  const games = useMemo(() => {
    const byId = new Map(initialGames.map((item) => [item.id, item]));
    return gameOrder.map((id) => byId.get(id)).filter(Boolean) as MediaItem[];
  }, [gameOrder, initialGames]);

  return (
    <>
    <div className="shelf-toolbar mx-auto mt-10 flex max-w-5xl items-center justify-end gap-4 text-[14px] text-muted">
      {shelfYears.length > 1 ? (
        <YearSelect label="Filter the shelf by year" years={shelfYears} value={shelfYear} onChange={setShelfYear} className="mr-auto" />
      ) : null}
      <span className="sr-only">Shelf style</span>
      {(["flat", "pixel"] as const).map((style) => (
        <button
          key={style}
          type="button"
          aria-pressed={shelfStyle === style}
          className={cn(
            "underline-offset-[6px] transition-colors",
            shelfStyle === style ? "text-ink underline decoration-accent decoration-2" : "hover:text-ink",
          )}
          onClick={() => chooseShelfStyle(style)}
        >
          {style === "flat" ? "Flat" : "Pixel"}
        </button>
      ))}
    </div>
    <section
      className={cn(
        "bookcase-frame relative mx-auto mt-3 max-w-5xl space-y-6 rounded-[12px] px-3 py-5 sm:px-4 lg:px-5",
        shelfStyle === "pixel" && "pixel-shelf",
      )}
    >
      <ShelfRow
        title="Currently Enjoying"
        items={orderedCurrentItems}
        leading={plans
          .filter((plan) => !plan.finished)
          .map((plan) => <PlanBundle key={plan.name} plan={plan} onOpenDetail={onOpenDetail} onOpenPlan={onOpenPlan} />)}
        current
        reorderable
        onReorder={setCurrentOrder}
        activeThemeId={activeThemeId}
        themeProgress={themeProgress}
        onPlayTheme={onPlayTheme}
        expandedFilms={expandedFilms}
        onToggleFilmExpand={onToggleFilmExpand}
        onOpenDetail={onOpenDetail}
        fire={fire}
      />
      <ShelfRow
        title="Books"
        year={shelfYear}
        items={books}
        reorderable
        yearGrouped
        onReorder={(ids) => setBookOrder(mergeSubsetOrder(bookOrder, ids))}
        activeThemeId={activeThemeId}
        themeProgress={themeProgress}
        onPlayTheme={onPlayTheme}
        onOpenDetail={onOpenDetail}
        fire={fire}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <ShelfRow
          title="Videos"
          year={shelfYear}
          items={shelfItems.filter((item) => item.type === "video")}
          dense
          activeThemeId={activeThemeId}
          themeProgress={themeProgress}
          onPlayTheme={onPlayTheme}
          expandedFilms={expandedFilms}
          onToggleFilmExpand={onToggleFilmExpand}
          onOpenDetail={onOpenDetail}
          fire={fire}
        />
        <ShelfRow
          title="Games"
          year={shelfYear}
          items={games}
          dense
          activeThemeId={activeThemeId}
          themeProgress={themeProgress}
          stackOverlap
          onReorder={setGameOrder}
          onPlayTheme={onPlayTheme}
          onOpenDetail={onOpenDetail}
          fire={fire}
        />
      </div>
      <ShelfRow
        title="Writings"
        items={shownWritings}
        onTitleClick={() => setWritingFiltersOpen((open) => !open)}
        titleSuffix={`· ${writingSummary} ${writingFiltersOpen ? "▴" : "▾"}`}
        titleHint="Filter writings by year or tag"
        labelExtra={
          writingFiltersOpen ? (
            <span className="flex flex-wrap items-center gap-2">
              <YearSelect label="Writings year" years={writingYears} value={writingYear} onChange={setWritingYear} />
              {writingTagOptions.length ? (
                <FilterSelect label="Writings tag" allLabel="All tags" options={writingTagOptions} value={writingTag} onChange={setWritingTag} />
              ) : null}
              <span className="text-[12px] tabular-nums text-muted">{shownWritings.length}</span>
            </span>
          ) : null
        }
        activeThemeId={activeThemeId} themeProgress={themeProgress} onPlayTheme={onPlayTheme} onOpenDetail={onOpenDetail} fire={fire} />
      {plans.some((plan) => plan.finished) ? (
        <ShelfRow
          title="Finished plans"
          items={[]}
          leading={plans
            .filter((plan) => plan.finished)
            .map((plan) => <PlanBundle key={plan.name} plan={plan} onOpenDetail={onOpenDetail} onOpenPlan={onOpenPlan} />)}
          activeThemeId={activeThemeId}
          themeProgress={themeProgress}
          onPlayTheme={onPlayTheme}
          onOpenDetail={onOpenDetail}
          fire={fire}
        />
      ) : null}
    </section>
    </>
  );
}

function ShelfRow({
  title,
  items: allItems,
  current = false,
  reorderable = false,
  yearGrouped = false,
  onReorder,
  dense = false,
  activeThemeId,
  themeProgress = 0,
  stackOverlap = false,
  onPlayTheme,
  expandedFilms,
  onToggleFilmExpand,
  onOpenDetail,
  fire,
  labelExtra,
  leading,
  year,
  onTitleClick,
  titleSuffix,
  titleHint,
}: {
  fire?: { id: string; key: number } | null;
  labelExtra?: React.ReactNode;
  /** Shown at the start of the shelf before the titles (plan bundles). */
  leading?: React.ReactNode;
  year?: string;
  onTitleClick?: () => void;
  titleSuffix?: string;
  titleHint?: string;
  title: string;
  items: MediaItem[];
  current?: boolean;
  reorderable?: boolean;
  yearGrouped?: boolean;
  onReorder?: (ids: string[]) => void;
  dense?: boolean;
  activeThemeId?: string;
  themeProgress?: number;
  stackOverlap?: boolean;
  onPlayTheme?: (item: MediaItem) => void;
  expandedFilms?: Record<string, boolean>;
  onToggleFilmExpand?: (id: string, nextFacing?: boolean) => void;
  onOpenDetail: (item: MediaItem, origin: DetailOrigin) => void;
}) {
  const items = useMemo(
    () => (!year || year === "all" ? allItems : allItems.filter((item) => recordYears(item).includes(year))),
    [allItems, year],
  );

  const arranged = reorderable && !current
    ? yearGrouped ? withBookShelfMarkers(items) : withAuthorBookmarks(items)
    : items;
  const [objectFacingOverrides, setObjectFacingOverrides] = useState<Record<string, boolean>>({});
  // Phones/tablets: a finger swipe should scroll the shelf, so drag-to-sort and lift-to-flip are
  // only on mouse/trackpad. Tapping still opens a title.
  const touch = useCoarsePointer();
  const canReorder = !touch && Boolean(onReorder) && (reorderable || stackOverlap);
  const pendingTap = useRef<{ id: string; timer: number } | null>(null);
  const suppressClickAfterDrag = useRef(false);
  const [flipArmedId, setFlipArmedId] = useState<string | null>(null);

  function startFlipGesture(event: React.PointerEvent, entry: MediaItem, visualIndex: number) {
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    let armed = false;

    const onMove = (move: PointerEvent) => {
      if (move.pointerId !== pointerId) return;
      const next = isFlipGesture(move.clientX - startX, move.clientY - startY);
      if (next !== armed) {
        armed = next;
        setFlipArmedId(next ? entry.id : null);
      }
    };
    const finish = (end: PointerEvent) => {
      if (end.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      setFlipArmedId(null);
      if (end.type === "pointerup" && isFlipGesture(end.clientX - startX, end.clientY - startY)) {
        suppressClickAfterDrag.current = true;
        toggleObjectPosture(entry, visualIndex);
        window.setTimeout(() => {
          suppressClickAfterDrag.current = false;
        }, 0);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  }
  const ShelfTrack = (canReorder ? Reorder.Group : "div") as React.ElementType;
  const ShelfItem = (canReorder ? Reorder.Item : motion.div) as React.ElementType;

  function toggleObjectPosture(entry: MediaItem, visualIndex: number) {
    if (entry.type === "book" || entry.type === "game") {
      const defaultFacing = entry.type === "book"
        ? entry.favorite || entry.status === "in_progress"
        : visualIndex < 3 || Boolean(entry.favorite);
      setObjectFacingOverrides((current) => ({
        ...current,
        [entry.id]: !(current[entry.id] ?? defaultFacing),
      }));
      return;
    }

    if (entry.type === "video") {
      const facing = isVideoFacing(entry, visualIndex, activeThemeId, expandedFilms);
      onToggleFilmExpand?.(entry.id, !facing);
    }
  }

  return (
    <section>
      {current ? (
        <div className="mb-2 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-[28px] font-medium tracking-[-0.01em]">{title}</h2>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">
              Pinned and in-progress
            </p>
          </div>
        </div>
      ) : null}
      <div
        className={cn(
          "shelf-bay relative rounded-[6px] border border-line px-2 sm:px-3",
          "overflow-hidden",
          current ? "pt-3" : "pt-10",
        )}
      >
        <div
          className={cn(
            "absolute inset-x-3 top-0 rounded-b-sm",
            current ? "h-3 bg-shelf/35" : "h-5 bg-shelf/65",
          )}
        />
        {!current ? (
          <div className="absolute left-5 top-1 z-20 flex items-center gap-2">
            {onTitleClick ? (
              <button
                type="button"
                title={titleHint}
                className="-rotate-[0.6deg] rounded-[2px] border border-line bg-panel px-3 py-1 transition-colors hover:border-ink"
                onClick={onTitleClick}
              >
                <span className="font-serif text-sm font-medium leading-none text-ink">
                  {title}
                  {titleSuffix ? <span className="ml-1.5 text-muted">{titleSuffix}</span> : null}
                </span>
              </button>
            ) : (
              <div className="-rotate-[0.6deg] rounded-[2px] border border-line bg-panel px-3 py-1">
                <span className="font-serif text-sm font-medium leading-none text-ink">
                  {title}
                </span>
              </div>
            )}
            {labelExtra}
          </div>
        ) : null}
        <ShelfTrack
          {...(canReorder
            ? {
                as: "div" as const,
                axis: "x" as const,
                values: items,
                onReorder: (next: MediaItem[]) => {
                  // Books stay inside their own year section on the shelf.
                  if (yearGrouped && next.some((item, index) =>
                    index > 0 && bookShelfYearNumber(item) > bookShelfYearNumber(next[index - 1]))) {
                    return;
                  }
                  onReorder?.(mergeSubsetOrder(allItems.map((item) => item.id), next.map((item) => item.id)));
                },
              }
            : {})}
          className={cn(
            "shelf-scroll relative z-10 -mt-16 flex items-end gap-0.5 overflow-x-auto pt-16",
            current ? "min-h-[128px] pb-5" : dense ? "min-h-[148px] pb-6" : "min-h-[178px] pb-7",
          )}
        >
          {leading}
          {arranged.map((entry, visualIndex) =>
            "yearTag" in entry ? (
              <YearShelfTag key={`year-${entry.label}-${entry.index}`} label={entry.label} />
            ) : "bookmark" in entry ? (
              <AuthorBookmark key={`bookmark-${entry.label}-${entry.index}`} label={entry.label} />
            ) : (
            <ShelfItem
              key={entry.id}
              {...(canReorder ? { value: entry, as: "div" as const } : {})}
              className={cn(
                "group relative shrink-0 origin-bottom-right border-0 bg-transparent p-0 text-left",
                canReorder ? "cursor-grab touch-pan-y active:cursor-grabbing" : "cursor-pointer",
                // no double-tap zoom on phones, so a double tap can flip the cover
                touch && "touch-manipulation",
              )}
              role="button"
              tabIndex={0}
              aria-label={"Open details for " + entry.title}
              data-fire-target={entry.id}
              onPointerDown={(event: React.PointerEvent<HTMLDivElement>) => {
                if (!touch && entry.type !== "writing" && event.button === 0) startFlipGesture(event, entry, visualIndex);
              }}
              onClick={(event: React.MouseEvent<HTMLDivElement>) => {
                if (suppressClickAfterDrag.current) return;
                const origin = getDetailOrigin(event.currentTarget);
                // Touch screens: one tap opens the title, a quick second tap opens/closes the cover instead.
                if (touch && entry.type !== "writing") {
                  const pending = pendingTap.current;
                  if (pending && pending.id === entry.id) {
                    window.clearTimeout(pending.timer);
                    pendingTap.current = null;
                    toggleObjectPosture(entry, visualIndex);
                    return;
                  }
                  if (pending) window.clearTimeout(pending.timer);
                  pendingTap.current = {
                    id: entry.id,
                    timer: window.setTimeout(() => {
                      pendingTap.current = null;
                      onOpenDetail(entry, origin);
                    }, 280),
                  };
                  return;
                }
                onOpenDetail(entry, origin);
              }}
              onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.currentTarget.click();
                }
              }}
              whileHover={{ y: -3 }}
              {...(!touch && (canReorder || entry.type !== "writing")
                ? {
                    ...(canReorder ? { layout: "position" as const, drag: true } : { drag: "y" as const, dragSnapToOrigin: true }),
                    dragConstraints: { top: -FLIP_LIFT_LIMIT, bottom: 0 },
                    dragElastic: { top: 0.15, bottom: 0.02, left: 0.5, right: 0.5 },
                    whileDrag: {
                      scale: 1.03,
                      rotate: 0,
                      zIndex: 50,
                    },
                    onDragStart: () => {
                      suppressClickAfterDrag.current = true;
                    },
                    onDragEnd: () => {
                      window.setTimeout(() => {
                        suppressClickAfterDrag.current = false;
                      }, 0);
                    },
                  }
                : {})}
              transition={{ type: "spring", stiffness: 520, damping: 40, mass: 0.7 }}
            >
              <MediaObject
                item={entry}
                compact={current}
                playing={entry.id === activeThemeId}
                progress={entry.id === activeThemeId ? themeProgress : 0}
                shelfIndex={visualIndex}
                expanded={Boolean(expandedFilms?.[entry.id])}
                bookFacing={
                  entry.type === "book"
                    ? (objectFacingOverrides[entry.id] ??
                      (entry.favorite || entry.status === "in_progress"))
                    : undefined
                }
                videoFacing={
                  entry.type === "video"
                    ? isVideoFacing(entry, visualIndex, activeThemeId, expandedFilms)
                    : undefined
                }
                gameFacing={
                  entry.type === "game"
                    ? (objectFacingOverrides[entry.id] ??
                      (visualIndex < 3 || Boolean(entry.favorite)))
                    : undefined
                }
                onPlay={
                  entry.type === "video" && entry.themeYoutubeId
                    ? () => {
                        if (!isVideoFacing(entry, visualIndex, activeThemeId, expandedFilms)) {
                          onToggleFilmExpand?.(entry.id, true);
                        }
                        onPlayTheme?.(entry);
                      }
                    : undefined
                }
              />
              {fire?.id === entry.id ? <FireBurst key={fire.key} seed={fire.key % 997} height={150} /> : null}
              {flipArmedId === entry.id ? (
                <span className="pointer-events-none absolute -top-6 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-2 py-0.5 text-[10px] font-medium text-paper shadow-sm">
                  Release to flip
                </span>
              ) : null}
            </ShelfItem>
            )
          )}
        </ShelfTrack>
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

// Lifting an item straight up off the shelf flips it between cover and spine.
const FLIP_LIFT_LIMIT = 70;
const FLIP_LIFT_THRESHOLD = 34;

function isFlipGesture(dx: number, dy: number) {
  return dy < -FLIP_LIFT_THRESHOLD && Math.abs(dy) > Math.abs(dx) * 1.2;
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
  onOpenDetail: (item: MediaItem, origin: DetailOrigin) => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    if (!normalizedQuery) return true;
    return `${item.title} ${item.creator} ${item.type} ${item.subtype ?? ""}`
      .toLowerCase()
      .includes(normalizedQuery);
  });
  return (
    <section className="mx-auto mt-12 w-full max-w-5xl pb-24">
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-serif text-[28px] font-medium tracking-[-0.01em]">{activeYear}</h2>
          <p className="mt-2 text-sm text-muted">
            {counts.finished} completed · {counts.in_progress} in progress · {counts.dropped}{" "}
            dropped · {counts.planned} planned
          </p>
        </div>
        <label className="relative block w-full sm:w-72">
          <span className="sr-only">Search records</span>
          <Search
            className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-muted"
            size={16}
          />
          <input
            className="h-9 w-full border-0 border-b border-line bg-transparent pl-6 pr-8 text-[15px] outline-none transition-colors placeholder:text-muted focus:border-ink [&::-webkit-search-cancel-button]:hidden"
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

      <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
        {filteredItems.map((item) => (
          <button
            key={item.id}
            aria-label={`Open ${item.title}`}
            className="group grid aspect-[2/3] place-items-center overflow-hidden rounded-[2px] shadow-[0_1px_2px_rgba(0,0,0,0.08),0_6px_14px_-8px_rgba(0,0,0,0.3)] transition-transform duration-200 hover:-translate-y-1"
            title={item.title}
            type="button"
            onClick={(event) => onOpenDetail(item, getDetailOrigin(event.currentTarget))}
          >
            <div
              className="cover-fallback relative h-full w-full overflow-hidden"
              style={
                {
                  "--fallback-a": item.coverTone[0],
                  "--fallback-b": item.coverTone[1],
                } as React.CSSProperties
              }
            >
              {item.coverUrl ? (
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
              <span className="sr-only">{item.title}</span>
            </div>
          </button>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        <div className="py-14 text-center">
          <p className="font-serif text-xl italic text-muted">No matching records</p>
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

function isVideoFacing(
  entry: MediaItem,
  visualIndex: number,
  activeThemeId?: string,
  expandedFilms?: Record<string, boolean>,
) {
  if (entry.type !== "video") return false;
  if (entry.id === activeThemeId) return true;
  if (expandedFilms && Object.prototype.hasOwnProperty.call(expandedFilms, entry.id)) {
    return expandedFilms[entry.id];
  }
  return visualIndex < 3 || Boolean(entry.favorite);
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

function sortBooksForShelf(a: MediaItem, b: MediaItem) {
  const yearDifference = bookShelfYearNumber(b) - bookShelfYearNumber(a);
  if (yearDifference !== 0) return yearDifference;
  const aCreator = a.creatorSortLabel ?? a.creatorGroup ?? a.creator;
  const bCreator = b.creatorSortLabel ?? b.creatorGroup ?? b.creator;
  return aCreator.localeCompare(bCreator, undefined, { sensitivity: "base" });
}

function shelfItemYear(item: MediaItem) {
  const year = new Date(item.finishedAt ?? item.publishedAt ?? item.updatedAt).getUTCFullYear();
  return Number.isFinite(year) ? String(year) : "Undated";
}


function bookShelfYear(item: MediaItem) {
  const year = bookShelfYearNumber(item);
  return year > 0 ? String(year) : "Undated";
}

function bookShelfYearNumber(item: MediaItem) {
  const value = item.finishedAt ?? item.updatedAt;
  const year = new Date(value).getUTCFullYear();
  return Number.isFinite(year) ? year : 0;
}


// Reordering inside a filtered view: put the visible items back in their new order
// without disturbing where the hidden ones sit.
function mergeSubsetOrder(fullOrder: string[], subsetOrder: string[]) {
  const subset = new Set(subsetOrder);
  let next = 0;
  const merged = fullOrder.map((id) => (subset.has(id) ? subsetOrder[next++] : id));
  return [...merged, ...subsetOrder.slice(next)];
}

function reconcileOrder(order: string[], items: MediaItem[]) {
  const available = new Set(items.map((item) => item.id));
  const retained = order.filter((id) => available.has(id));
  const retainedSet = new Set(retained);
  // Anything not in the saved order is new (just added), so it goes to the front.
  return [...items.map((item) => item.id).filter((id) => !retainedSet.has(id)), ...retained];
}

type ShelfEntry =
  | MediaItem
  | { bookmark: true; label: string; index: number }
  | { yearTag: true; label: string; index: number };

function withBookShelfMarkers(items: MediaItem[]): ShelfEntry[] {
  const output: ShelfEntry[] = [];
  let previousYear = "";
  let lastBookmarkAt = -8;

  items.forEach((item, index) => {
    const year = bookShelfYear(item);
    if (year !== previousYear) {
      output.push({ yearTag: true, label: year, index });
      previousYear = year;
      lastBookmarkAt = index - 8;
    }

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

/** True on touch-first devices (phones, tablets). */
function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarse(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return coarse;
}
