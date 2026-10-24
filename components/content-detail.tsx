"use client";

import { PlanPanel } from "./plan-panel";
import { subtypeLabel, subtypeValue } from "@/lib/subtypes";
import { KindInput } from "./kind-input";
import { DefaultCover } from "./default-cover";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatTagline, parseTagline, splitTagInput } from "@/lib/tags";
import { ClaudeHelper } from "./claude-helper";
import { NoteBody, textLang } from "./note-body";
import { paceLabel } from "@/lib/progress";
import type { ContentExperience, ContentNote, MediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/client-api";

export type DetailOrigin = {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
};

export function ContentDetail({
  item,
  onClose,
  canEdit = false,
  onUpdated,
  onDeleted,
  planItems,
  existing = [],
  onItemsSaved,
}: {
  item: MediaItem | null;
  origin: DetailOrigin | null;
  onClose: () => void;
  canEdit?: boolean;
  onUpdated?: (item: MediaItem) => void;
  onDeleted?: (id: string) => void;
  /** When this is a plan's own page: the titles in the plan. */
  planItems?: MediaItem[];
  existing?: MediaItem[];
  onItemsSaved?: (items: MediaItem[]) => void;
}) {
  const [notes, setNotes] = useState<ContentNote[]>([]);
  const [experiences, setExperiences] = useState<ContentExperience[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fireKey, setFireKey] = useState(0);
  // The note currently open in the writing box is shown there, not in the list below.
  const [draftNoteId, setDraftNoteId] = useState<string | null>(null);
  const handleDraftId = useCallback((id: string | null) => setDraftNoteId(id), []);

  useEffect(() => {
    setFireKey(0);
  }, [item?.id]);

  useEffect(() => {
    if (!item) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setNotes([]);
    setExperiences([]);

    Promise.all([
      apiFetch(`/api/notes?contentId=${encodeURIComponent(item.id)}`, {
        cache: "no-store",
        signal: controller.signal,
      }),
      apiFetch(`/api/experiences?contentId=${encodeURIComponent(item.id)}`, {
        cache: "no-store",
        signal: controller.signal,
      }),
    ])
      .then(async ([notesResponse, experiencesResponse]) => {
        const notesPayload = (await notesResponse.json()) as {
          data?: ContentNote[];
          error?: string;
        };
        const experiencesPayload = (await experiencesResponse.json()) as {
          data?: ContentExperience[];
          error?: string;
        };
        if (!notesResponse.ok) throw new Error(notesPayload.error ?? "Unable to load notes");
        if (!experiencesResponse.ok) {
          throw new Error(experiencesPayload.error ?? "Unable to load reading history");
        }
        setNotes(notesPayload.data ?? []);
        setExperiences(experiencesPayload.data ?? []);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "Unable to load notes");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [item]);

  useEffect(() => {
    if (!item) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [item, onClose]);

  const linkedExperienceIds = new Set(experiences.map((experience) => experience.id));
  const listedNotes = notes.filter((note) => note.id !== draftNoteId);
  const earlierNotes = listedNotes.filter(
    (note) => !note.experienceId || !linkedExperienceIds.has(note.experienceId),
  );
  return (
    <AnimatePresence>
      {item ? (
        <motion.div
          className="fixed inset-0 z-[100] overflow-y-auto bg-paper/70 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.article
            aria-label={`${item.title} details`}
            aria-modal="true"
            role="dialog"
            className="relative mx-auto my-0 min-h-full w-full max-w-[68rem] border-line bg-paper px-5 pb-20 pt-6 text-ink shadow-[0_30px_80px_rgba(0,0,0,0.12)] sm:my-8 sm:min-h-0 sm:rounded-[6px] sm:border sm:px-10 sm:pt-7"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.24, ease: [0.22, 0.72, 0.2, 1] }}
          >
            <div className="flex items-center justify-between text-[15px] text-muted">
              <button type="button" className="transition-colors hover:text-ink" onClick={onClose}>
                &larr; Back
              </button>
              <button
                aria-label="Close details"
                className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:text-ink"
                type="button"
                onClick={onClose}
              >
                <X size={17} />
              </button>
            </div>

            <div className="mt-8 grid gap-10 lg:mt-10 lg:grid-cols-[17rem_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-14 lg:gap-y-0">
              {/* ---- sidebar: what it is, compact controls ---- */}
              <aside className="min-w-0 lg:col-start-1 lg:row-start-1">
                <div className="flex gap-5 lg:block">
                  <div className="relative w-28 shrink-0 sm:w-32 lg:w-40">
                    <AnimatePresence>
                      {fireKey ? (
                        <motion.span
                          key={`finished-${fireKey}`}
                          className="absolute -top-8 left-0 z-50 whitespace-nowrap rounded-full bg-ink px-3 py-1 text-xs font-medium text-paper"
                          initial={{ opacity: 0, y: 8, scale: 0.9 }}
                          animate={{ opacity: [0, 1, 1, 0], y: [8, 0, 0, -6], scale: [0.9, 1, 1, 1] }}
                          transition={{ duration: 2.2, times: [0, 0.15, 0.8, 1] }}
                        >
                          Finished! 🔥
                        </motion.span>
                      ) : null}
                    </AnimatePresence>
                    <div
                      className={cn(
                        "relative w-full overflow-hidden rounded-[3px] ring-1 ring-black/10",
                        item.type === "video" && item.subtype !== "movie" ? "aspect-square" : "aspect-[2/3]",
                      )}
                      style={{ background: `linear-gradient(150deg, ${item.coverTone[0]}, ${item.coverTone[1]})` }}
                    >
                      {item.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt={`${item.title} cover`} className="h-full w-full object-cover" src={item.coverUrl} />
                      ) : (
                        <DefaultCover item={item} />
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 lg:mt-6">
                    <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">
                      {item.type === "writing"
                        ? `${(item.subtype ?? "writing").replace("_", " ")} · ${isDraft(item) ? "draft" : formatDate(item.publishedAt ?? item.finishedAt ?? item.updatedAt)}`
                        : `${(item.subtype ?? item.type).replace("_", " ")} · ${statusLabel(item.status)}`}
                    </p>
                    <h2 className="mt-2 font-serif text-[28px] font-normal leading-[1.12] tracking-[-0.015em] sm:text-[32px]">
                      {item.title}
                    </h2>
                    <p className="mt-2 font-serif text-lg italic text-muted">{item.creator}</p>
                    {item.subtype === "plan" ? null : <FactLine item={item} />}
                  </div>
                </div>


                {(item.type === "writing" ? taglineTextWithoutDraft(parseTagline(item.note).text) : parseTagline(item.note).text) ? (
                  <p className="mt-6 border-l-2 border-accent pl-4 font-serif text-[17px] italic leading-relaxed text-ink/85">
                    {item.type === "writing" ? taglineTextWithoutDraft(parseTagline(item.note).text) : parseTagline(item.note).text}
                  </p>
                ) : null}
                {parseTagline(item.note).tags.length ? (
                  <p className="mt-4 flex flex-wrap gap-1.5" aria-label="Tags">
                    {parseTagline(item.note).tags.map((name) => (
                      <span key={name} className="rounded-full border border-line px-2 py-px text-[12px] leading-5 text-muted">
                        #{name}
                      </span>
                    ))}
                  </p>
                ) : null}

              </aside>

              {/* ---- main: notes ---- */}
              <section className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:border-l lg:border-line lg:pl-14" aria-label="Notes">
                <div className="flex items-baseline justify-between">
                  {item.type === "writing" ? (
                    <h3 className="sr-only">Text</h3>
                  ) : (
                    <>
                      <h3 className="font-serif text-[30px] font-normal tracking-[-0.01em]">Notes</h3>
                      <span className="text-sm tabular-nums text-muted">{notes.length || ""}</span>
                    </>
                  )}
                </div>

                {canEdit ? (
                  <NoteComposer
                    item={item}
                    onSaved={(note) => setNotes((current) => [note, ...current.filter((entry) => entry.id !== note.id)])}
                    onDraftIdChange={handleDraftId}
                  />
                ) : null}

                {loading ? <p className="mt-8 font-serif text-lg italic text-muted">Opening your notes…</p> : null}
                {error ? (
                  <p className="mt-8 text-sm text-muted">Notes couldn&rsquo;t be loaded right now. ({error})</p>
                ) : null}
                {!loading && !error && listedNotes.length === 0 ? (
                  <p className="mt-8 font-serif text-lg italic text-muted">
                    {item.type === "writing"
                      ? canEdit
                        ? "Nothing written yet."
                        : "Nothing here yet."
                      : canEdit
                        ? "Your first note will appear here."
                        : "No notes yet."}
                  </p>
                ) : null}

                <div className="mt-10 grid gap-12">
                  {experiences.map((experience) => {
                    const experienceNotes = listedNotes.filter((note) => note.experienceId === experience.id);
                    if (experienceNotes.length === 0) return null;
                    return (
                      <section key={experience.id}>
                        <p className="mb-6 text-[12px] font-medium uppercase tracking-[0.14em] text-muted">
                          {formatDate(experience.startedAt)} · {statusLabel(experience.status)}
                        </p>
                        <div className="grid gap-12">
                          {experienceNotes.map((note) => <DetailNote key={note.id} note={note} writing={item.type === "writing"} itemTitle={item.title} canEdit={canEdit} onDeleted={(id) => setNotes((current) => current.filter((entry) => entry.id !== id))} />)}
                        </div>
                      </section>

                    );
                  })}
                  {earlierNotes.length ? (
                    <section>
                      {experiences.length ? (
                        <p className="mb-6 text-[12px] font-medium uppercase tracking-[0.14em] text-muted">Earlier notes</p>
                      ) : null}
                      <div className="grid gap-12">
                        {earlierNotes.map((note) => <DetailNote key={note.id} note={note} writing={item.type === "writing"} itemTitle={item.title} canEdit={canEdit} onDeleted={(id) => setNotes((current) => current.filter((entry) => entry.id !== id))} />)}
                      </div>
                    </section>
                  ) : null}
                </div>
              </section>
              {/* Editing controls: beside the cover on wide screens, below the writing on narrow ones. */}
              {item.subtype === "plan" ? (
                <div className="min-w-0 self-start lg:col-start-1 lg:row-start-2 [&>section]:mt-0 lg:[&>section]:mt-6">
                  <PlanPanel
                    key={item.id}
                    host={item}
                    members={planItems ?? []}
                    existing={existing}
                    canEdit={canEdit}
                    onItemsSaved={(saved) => onItemsSaved?.(saved)}
                    onHostSaved={(host) => onUpdated?.(host)}
                  />
                </div>
              ) : canEdit ? (
                <div className="min-w-0 self-start lg:col-start-1 lg:row-start-2 [&>section]:mt-0 lg:[&>section]:mt-6">
                  <EditPanel
                    item={item}
                    onUpdated={onUpdated}
                    onFinished={() => setFireKey(Date.now())}
                    onDone={onClose}
                    onDeleted={(id) => {
                      onClose();
                      onDeleted?.(id);
                    }}
                  />
                </div>
              ) : null}
            </div>
          </motion.article>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

const noteKinds: Array<{ id: ContentNote["kind"]; label: string }> = [
  { id: "thought", label: "Thought" },
  { id: "review", label: "Review" },
  { id: "excerpt", label: "Quote" },
];

type ComposerDraft = { noteId: string | null; kind: ContentNote["kind"]; title: string; body: string };

function draftKey(itemId: string) {
  return `reading-record:note-draft:${itemId}`;
}

function readDraft(itemId: string): ComposerDraft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(itemId));
    return raw ? (JSON.parse(raw) as ComposerDraft) : null;
  } catch {
    return null;
  }
}

function writeDraft(itemId: string, draft: ComposerDraft | null) {
  try {
    if (draft && (draft.body.trim() || draft.title.trim())) {
      window.localStorage.setItem(draftKey(itemId), JSON.stringify(draft));
    } else {
      window.localStorage.removeItem(draftKey(itemId));
    }
  } catch {
    // Private mode etc. — the server autosave still runs.
  }
}

const AUTOSAVE_DELAY = 1200;

/**
 * Writing box that saves as you type: the first pause creates the note, later pauses update it.
 * "Done" closes the draft and moves it into the list. A copy is also kept in this browser,
 * so a half-written note survives closing the page.
 */
function NoteComposer({
  item,
  onSaved,
  onDraftIdChange,
}: {
  item: MediaItem;
  onSaved: (note: ContentNote) => void;
  onDraftIdChange?: (id: string | null) => void;
}) {
  const [kind, setKind] = useState<ContentNote["kind"]>("thought");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [noteId, setNoteId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "pending" | "saving" | "saved" | "error">("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const latest = useRef({ kind, title, body, noteId });
  const lastSent = useRef("");
  const inFlight = useRef<Promise<ContentNote | null> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const checkedRange = useRef<[number, number] | null>(null);
  useEffect(() => {
    latest.current = { kind, title, body, noteId };
  });

  // Restore an unfinished draft for this item (or start empty).
  useEffect(() => {
    const draft = readDraft(item.id);
    setKind(draft?.kind ?? "thought");
    setTitle(draft?.title ?? "");
    setBody(draft?.body ?? "");
    setNoteId(draft?.noteId ?? null);
    lastSent.current = draft?.noteId ? JSON.stringify([draft.kind, draft.title.trim(), draft.body.trim()]) : "";
    setStatus(draft?.noteId ? "saved" : "idle");
    setSavedAt(null);
    setError(null);
  }, [item.id]);

  useEffect(() => {
    onDraftIdChange?.(noteId);
  }, [noteId, onDraftIdChange]);

  function defaultTitle(currentKind: ContentNote["kind"]) {
    if (item.type === "writing") return item.title;
    return currentKind === "excerpt" ? "" : currentKind === "review" ? "Review" : "Thought";
  }

  async function persist(): Promise<ContentNote | null> {
    if (inFlight.current) await inFlight.current.catch(() => null);
    const { kind: k, title: t, body: b, noteId: id } = latest.current;
    if (!b.trim()) return null;
    const signature = JSON.stringify([k, t.trim(), b.trim()]);
    if (signature === lastSent.current && id) return null;
    const run = (async () => {
      setStatus("saving");
      const response = await apiFetch(id ? `/api/notes/${encodeURIComponent(id)}` : "/api/notes", {
        method: id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ contentId: item.id, kind: k, title: t.trim() || defaultTitle(k), body: b.trim() }),
      });
      const payload = (await response.json()) as { data?: ContentNote; error?: string };
      if (!response.ok || !payload.data) {
        throw new Error(response.status === 401 ? "Please sign in again — your text is kept here." : payload.error ?? "Couldn't save");
      }
      lastSent.current = signature;
      if (!id) {
        latest.current.noteId = payload.data.id;
        setNoteId(payload.data.id);
      }
      writeDraft(item.id, { noteId: payload.data.id, kind: k, title: t, body: b });
      setStatus("saved");
      setSavedAt(new Date());
      setError(null);
      return payload.data;
    })();
    inFlight.current = run;
    try {
      return await run;
    } catch (reason) {
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "Couldn't save");
      return null;
    } finally {
      if (inFlight.current === run) inFlight.current = null;
    }
  }

  // Autosave: keep a local copy on every keystroke, save to the site after a short pause.
  useEffect(() => {
    writeDraft(item.id, { noteId, kind, title, body });
    if (!body.trim()) return;
    if (JSON.stringify([kind, title.trim(), body.trim()]) === lastSent.current) return;
    setStatus("pending");
    const timer = window.setTimeout(() => void persist(), AUTOSAVE_DELAY);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, title, body]);

  // Leaving the page or closing the dialog: push whatever is unsaved.
  useEffect(() => {
    const flush = () => void persist();
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  async function finish(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) {
      setError("Write something first.");
      return;
    }
    setFinishing(true);
    const saved = (await persist()) ?? null;
    setFinishing(false);
    if (latest.current.noteId && status !== "error") {
      const note =
        saved ??
        ({
          id: latest.current.noteId,
          contentId: item.id,
          experienceId: null,
          kind,
          title: title.trim() || defaultTitle(kind),
          body: body.trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as unknown as ContentNote);
      onSaved(note);
      writeDraft(item.id, null);
      lastSent.current = "";
      setNoteId(null);
      setTitle("");
      setBody("");
      setStatus("idle");
      setSavedAt(null);
    }
  }

  async function discard() {
    const id = latest.current.noteId;
    writeDraft(item.id, null);
    lastSent.current = "";
    setNoteId(null);
    setTitle("");
    setBody("");
    setStatus("idle");
    setError(null);
    if (id) await apiFetch(`/api/notes/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
  }

  const statusText =
    status === "saving"
      ? "Saving…"
      : status === "pending"
        ? "Editing…"
        : status === "saved" && savedAt
          ? `Saved ${new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(savedAt)}`
          : status === "saved"
            ? "Draft restored"
            : "";
  const lang = textLang(`${title}${body}`);

  return (
    <form className="mt-6 rounded-[8px] border border-line bg-panel p-5 transition-colors focus-within:border-ink/40 sm:p-6" onSubmit={finish}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {item.type === "writing" ? (
          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Keep writing</span>
        ) : (
          <div className="inline-flex rounded-full border border-line p-0.5" role="group" aria-label="Kind of note">
            {noteKinds.map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-pressed={kind === entry.id}
                className={cn(
                  "rounded-full px-3 py-1 text-[13px] transition-colors",
                  kind === entry.id ? "bg-ink text-paper" : "text-muted hover:text-ink",
                )}
                onClick={() => setKind(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        )}
        <span className="text-[12px] text-muted" aria-live="polite">
          {statusText || new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date())}
        </span>
      </div>
      <input
        value={title}
        lang={textLang(title)}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={kind === "excerpt" ? "Page or chapter (optional)" : item.type === "writing" ? "Section title (optional)" : "Title (optional)"}
        className={cn(
          "mt-5 h-10 w-full border-0 bg-transparent outline-none placeholder:text-muted/70",
          kind === "excerpt" ? "text-[15px]" : textLang(title) ? "cjk-font text-[19px] font-semibold" : "font-serif text-[21px] tracking-[-0.01em]",
        )}
      />
      <textarea
        ref={textareaRef}
        value={body}
        lang={lang}
        onChange={(event) => setBody(event.target.value)}
        rows={10}
        placeholder={kind === "excerpt" ? "The passage you want to keep…" : "Write freely — it saves as you go."}
        className={cn(
          "note-body mt-2 min-h-[16rem] w-full resize-y border-0 bg-transparent outline-none placeholder:text-muted/70",
          lang && "note-body-cjk",
          kind === "excerpt" && "border-l-2 border-accent pl-4 italic",
        )}
      />
      <ClaudeHelper
        allowAsk={item.type !== "writing"}
        context={{
          title: item.title,
          creator: item.type === "writing" ? undefined : item.creator,
          kind: item.type === "writing" ? "my own writing" : kindName(item),
        }}
        getText={() => {
          const area = textareaRef.current;
          const start = area?.selectionStart ?? 0;
          const end = area?.selectionEnd ?? 0;
          if (area && end > start) {
            checkedRange.current = [start, end];
            return { text: body.slice(start, end), selection: true, whole: body };
          }
          checkedRange.current = null;
          return { text: body, selection: false, whole: body };
        }}
        onApply={(corrected, selection) => {
          const range = checkedRange.current;
          if (selection && range) setBody((current) => current.slice(0, range[0]) + corrected + current.slice(range[1]));
          else setBody(corrected);
        }}
        onInsert={(text) =>
          setBody((current) => `${current.trimEnd()}${current.trim() ? "\n\n" : ""}${text.split("\n").map((line) => (line.trim() ? `> ${line}` : ">")).join("\n")}\n\n`)
        }
      />
      <div className="mt-3 flex items-center justify-between gap-4 border-t border-line pt-4">
        <span className="text-[12px] text-muted">
          {body.trim() ? `${body.trim().length} characters` : ""}
          {error ? <span className="ml-2 text-accent">{error}</span> : null}
        </span>
        <div className="flex items-center gap-3">
          {body || title ? (
            <button type="button" className="text-[13px] text-muted hover:text-ink" onClick={() => void discard()}>
              Discard
            </button>
          ) : null}
          <button
            type="submit"
            disabled={finishing || !body.trim()}
            className="rounded-full bg-ink px-4 py-1.5 text-[13px] font-medium text-paper disabled:opacity-35"
          >
            {finishing ? "Saving…" : "Done"}
          </button>
        </div>
      </div>
    </form>
  );
}

/** Writing is something I wrote, not something I'm working through: it is either a draft or published. */
function isDraft(item: MediaItem) {
  return /(^|·\s*)Draft(\s*·|$)/i.test(parseTagline(item.note).text);
}

function taglineTextWithoutDraft(text: string) {
  return text
    .split("·")
    .map((part) => part.trim())
    .filter((part) => part && part.toLowerCase() !== "draft")
    .join(" · ");
}

const editStatuses: Array<{ id: MediaItem["status"]; label: string }> = [
  { id: "in_progress", label: "Ongoing" },
  { id: "finished", label: "Finished" },
  { id: "planned", label: "Up next" },
  { id: "dropped", label: "Set aside" },
];

function EditPanel({
  item,
  onUpdated,
  onFinished,
  onDone,
  onDeleted,
}: {
  item: MediaItem;
  onUpdated?: (item: MediaItem) => void;
  onFinished?: () => void;
  onDone?: () => void;
  onDeleted?: (id: string) => void;
}) {
  const [status, setStatus] = useState(item.status);
  const [progress, setProgress] = useState(item.progressPercent ?? 0);
  const [rating, setRating] = useState(item.rating != null ? String(item.rating) : "");
  const [favorite, setFavorite] = useState(Boolean(item.favorite));
  const [title, setTitle] = useState(item.title);
  const [creator, setCreator] = useState(item.creator);
  const [tagInput, setTagInput] = useState(parseTagline(item.note).tags.join(" "));
  const [draft, setDraft] = useState(isDraft(item));
  const [kindInput, setKindInput] = useState(subtypeLabel(item.subtype));
  const [targetDate, setTargetDate] = useState(toDateInput(item.targetFinishAt));
  const [showDetails, setShowDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Start fresh whenever a different item is opened.
  useEffect(() => {
    setStatus(item.status);
    setProgress(item.progressPercent ?? 0);
    setRating(item.rating != null ? String(item.rating) : "");
    setFavorite(Boolean(item.favorite));
    setTitle(item.title);
    setCreator(item.creator);
    setTagInput(parseTagline(item.note).tags.join(" "));
    setDraft(isDraft(item));
    setKindInput(subtypeLabel(item.subtype));
    setTargetDate(toDateInput(item.targetFinishAt));
    setMessage(null);
    setError(null);
  }, [item]);

  function buildChanges(): Partial<MediaItem> | null {
    const changes: Record<string, unknown> = {};
    const now = new Date().toISOString();
    if (status !== item.status) {
      changes.status = status;
      if (status === "finished") {
        changes.finishedAt = now;
        changes.progressPercent = 100;
        changes.completionCount = Math.max(1, item.completionCount ?? 0);
      }
    }
    const targetChanged = targetDate !== toDateInput(item.targetFinishAt);
    if (status === "in_progress" && (progress !== (item.progressPercent ?? 0) || targetChanged)) {
      // Restart automatic growth from what's shown now (or the hand-set value).
      changes.progressPercent = progress;
      changes.progressSetAt = now;
    }
    if (targetChanged) {
      // Expected finish = end of that day in local time.
      changes.targetFinishAt = targetDate ? new Date(`${targetDate}T23:59:00`).toISOString() : null;
    }
    const ratingValue = rating.trim() === "" ? null : Math.max(0, Math.min(5, Number(rating)));
    if (ratingValue !== null && !Number.isFinite(ratingValue)) {
      setError("Rating should be a number from 0 to 5.");
      return null;
    }
    if (ratingValue !== (item.rating ?? null)) changes.rating = ratingValue;
    if (favorite !== Boolean(item.favorite)) changes.favorite = favorite;
    if (title.trim() && title.trim() !== item.title) changes.title = title.trim();
    if (creator.trim() && creator.trim() !== item.creator) changes.creator = creator.trim();
    const nextSubtype = subtypeValue(kindInput);
    if ((nextSubtype ?? null) !== (item.subtype ?? null)) changes.subtype = nextSubtype ?? null;
    const current = parseTagline(item.note);
    const nextTags = splitTagInput(tagInput);
    const draftChanged = item.type === "writing" && draft !== isDraft(item);
    if (draftChanged || nextTags.join(" ") !== current.tags.join(" ")) {
      const baseText = item.type === "writing" ? taglineTextWithoutDraft(current.text) : current.text;
      const text = item.type === "writing" && draft ? ["Draft", baseText].filter(Boolean).join(" · ") : baseText;
      changes.note = formatTagline(text, nextTags, current.plan) || null;
    }
    return changes as Partial<MediaItem>;
  }

  async function save(overrides?: Partial<{ status: MediaItem["status"] }>) {
    setError(null);
    setMessage(null);
    if (overrides?.status) setStatus(overrides.status);
    const changes = overrides?.status
      ? {
          status: overrides.status,
          ...(overrides.status === "finished"
            ? {
                finishedAt: new Date().toISOString(),
                progressPercent: 100,
                completionCount: Math.max(1, item.completionCount ?? 0),
              }
            : {}),
        }
      : buildChanges();
    if (!changes) return;
    if (Object.keys(changes).length === 0) {
      setMessage("Nothing to change.");
      return;
    }
    setSaving(true);
    try {
      const response = await apiFetch(`/api/media/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(changes),
      });
      const payload = (await response.json()) as { data?: MediaItem; error?: string };
      if (!response.ok || !payload.data) {
        throw new Error(response.status === 401 ? "Please sign in again to edit." : payload.error ?? "Could not save");
      }
      const justFinished = item.status !== "finished" && payload.data.status === "finished";
      if (justFinished && payload.data.finishedAt) {
        // Keep a history entry for this finish, so a later rewatch doesn't erase this year.
        await recordViewing(item.id, payload.data.finishedAt).catch(() => null);
      }
      onUpdated?.(payload.data);
      setMessage(justFinished ? "Finished!" : "Saved");
      if (justFinished) onFinished?.();
      // Head back to the shelf once saved (a finished item lights up there).
      window.setTimeout(() => onDone?.(), justFinished ? 650 : 350);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  const verb = item.type === "book" ? "read" : item.type === "game" ? "played" : "watched";

  // Finished it again (rewatch / reread / replay): log another finish today; the earlier one stays in its year.
  async function finishAgain() {
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      const now = new Date().toISOString();
      if (!item.viewings?.length && item.finishedAt) await recordViewing(item.id, item.finishedAt);
      await recordViewing(item.id, now);
      const response = await apiFetch(`/api/media/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          finishedAt: now,
          completionCount: Math.max(item.completionCount ?? 1, item.viewings?.length ?? 1) + 1,
        }),
      });
      const payload = (await response.json()) as { data?: MediaItem; error?: string };
      if (!response.ok || !payload.data) {
        throw new Error(response.status === 401 ? "Please sign in again to edit." : payload.error ?? "Could not save");
      }
      onUpdated?.(payload.data);
      setMessage(`Logged — ${verb} again`);
      onFinished?.();
      window.setTimeout(() => onDone?.(), 650);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }
  const writing = item.type === "writing";

  const ratingValue = rating.trim() === "" ? 0 : Number(rating);

  return (
    <section className="mt-6 border-t border-line pt-5" aria-label="Edit this record">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{writing ? "This piece" : "Your record"}</h3>
        {!writing && item.status === "finished" ? (
          <button
            type="button"
            disabled={saving}
            title={`Finished it again — it will also show under this year`}
            className="text-[13px] font-medium text-accent underline-offset-4 hover:underline disabled:opacity-40"
            onClick={() => void finishAgain()}
          >
            ↻ {verb === "read" ? "Read" : verb === "played" ? "Played" : "Watched"} again
          </button>
        ) : null}
        {!writing && item.status !== "finished" ? (
          <button
            type="button"
            disabled={saving}
            className="text-[13px] font-medium text-accent underline-offset-4 hover:underline disabled:opacity-40"
            onClick={() => void save({ status: "finished" })}
          >
            ✓ Mark as {verb}
          </button>
        ) : null}
      </div>

      {writing ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="inline-flex rounded-full border border-line p-0.5 text-[12px]" role="group" aria-label="Draft or published">
            {[
              { id: false, label: "Published" },
              { id: true, label: "Draft" },
            ].map((entry) => (
              <button
                key={entry.label}
                type="button"
                aria-pressed={draft === entry.id}
                className={cn(
                  "rounded-full px-3 py-1 transition-colors",
                  draft === entry.id ? "bg-ink text-paper" : "text-muted hover:text-ink",
                )}
                onClick={() => setDraft(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-pressed={favorite}
            aria-label={favorite ? "Remove from favorites" : "Mark as favorite"}
            title={favorite ? "Favorite" : "Mark as favorite"}
            className={cn("text-[18px] leading-none transition-colors", favorite ? "text-accent" : "text-line hover:text-muted")}
            onClick={() => setFavorite((value) => !value)}
          >
            {favorite ? "♥" : "♡"}
          </button>
        </div>
      ) : null}

      {/* status: one compact segmented control */}
      {writing ? null : (<>
      <div className="mt-3 grid grid-cols-4 rounded-full border border-line p-0.5 text-[12px]" role="group" aria-label="Status">
        {editStatuses.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={status === entry.id}
            className={cn(
              "truncate rounded-full px-1.5 py-1 transition-colors",
              status === entry.id ? "bg-ink text-paper" : "text-muted hover:text-ink",
            )}
            onClick={() => setStatus(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {status === "in_progress" ? (
        <label className="mt-4 flex items-center gap-3 text-[12px] text-muted">
          <span className="shrink-0">Progress</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={progress}
            onChange={(event) => setProgress(Number(event.target.value))}
            className="h-1 min-w-0 flex-1 accent-[rgb(var(--accent))]"
          />
          <span className="w-9 shrink-0 text-right tabular-nums text-ink">{progress}%</span>
        </label>
      ) : null}

      {status === "in_progress" ? (
        <div className="mt-3 text-[12px] text-muted">
          <label className="flex items-center gap-3">
            <span className="shrink-0">Finish by</span>
            <input
              type="date"
              value={targetDate}
              min={toDateInput(new Date().toISOString())}
              onChange={(event) => setTargetDate(event.target.value)}
              className="h-7 min-w-0 flex-1 border-0 border-b border-line bg-transparent text-[13px] text-ink outline-none focus:border-ink"
            />
            {targetDate ? (
              <button type="button" className="shrink-0 hover:text-ink" onClick={() => setTargetDate("")}>
                Clear
              </button>
            ) : null}
          </label>
          {targetDate ? (
            <p className="mt-1.5 text-[11.5px]">
              Progress grows by itself — {paceLabel(progress, new Date(`${targetDate}T23:59:00`).toISOString())}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* rating stars + favourite heart */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-0.5" role="group" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((star) => {
            const fill = ratingValue >= star ? 1 : ratingValue >= star - 0.5 ? 0.5 : 0;
            return (
              <button
                key={star}
                type="button"
                title={`${star} — click again for ${star - 0.5}`}
                aria-label={`Rate ${star}`}
                className="relative h-6 w-6 text-[19px] leading-6 text-line transition-colors hover:text-muted"
                onClick={() => {
                  if (ratingValue === star) setRating(String(star - 0.5));
                  else if (ratingValue === star - 0.5 && star === 1) setRating("");
                  else setRating(String(star));
                }}
              >
                <span aria-hidden="true">★</span>
                {fill > 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 overflow-hidden text-accent"
                    style={{ width: fill === 1 ? "100%" : "50%" }}
                  >
                    ★
                  </span>
                ) : null}
              </button>
            );
          })}
          <span className="ml-1.5 text-[12px] tabular-nums text-muted">{rating ? rating : "–"}</span>
        </div>
        <button
          type="button"
          aria-pressed={favorite}
          aria-label={favorite ? "Remove from favorites" : "Mark as favorite"}
          title={favorite ? "Favorite" : "Mark as favorite"}
          className={cn("text-[18px] leading-none transition-colors", favorite ? "text-accent" : "text-line hover:text-muted")}
          onClick={() => setFavorite((value) => !value)}
        >
          {favorite ? "♥" : "♡"}
        </button>
      </div>
      </>)}

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
        <button type="button" className="text-muted underline-offset-4 hover:text-ink hover:underline" onClick={() => setShowDetails((open) => !open)}>
          {showDetails ? "Hide details" : writing ? "Edit title & kind" : "Edit title, creator & kind"}
        </button>
      </div>

      <label className="mt-4 block">
        <span className="text-[12px] text-muted">Tags</span>
        <input
          value={tagInput}
          onChange={(event) => setTagInput(event.target.value)}
          placeholder="吐槽 評論"
          className="mt-0.5 h-8 w-full border-0 border-b border-line bg-transparent text-[14px] outline-none placeholder:text-muted/60 focus:border-ink"
        />
      </label>

      {item.type !== "writing" ? <CoverFinder item={item} onUpdated={onUpdated} /> : null}

      {showDetails ? (
        <div className="mt-4 grid gap-3">
          <label className="block">
            <span className="text-[12px] text-muted">Title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-0.5 h-8 w-full border-0 border-b border-line bg-transparent font-serif text-[15px] outline-none focus:border-ink" />
          </label>
          <KindInput type={item.type} value={kindInput} onChange={setKindInput} />
          <label className={cn("block", writing && "hidden")}>
            <span className="text-[12px] text-muted">Creator</span>
            <input value={creator} onChange={(event) => setCreator(event.target.value)} className="mt-0.5 h-8 w-full border-0 border-b border-line bg-transparent text-[14px] outline-none focus:border-ink" />
          </label>
        </div>
      ) : null}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          disabled={saving}
          className="rounded-full bg-ink px-4 py-1.5 text-[13px] font-medium text-paper disabled:opacity-40"
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {message ? <span className="text-[12px] text-muted">{message}</span> : null}
        {error ? <span className="text-[12px] text-accent">{error}</span> : null}
        <DeleteControl
          className="ml-auto"
          label={`Delete this ${item.type === "writing" ? "article" : item.type === "book" ? "book" : item.type === "game" ? "game" : "title"}`}
          confirmLabel="Delete it and its notes?"
          url={`/api/media/${encodeURIComponent(item.id)}`}
          onDeleted={() => onDeleted?.(item.id)}
          onError={setError}
        />
      </div>
    </section>
  );
}

/** Small "Delete" link that asks once inline before removing anything. */
function DeleteControl({
  url,
  label,
  confirmLabel,
  onDeleted,
  onError,
  className,
}: {
  url: string;
  label: string;
  confirmLabel: string;
  onDeleted: () => void;
  onError?: (message: string | null) => void;
  className?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    onError?.(null);
    try {
      const response = await apiFetch(url, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(response.status === 401 ? "Please sign in again to delete." : payload.error ?? "Could not delete");
      }
      onDeleted();
    } catch (reason) {
      onError?.(reason instanceof Error ? reason.message : "Could not delete");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        className={cn("text-[12px] text-muted underline-offset-4 transition-colors hover:text-accent hover:underline", className)}
        onClick={() => setConfirming(true)}
      >
        {label}
      </button>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-2 text-[12px]", className)}>
      <span className="text-ink">{confirmLabel}</span>
      <button
        type="button"
        disabled={busy}
        className="rounded-full bg-accent px-2.5 py-0.5 font-medium text-paper disabled:opacity-50"
        onClick={() => void remove()}
      >
        {busy ? "Deleting…" : "Delete"}
      </button>
      <button type="button" disabled={busy} className="text-muted hover:text-ink" onClick={() => setConfirming(false)}>
        Cancel
      </button>
    </span>
  );
}

const coverSearchEndpoint: Record<string, string> = { book: "books", video: "anime", game: "games" };

function CoverFinder({ item, onUpdated }: { item: MediaItem; onUpdated?: (item: MediaItem) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(item.title);
  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingUrl, setSavingUrl] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");

  useEffect(() => {
    setOpen(false);
    setQuery(item.title);
    setResults([]);
    setError(null);
  }, [item.id, item.title]);

  async function search() {
    // Anime uses the anime catalogs; films and TV use the film search.
    const endpoint =
      item.type === "video" && (item.subtype === "j_drama" || item.subtype === "k_drama")
        ? "dramas"
        : item.type === "video" && item.subtype && item.subtype !== "anime"
          ? "films"
          : coverSearchEndpoint[item.type];
    if (!endpoint || query.trim().length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/search/${endpoint}?q=${encodeURIComponent(query.trim())}`);
      const payload = (await response.json()) as { data?: MediaItem[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Search failed");
      const withCovers = (payload.data ?? []).filter((result) => result.coverUrl);
      setResults(withCovers.slice(0, 10));
      if (withCovers.length === 0) setError("No covers found. Try a shorter or original-language title.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveCover(url: string) {
    setSavingUrl(url);
    setError(null);
    try {
      const response = await apiFetch(`/api/media/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ coverUrl: url }),
      });
      const payload = (await response.json()) as { data?: MediaItem; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "Could not save the cover");
      onUpdated?.(payload.data);
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the cover");
    } finally {
      setSavingUrl(null);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="mt-1 text-[12px] text-muted underline-offset-4 hover:text-ink hover:underline"
        onClick={() => {
          setOpen(true);
          void search();
        }}
      >
        {item.coverUrl ? "Change cover" : "Find cover"}
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-[4px] border border-line p-3">
      <form
        className="flex items-center gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-9 flex-1 border-0 border-b border-line bg-transparent text-[15px] outline-none focus:border-ink"
          aria-label="Search for a cover"
        />
        <button type="submit" className="text-sm text-muted hover:text-ink">
          Search
        </button>
        <button type="button" className="text-sm text-muted hover:text-ink" onClick={() => setOpen(false)}>
          Close
        </button>
      </form>
      {loading ? <p className="mt-3 text-sm text-muted">Looking for covers…</p> : null}
      {error ? <p className="mt-3 text-sm text-muted">{error}</p> : null}
      <form
        className="mt-4 flex items-center gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const url = pasted.trim();
          if (!/^https?:\/\//i.test(url)) {
            setError("Paste a full image link starting with https://");
            return;
          }
          void saveCover(url);
        }}
      >
        <input
          value={pasted}
          onChange={(event) => setPasted(event.target.value)}
          placeholder="…or paste an image link"
          className="h-9 flex-1 border-0 border-b border-line bg-transparent text-sm outline-none placeholder:text-muted focus:border-ink"
          aria-label="Paste an image link"
        />
        <button type="submit" disabled={!pasted.trim() || Boolean(savingUrl)} className="text-sm text-muted hover:text-ink disabled:opacity-40">
          Use link
        </button>
      </form>
      {results.length ? (
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {results.map((result) => (
            <li key={result.id}>
              <button
                type="button"
                title={`${result.title} — ${result.creator}`}
                disabled={Boolean(savingUrl)}
                className="group block w-full text-left disabled:opacity-50"
                onClick={() => result.coverUrl && void saveCover(result.coverUrl)}
              >
                <span className="relative block aspect-[2/3] overflow-hidden rounded-[2px] bg-line ring-1 ring-black/5 transition group-hover:ring-2 group-hover:ring-accent">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" src={result.coverUrl} referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" />
                </span>
                <span className="mt-1 block truncate text-[11px] text-muted">
                  {savingUrl === result.coverUrl ? "Saving…" : result.title}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Rating, finish date, times, etc. as one compact line under the title. */
function FactLine({ item }: { item: MediaItem }) {
  if (item.type === "writing") return null;
  const facts: Array<{ key: string; label: string; value: string }> = [];
  if (item.rating != null) facts.push({ key: "rating", label: "Rating", value: `★ ${item.rating}/5` });
  if (item.status === "in_progress" && item.progressPercent != null)
    facts.push({ key: "progress", label: "Progress", value: `${item.progressPercent}%` });
  if (item.status === "in_progress" && item.targetFinishAt)
    facts.push({ key: "target", label: "Expected finish", value: `Finish by ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(item.targetFinishAt))}` });
  if (item.finishedAt) facts.push({ key: "finished", label: "Finished", value: `Finished ${formatDate(item.finishedAt)}` });
  if (item.completionCount && item.completionCount > 1)
    facts.push({ key: "times", label: "Times finished", value: `${item.completionCount} times` });
  if (item.pageCount) facts.push({ key: "pages", label: "Pages", value: `${item.pageCount} pp` });
  if (item.publisher) facts.push({ key: "publisher", label: "Publisher", value: item.publisher });
  if (!facts.length) return null;
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] tabular-nums text-ink/80">
      {facts.map((fact, index) => (
        <span key={fact.key} title={fact.label} className="inline-flex items-center gap-2">
          {index ? <span className="text-muted/60" aria-hidden="true">·</span> : null}
          <span>
            <span className="sr-only">{fact.label}: </span>
            {fact.value}
          </span>
        </span>
      ))}
    </p>
  );
}

function statusLabel(status: string) {
  if (status === "in_progress") return "in progress";
  if (status === "dropped") return "set aside";
  return status;
}

function DetailNote({
  note,
  writing = false,
  itemTitle,
  canEdit,
  onDeleted,
}: {
  note: ContentNote;
  writing?: boolean;
  itemTitle?: string;
  canEdit?: boolean;
  onDeleted?: (id: string) => void;
}) {
  const remove = canEdit ? (
    <DeleteControl
      label="Delete note"
      confirmLabel="Delete this note?"
      url={`/api/notes/${encodeURIComponent(note.id)}`}
      onDeleted={() => onDeleted?.(note.id)}
    />
  ) : null;
  if (note.kind === "excerpt") {
    return (
      <figure>
        <blockquote lang={textLang(note.body)} className={cn("border-l-2 border-accent pl-5 text-ink/90 whitespace-pre-wrap", textLang(note.body) ? "note-body note-body-cjk" : "font-serif text-[18px] italic leading-[1.7]")}>
          {note.body}
        </blockquote>
        <figcaption className="mt-3 pl-5 text-sm text-muted">
          {note.title && note.title !== "excerpt note" ? `${note.title} · ` : ""}
          {formatDate(note.createdAt)}
          {remove ? <span className="ml-3">{remove}</span> : null}
        </figcaption>
      </figure>
    );
  }
  return (
    <article className="border-b border-line/70 pb-10 last:border-b-0">
      <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">
        {writing ? formatDate(note.createdAt) : `${note.kind === "review" ? "Review" : "Thought"} · ${formatDate(note.createdAt)}`}
      </p>
      {writing && note.title.trim() === itemTitle?.trim() ? null : <h4
        lang={textLang(note.title)}
        className={cn(
          "mt-2 text-[22px] leading-snug",
          textLang(note.title) ? "cjk-font font-semibold tracking-[0.01em] text-ink" : "font-serif font-normal tracking-[-0.01em]",
        )}
      >
        {note.title}
      </h4>}
      <NoteBody body={note.body} className="mt-4" />
      {remove ? <div className="mt-4">{remove}</div> : null}
    </article>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

/** ISO timestamp → "YYYY-MM-DD" in local time for <input type="date">. */
function toDateInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function kindName(item: MediaItem) {
  if (item.type === "book") return "the book";
  if (item.type === "game") return "the game";
  if (item.subtype === "anime") return "the anime";
  if (item.subtype === "movie") return "the film";
  return "the series";
}

/** Store one finish in the history (experiences) table. */
async function recordViewing(contentId: string, finishedAt: string) {
  const response = await apiFetch("/api/experiences", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contentId, status: "finished", startedAt: finishedAt, finishedAt }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Could not save the viewing");
  }
}
