"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { findDuplicate } from "@/lib/duplicates";
import type { MediaItem } from "@/lib/sample-data";
import { formatTagline, parseTagline } from "@/lib/tags";
import { cn } from "@/lib/utils";
import { DefaultCover } from "./default-cover";
import { KindInput } from "./kind-input";
import { subtypeValue } from "@/lib/subtypes";
import { apiFetch } from "@/lib/client-api";

const sources = [
  { id: "books", label: "Book" },
  { id: "anime", label: "Anime" },
  { id: "dramas", label: "J/K-drama" },
  { id: "films", label: "Film / TV" },
  { id: "games", label: "Game" },
  { id: "manual", label: "+ By hand" },
] as const;

const handTones: Array<[string, string]> = [
  ["#3d4a3f", "#c9c2a8"],
  ["#43405a", "#bfb6d6"],
  ["#5a4636", "#d9c2a3"],
];

/**
 * A watch / read plan: several titles started together as one project. Each title is saved
 * (or, if already in the library, re-used) with a shared "#plan:Name" tag.
 */
export function PlanBuilder({
  existing,
  onSaved,
  fixedName,
}: {
  existing: MediaItem[];
  onSaved: (items: MediaItem[]) => void;
  /** Adding to an existing plan: no name field, the button says "Add to plan". */
  fixedName?: string;
}) {
  const [name, setName] = useState(fixedName ?? "");
  const [source, setSource] = useState<(typeof sources)[number]["id"]>("anime");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MediaItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<MediaItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Anything the catalogs don't have — an essay, a paper, a lecture — typed in by hand.
  const [handTitle, setHandTitle] = useState("");
  const [handCreator, setHandCreator] = useState("");
  const [handKind, setHandKind] = useState("Paper");
  const handCount = useRef(0);

  function addByHand() {
    const title = handTitle.trim();
    if (!title) return;
    const kindValue = subtypeValue(handKind);
    const watch = ["Film", "Lecture", "Talk", "Documentary", "Series"].includes(handKind.trim());
    add({
      id: `hand-${(handCount.current += 1)}-${handTitle.length}`,
      type: watch ? "video" : "book",
      subtype: kindValue,
      title,
      creator: handCreator.trim() || "Unknown",
      status: "planned",
      updatedAt: new Date().toISOString(),
      coverTone: handTones[picked.length % handTones.length],
    });
    setHandTitle("");
    setHandCreator("");
  }

  useEffect(() => {
    const q = query.trim();
    if (source === "manual" || q.length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await apiFetch(`/api/search/${source}?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const payload = (await response.json()) as { data?: MediaItem[] };
        setResults((payload.data ?? []).slice(0, 8));
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, source]);

  function add(item: MediaItem) {
    // Already in the library → use that record instead of a copy.
    const own = findDuplicate(existing, item) ?? item;
    setPicked((list) => (list.some((entry) => entry.id === own.id) ? list : [...list, own]));
  }

  async function save() {
    const plan = name.trim();
    if (!plan || !picked.length) return;
    setSaving(true);
    setError(null);
    try {
      const saved: MediaItem[] = [];
      for (const item of picked) {
        const isOwn = existing.some((entry) => entry.id === item.id);
        const current = parseTagline(item.note);
        const note = formatTagline(current.text, current.tags, plan);
        const response = await apiFetch(isOwn ? `/api/media/${encodeURIComponent(item.id)}` : "/api/media", {
          method: isOwn ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            isOwn
              ? { note }
              : { ...item, id: undefined, status: "planned", note, updatedAt: new Date().toISOString() },
          ),
        });
        const payload = (await response.json()) as { data?: MediaItem; error?: string };
        if (response.status === 401) {
          throw new Error("You've been signed out. Sign in again (the person icon at the top), then press Start plan again — your picks are kept.");
        }
        if (!response.ok || !payload.data) throw new Error(payload.error ?? `Couldn't save “${item.title}”`);
        saved.push(payload.data);
        const savedId = item.id;
        setPicked((list) => list.filter((entry) => entry.id !== savedId));
      }
      onSaved(saved);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't save the plan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn("grid gap-5", fixedName ? "mt-3" : "mt-8")}>
      <label className={cn("grid gap-1.5", fixedName && "hidden")}>
        <span className="text-sm text-muted">Plan name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Ghibli marathon, 村上春樹の冬"
          className="h-11 border-0 border-b border-line bg-transparent font-serif text-xl outline-none focus:border-ink"
        />
      </label>

      {picked.length ? (
        <ul className="flex flex-wrap gap-2" aria-label="In this plan">
          {picked.map((item) => (
            <li key={item.id} className="inline-flex items-center gap-1.5 rounded-full border border-line py-0.5 pl-2.5 pr-1 text-[13px]">
              <span className="max-w-[12rem] truncate">{item.title}</span>
              <button
                type="button"
                aria-label={`Remove ${item.title}`}
                className="grid h-5 w-5 place-items-center rounded-full text-muted hover:bg-ink/10 hover:text-ink"
                onClick={() => setPicked((list) => list.filter((entry) => entry.id !== item.id))}
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Search and pick titles — books, anime, dramas, films or games can be mixed.</p>
      )}

      <div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Search in">
          {sources.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-pressed={source === entry.id}
              className={cn(
                "rounded-full border px-3 py-1 text-[12.5px] transition-colors",
                source === entry.id ? "border-ink text-ink" : "border-line text-muted hover:text-ink",
              )}
              onClick={() => setSource(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
        {source === "manual" ? (
          <div className="mt-3 grid gap-3 rounded-[8px] border border-line p-3">
            <label className="block">
              <span className="text-[12px] text-muted">Title</span>
              <input
                value={handTitle}
                onChange={(event) => setHandTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    addByHand();
                  }
                }}
                placeholder="e.g. 「身体の現象学」第3章, an article, a lecture"
                className="mt-0.5 h-9 w-full border-0 border-b border-line bg-transparent text-[15px] outline-none placeholder:text-muted/60 focus:border-ink"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[12px] text-muted">Author / speaker</span>
                <input
                  value={handCreator}
                  onChange={(event) => setHandCreator(event.target.value)}
                  className="mt-0.5 h-8 w-full border-0 border-b border-line bg-transparent text-[14px] outline-none focus:border-ink"
                />
              </label>
              <KindInput type="book" value={handKind} onChange={setHandKind} />
            </div>
            <button
              type="button"
              disabled={!handTitle.trim()}
              className="justify-self-end rounded-full border border-ink px-3.5 py-1 text-[13px] text-ink disabled:opacity-35"
              onClick={addByHand}
            >
              + Add to plan
            </button>
          </div>
        ) : (
          <>
        <label className="relative mt-3 flex items-center">
          <span className="sr-only">Search titles</span>
          <Search size={16} className="pointer-events-none absolute left-0 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a title to add"
            className="h-10 w-full border-0 border-b border-line bg-transparent pl-7 text-[16px] outline-none placeholder:text-muted focus:border-ink [&::-webkit-search-cancel-button]:hidden"
          />
        </label>
        {searching ? <p className="py-2 text-sm text-muted">Searching…</p> : null}
        <ul className="mt-1 max-h-[18rem] overflow-y-auto">
          {results.map((result) => {
            const chosen = picked.some((entry) => entry.id === (findDuplicate(existing, result)?.id ?? result.id));
            return (
              <li key={result.id}>
                <button
                  type="button"
                  disabled={chosen}
                  className="flex w-full items-center gap-3 border-b border-line/60 py-2.5 text-left disabled:opacity-45"
                  onClick={() => add(result)}
                >
                  <span className="relative block aspect-[2/3] w-9 shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/10">
                    {result.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" className="absolute inset-0 h-full w-full object-cover" referrerPolicy="no-referrer" src={result.coverUrl} />
                    ) : (
                      <DefaultCover item={result} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">{result.title}</span>
                    <span className="block truncate text-[12.5px] text-muted">{result.creator}</span>
                  </span>
                  <span className="shrink-0 text-[12.5px] text-muted">{chosen ? "Added" : "+ Add"}</span>
                </button>
              </li>
            );
          })}
        </ul>
          </>
        )}
      </div>

      {error ? <p className="text-sm text-accent">{error}</p> : null}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving || !name.trim() || !picked.length}
          className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-paper disabled:opacity-35"
          onClick={() => void save()}
        >
          {saving ? "Saving…" : `${fixedName ? "Add to plan" : "Start plan"}${picked.length ? ` · ${picked.length}` : ""}`}
        </button>
      </div>
    </div>
  );
}
