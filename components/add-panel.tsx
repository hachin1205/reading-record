"use client";

import { subtypeLabel, subtypeValue } from "@/lib/subtypes";
import { KindInput } from "./kind-input";
import { PlanBuilder } from "./plan-builder";
import { DefaultCover } from "./default-cover";
import { findDuplicate } from "@/lib/duplicates";
import { formatTagline, splitTagInput } from "@/lib/tags";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { MediaItem, MediaStatus } from "@/lib/sample-data";
import { cn } from "@/lib/utils";
import { kindLabel } from "./journal-view";
import { apiFetch } from "@/lib/client-api";

type AddKind = "book" | "video" | "drama" | "game" | "note" | "plan";

const kinds: Array<{ id: AddKind; label: string }> = [
  { id: "plan", label: "✦ Plan" },
  { id: "book", label: "Book" },
  { id: "video", label: "Anime / Film" },
  { id: "drama", label: "J/K-drama" },
  { id: "game", label: "Game" },
  { id: "note", label: "Note" },
];

const searchEndpoint: Record<Exclude<AddKind, "note" | "plan">, string> = {
  book: "books",
  video: "anime",
  drama: "dramas",
  game: "games",
};

const statuses: Array<{ id: MediaStatus; label: string }> = [
  { id: "in_progress", label: "In progress" },
  { id: "finished", label: "Finished" },
  { id: "planned", label: "Up next" },
];

const palettes: Array<[string, string]> = [
  ["#7f302c", "#d8a46f"],
  ["#243f5a", "#91b7b3"],
  ["#394d35", "#d1bf73"],
  ["#4d3556", "#c6a1b8"],
  ["#28303c", "#a9a18f"],
  ["#6d4930", "#d8bd88"],
];

function paletteFor(text: string): [string, string] {
  const seed = text.split("").reduce((total, ch) => total + (ch.codePointAt(0) ?? 0), 0);
  return palettes[seed % palettes.length];
}

export function AddPanel({
  open,
  onClose,
  onAdded,
  existing = [],
  onOpenExisting,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (item: MediaItem) => void;
  existing?: MediaItem[];
  onOpenExisting?: (item: MediaItem) => void;
}) {
  const [kind, setKind] = useState<AddKind>("book");
  // Dramas are stored as video records (subtype j_drama / k_drama).
  const mediaType: MediaItem["type"] = kind === "drama" || kind === "video" ? "video" : kind === "note" || kind === "plan" ? "writing" : kind;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MediaItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [picked, setPicked] = useState<MediaItem | null>(null);
  const [manual, setManual] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualCreator, setManualCreator] = useState("");
  // Kind / subcategory: a suggestion or anything typed (Paper, Lecture, Textbook…).
  const [kindInput, setKindInput] = useState("");
  const [status, setStatus] = useState<MediaStatus>("in_progress");
  const [rating, setRating] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteTags, setNoteTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function reset() {
    setNoteTags("");
    setQuery("");
    setResults([]);
    setPicked(null);
    setManual(false);
    setManualTitle("");
    setManualCreator("");
    setKindInput("");
    setStatus("in_progress");
    setRating("");
    setNoteTitle("");
    setNoteBody("");
    setSaveError(null);
    setSearchError(null);
  }

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Live search against the same catalogs the Admin page uses.
  useEffect(() => {
    if (kind === "note" || kind === "plan" || manual || picked || query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const response = await apiFetch(
          `/api/search/${searchEndpoint[kind]}?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal },
        );
        const payload = (await response.json()) as { data?: MediaItem[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Search failed");
        setResults((payload.data ?? []).slice(0, 8));
      } catch (error) {
        if (controller.signal.aborted) return;
        setSearchError(error instanceof Error ? error.message : "Search failed");
        setResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [kind, query, manual, picked]);

  // Block adding something that's already in the library.
  const mediaCandidate =
    kind === "note"
      ? { type: "writing" as const, title: noteTitle.trim() }
      : picked
        ? { ...picked, type: mediaType }
        : manual
          ? { type: mediaType, title: manualTitle.trim() }
          : null;
  const duplicate = mediaCandidate?.title ? findDuplicate(existing, mediaCandidate) : null;

  async function postJson<T>(url: string, body: unknown): Promise<T> {
    const response = await apiFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as { data?: T; error?: string };
    if (!response.ok || !payload.data) {
      throw new Error(
        response.status === 401 || payload.error === "Unauthorized"
          ? "Please sign in on the Admin page to add records."
          : payload.error ?? "Could not save",
      );
    }
    return payload.data;
  }

  async function saveMedia() {
    if (kind === "note") return;
    const now = new Date().toISOString();
    const base: Partial<MediaItem> = picked
      ? { ...picked }
      : {
          type: mediaType,
          title: manualTitle.trim(),
          creator: manualCreator.trim() || "Unknown",
          coverTone: paletteFor(manualTitle),
          platformFamily: kind === "game" ? "pc" : undefined,
          subtype: kind === "video" ? "anime" : kind === "drama" ? "j_drama" : undefined,
        };
    if (!base.title) {
      setSaveError("Add a title first.");
      return;
    }
    if (duplicate) {
      setSaveError(`“${duplicate.title}” is already in your library.`);
      return;
    }
    const ratingValue = Number(rating);
    const record = {
      ...base,
      type: mediaType,
      subtype: subtypeValue(kindInput) ?? base.subtype,
      status,
      updatedAt: now,
      finishedAt: status === "finished" ? now : undefined,
      progressPercent: status === "finished" ? 100 : status === "in_progress" ? 0 : undefined,
      completionCount: status === "finished" ? 1 : undefined,
      rating: rating && Number.isFinite(ratingValue) ? Math.max(0, Math.min(5, ratingValue)) : undefined,
      coverTone: base.coverTone ?? paletteFor(base.title),
    };
    setSaving(true);
    setSaveError(null);
    try {
      const created = await postJson<MediaItem>("/api/media", record);
      onAdded(created);
      reset();
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function saveNote() {
    const title = noteTitle.trim();
    const body = noteBody.trim();
    if (!title || !body) {
      setSaveError("A note needs a title and some text.");
      return;
    }
    if (duplicate) {
      setSaveError(`You already have a piece called “${duplicate.title}”.`);
      return;
    }
    const now = new Date().toISOString();
    setSaving(true);
    setSaveError(null);
    try {
      const created = await postJson<MediaItem>("/api/media", {
        type: "writing",
        subtype: "note",
        title,
        creator: "Huaqing",
        status: "finished",
        ...(splitTagInput(noteTags).length ? { note: formatTagline("", splitTagInput(noteTags)) } : {}),
        publishedAt: now,
        updatedAt: now,
        coverTone: paletteFor(title),
      });
      await postJson("/api/notes", { contentId: created.id, kind: "thought", title, body });
      onAdded(created);
      reset();
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  const canSaveMedia = Boolean(picked) || (manual && manualTitle.trim().length > 0);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[110] overflow-y-auto bg-paper/70 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label="Add to the record"
            className="relative mx-auto min-h-full w-full max-w-[40rem] bg-paper px-5 pb-16 pt-6 text-ink shadow-[0_30px_80px_rgba(0,0,0,0.12)] sm:my-10 sm:min-h-0 sm:rounded-[6px] sm:border sm:border-line sm:px-10 sm:pt-8"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22, ease: [0.22, 0.72, 0.2, 1] }}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-[30px] font-normal tracking-[-0.01em]">Add to the record</h2>
              <button
                type="button"
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-full text-muted transition-colors hover:text-ink"
                onClick={onClose}
              >
                <X size={18} />
              </button>
            </div>

            <nav className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-[15px]" aria-label="What are you adding">
              {kinds.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  aria-pressed={kind === entry.id}
                  className={cn(
                    "underline-offset-[6px] transition-colors",
                    entry.id === "plan"
                      ? cn(
                          "-my-1 mr-1 rounded-full px-3 py-1 font-medium",
                          kind === "plan" ? "bg-accent text-paper" : "bg-accent/10 text-accent hover:bg-accent/20",
                        )
                      : kind === entry.id
                        ? "text-ink underline decoration-accent decoration-2"
                        : "text-muted hover:text-ink",
                  )}
                  onClick={() => {
                    setKind(entry.id);
                    setPicked(null);
                    setResults([]);
                    setManual(false);
                    setSaveError(null);
                  }}
                >
                  {entry.label}
                </button>
              ))}
            </nav>

            {kind === "plan" ? (
              <PlanBuilder
                existing={existing}
                onSaved={(saved) => {
                  saved.forEach((item) => onAdded(item));
                  reset();
                  onClose();
                }}
              />
            ) : (
            <>
            {kind === "note" ? (
              <div className="mt-8 grid gap-5">
                <label className="grid gap-1.5">
                  <span className="text-sm text-muted">Title</span>
                  <input
                    value={noteTitle}
                    onChange={(event) => setNoteTitle(event.target.value)}
                    className="h-11 border-0 border-b border-line bg-transparent font-serif text-xl outline-none focus:border-ink"
                    placeholder="What is this note about?"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm text-muted">Note</span>
                  <textarea
                    value={noteBody}
                    onChange={(event) => setNoteBody(event.target.value)}
                    rows={10}
                    className="resize-y rounded-[4px] border border-line bg-panel p-3 font-serif text-[17px] leading-7 outline-none focus:border-ink"
                    placeholder="Write freely…"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm text-muted">Tags</span>
                  <input
                    value={noteTags}
                    onChange={(event) => setNoteTags(event.target.value)}
                    className="h-10 border-0 border-b border-line bg-transparent text-[15px] outline-none placeholder:text-muted/60 focus:border-ink"
                    placeholder="吐槽 評論 — separate with spaces"
                  />
                </label>
                <p className="text-sm text-muted">Saved under Writing as a Note.</p>
              </div>
            ) : (
              <div className="mt-8">
                {picked ? (
                  <div className="flex items-center gap-4 border-y border-line py-4">
                    <Thumb item={picked} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-serif text-xl">{picked.title}</p>
                      <p className="truncate text-sm text-muted">
                        {picked.creator} · {kindLabel(picked)}
                      </p>
                    </div>
                    <button type="button" className="text-sm text-muted hover:text-ink" onClick={() => setPicked(null)}>
                      Change
                    </button>
                  </div>
                ) : null}
                {picked ? (
                  <KindInput type={mediaType} value={kindInput} onChange={setKindInput} className="mt-4" />
                ) : manual ? (
                  <div className="grid gap-5">
                    <label className="grid gap-1.5">
                      <span className="text-sm text-muted">Title</span>
                      <input
                        value={manualTitle}
                        onChange={(event) => setManualTitle(event.target.value)}
                        className="h-11 border-0 border-b border-line bg-transparent font-serif text-xl outline-none focus:border-ink"
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="text-sm text-muted">{kind === "book" ? "Author" : kind === "game" ? "Studio" : kind === "drama" ? "TV network" : "Studio / director"}</span>
                      <input
                        value={manualCreator}
                        onChange={(event) => setManualCreator(event.target.value)}
                        className="h-10 border-0 border-b border-line bg-transparent text-[15px] outline-none focus:border-ink"
                      />
                    </label>
                    <KindInput type={mediaType} value={kindInput} onChange={setKindInput} inputClassName="h-10 text-[15px]" />
                    <button type="button" className="justify-self-start text-sm text-muted hover:text-ink" onClick={() => setManual(false)}>
                      ← Back to search
                    </button>
                  </div>
                ) : (
                  <>
                    <label className="relative flex items-center">
                      <span className="sr-only">Search</span>
                      <Search size={16} className="pointer-events-none absolute left-0 text-muted" />
                      <input
                        autoFocus
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={kind === "book" ? "Search by title, author or ISBN" : kind === "drama" ? "Japanese, Korean or English title" : "Search by title"}
                        className="h-11 w-full border-0 border-b border-line bg-transparent pl-7 text-[17px] outline-none placeholder:text-muted focus:border-ink [&::-webkit-search-cancel-button]:hidden"
                      />
                    </label>
                    <div className="mt-2 min-h-[2rem]">
                      {searching ? <p className="py-3 text-sm text-muted">Searching…</p> : null}
                      {searchError ? <p className="py-3 text-sm text-muted">{searchError}</p> : null}
                      <ul>
                        {results.map((result) => (
                          <li key={result.id}>
                            <button
                              type="button"
                              className="group flex w-full items-center gap-4 border-b border-line/60 py-3 text-left"
                              onClick={() => {
                                // Already in the library: go straight to it instead of adding a copy.
                                const existingItem = findDuplicate(existing, { ...result, type: result.type });
                                if (existingItem && onOpenExisting) {
                                  onOpenExisting(existingItem);
                                  reset();
                                  onClose();
                                  return;
                                }
                                setPicked(result);
                                setKindInput(subtypeLabel(result.subtype));
                              }}
                            >
                              <Thumb item={result} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-serif text-[17px] group-hover:underline">{result.title}</span>
                                {findDuplicate(existing, { ...result, type: result.type }) ? (
                                  <span className="mt-0.5 inline-block rounded-full bg-ink/[0.07] px-2 py-px text-[11px] text-muted">
                                    Already on your shelf · open it
                                  </span>
                                ) : null}
                                <span className="block truncate text-sm text-muted">
                                  {result.creator}
                                  {result.sourceName ? ` · ${result.sourceName}` : ""}
                                </span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <button
                      type="button"
                      className="mt-3 text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
                      onClick={() => {
                        setManual(true);
                        setManualTitle(query);
                      }}
                    >
                      Can&rsquo;t find it? Add it by hand
                    </button>
                  </>
                )}

                {canSaveMedia ? (
                  <div className="mt-8 grid gap-5">
                    <div>
                      <p className="text-sm text-muted">Status</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {statuses.map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            aria-pressed={status === entry.id}
                            className={cn(
                              "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                              status === entry.id ? "border-ink bg-ink text-paper" : "border-line text-muted hover:text-ink",
                            )}
                            onClick={() => setStatus(entry.id)}
                          >
                            {entry.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {status === "finished" ? (
                      <label className="grid max-w-[10rem] gap-1.5">
                        <span className="text-sm text-muted">Rating (0–5, optional)</span>
                        <input
                          inputMode="decimal"
                          value={rating}
                          onChange={(event) => setRating(event.target.value)}
                          className="h-10 border-0 border-b border-line bg-transparent text-[15px] outline-none focus:border-ink"
                          placeholder="4.5"
                        />
                      </label>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}

            {duplicate ? (
              <div className="mt-6 flex items-center justify-between gap-3 rounded-[6px] border border-line bg-panel px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="text-ink">Already in your library</span>
                  <span className="text-muted"> — “{duplicate.title}”</span>
                </span>
                {onOpenExisting ? (
                  <button
                    type="button"
                    className="shrink-0 font-medium text-accent underline-offset-4 hover:underline"
                    onClick={() => {
                      onOpenExisting(duplicate);
                      reset();
                      onClose();
                    }}
                  >
                    Open it
                  </button>
                ) : null}
              </div>
            ) : null}
            {saveError ? <p className="mt-6 text-sm text-accent">{saveError}</p> : null}

            <div className="mt-8 flex justify-end">
              <button
                type="button"
                disabled={saving || Boolean(duplicate) || (kind === "note" ? !noteTitle.trim() || !noteBody.trim() : !canSaveMedia)}
                className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-opacity disabled:opacity-35"
                onClick={() => void (kind === "note" ? saveNote() : saveMedia())}
              >
                {saving ? "Saving…" : kind === "note" ? "Save note" : "Add to library"}
              </button>
            </div>
            </>
            )}
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Thumb({ item }: { item: MediaItem }) {
  return (
    <span
      className="cover-fallback relative block aspect-[2/3] w-10 shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/5"
      style={
        {
          "--fallback-a": item.coverTone?.[0] ?? "#28303c",
          "--fallback-b": item.coverTone?.[1] ?? "#a9a18f",
        } as React.CSSProperties
      }
      aria-hidden="true"
    >
      {item.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className="absolute inset-0 h-full w-full object-cover" referrerPolicy="no-referrer" src={item.coverUrl} />
      ) : (
        <DefaultCover item={item} />
      )}
    </span>
  );
}
