"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, CalendarDays, Quote, Star, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ContentExperience, ContentNote, MediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  origin,
  onClose,
}: {
  item: MediaItem | null;
  origin: DetailOrigin | null;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState<ContentNote[]>([]);
  const [experiences, setExperiences] = useState<ContentExperience[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setNotes([]);
    setExperiences([]);

    Promise.all([
      fetch(`/api/notes?contentId=${encodeURIComponent(item.id)}`, {
        cache: "no-store",
        signal: controller.signal,
      }),
      fetch(`/api/experiences?contentId=${encodeURIComponent(item.id)}`, {
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
  const earlierNotes = notes.filter(
    (note) => !note.experienceId || !linkedExperienceIds.has(note.experienceId),
  );
  const panelWidth = origin ? Math.min(1024, origin.viewportWidth - 16) : 1024;
  const panelHeight = origin ? Math.min(720, origin.viewportHeight - 16) : 720;
  const originScale = origin
    ? Math.max(0.16, Math.min(0.34, Math.max(origin.width / panelWidth, origin.height / panelHeight)))
    : 0.97;
  const panelOrigin = origin
    ? {
        x: origin.centerX - origin.viewportWidth / 2,
        y: origin.centerY - origin.viewportHeight / 2,
        scale: originScale,
        opacity: 0.42,
      }
    : { x: 0, y: 28, scale: 0.97, opacity: 0.8 };

  return (
    <AnimatePresence>
      {item ? (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/45 p-2 backdrop-blur-[2px] sm:p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.article
            aria-label={`${item.title} details`}
            aria-modal="true"
            className="relative grid max-h-[calc(100vh-1rem)] w-full max-w-5xl overflow-hidden rounded-[8px] border border-line bg-paper text-ink shadow-[0_32px_100px_rgba(0,0,0,0.34)] md:grid-cols-[minmax(240px,0.75fr)_minmax(0,1.45fr)] sm:max-h-[calc(100vh-2.5rem)]"
            initial={panelOrigin}
            animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            exit={panelOrigin}
            transition={{ type: "spring", stiffness: 270, damping: 29, mass: 0.82 }}
          >
            <button
              aria-label="Close details"
              className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full border border-line bg-panel/90 shadow-sm transition hover:bg-paper"
              type="button"
              onClick={onClose}
            >
              <X size={17} />
            </button>

            <div className="relative flex min-h-[250px] items-center justify-center overflow-hidden border-b border-line bg-panel p-8 md:min-h-0 md:border-b-0 md:border-r">
              <div
                className="absolute inset-0 opacity-20 blur-2xl"
                style={{ background: `linear-gradient(145deg, ${item.coverTone[0]}, ${item.coverTone[1]})` }}
              />
              <motion.div
                className={cn(
                  "relative overflow-hidden border border-black/10 bg-panel shadow-[0_22px_45px_rgba(0,0,0,0.24)]",
                  item.type === "video" ? "aspect-square w-44 rounded-[7px]" : "aspect-[2/3] w-40 rounded-[5px]",
                )}
                initial={{
                  rotateY: item.type === "book" ? -18 : 0,
                  rotate: item.type === "video" ? -3 : item.type === "game" ? 2 : 0,
                  scale: 0.96,
                  y: 14,
                }}
                animate={{ rotateY: 0, rotate: 0, scale: 1, y: 0 }}
                exit={{
                  rotateY: item.type === "book" ? -10 : 0,
                  rotate: item.type === "video" ? 2 : 0,
                  scale: 0.97,
                }}
                transition={{
                  layout: { type: "spring", stiffness: 310, damping: 30 },
                  delay: 0.04,
                  type: "spring",
                  stiffness: 260,
                  damping: 26,
                }}
                style={{ transformOrigin: "left center", transformPerspective: 900 }}
              >
                {item.coverUrl ? (
                  <img alt={`${item.title} cover`} className="h-full w-full object-cover" src={item.coverUrl} />
                ) : (
                  <div
                    className="flex h-full w-full items-end p-4 text-white"
                    style={{ background: `linear-gradient(145deg, ${item.coverTone[0]}, ${item.coverTone[1]})` }}
                  >
                    <span className="font-serif text-lg font-semibold leading-tight">{item.title}</span>
                  </div>
                )}
                {item.type === "book" ? <div className="absolute inset-y-0 left-0 w-2 bg-black/15" /> : null}
              </motion.div>
            </div>

            <motion.div
              className="min-h-0 overflow-y-auto p-5 sm:p-7 md:p-9"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ delay: 0.12, duration: 0.24, ease: "easeOut" }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                {item.subtype ?? item.type} · {item.status.replace("_", " ")}
              </p>
              <h2 className="mt-2 max-w-[90%] font-serif text-3xl font-semibold leading-tight sm:text-4xl">
                {item.title}
              </h2>
              <p className="mt-2 text-sm text-muted">{item.creator}</p>

              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-y border-line/70 py-3 text-sm">
                {item.rating != null ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <Star size={15} fill="currentColor" /> {item.rating}
                  </span>
                ) : null}
                {item.completionCount ? (
                  <span className="inline-flex items-center gap-1.5">
                    <BookOpen size={15} /> Experienced {item.completionCount} time{item.completionCount === 1 ? "" : "s"}
                  </span>
                ) : null}
                {item.finishedAt ? (
                  <span className="inline-flex items-center gap-1.5 text-muted">
                    <CalendarDays size={15} /> {formatDate(item.finishedAt)}
                  </span>
                ) : null}
              </div>

              <section className="mt-7">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-serif text-2xl font-semibold">Notes & reviews</h3>
                  <span className="text-xs font-semibold text-muted">{notes.length || ""}</span>
                </div>

                {loading ? <p className="mt-4 text-sm text-muted">Opening your notes...</p> : null}
                {error ? <p className="mt-4 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
                {!loading && !error && notes.length === 0 ? (
                  <div className="mt-4 rounded-[6px] border border-dashed border-line p-5 text-sm text-muted">
                    No notes yet. Add the first one from Quick writing in Admin.
                  </div>
                ) : null}

                <div className="mt-4 grid gap-7">
                  {experiences.map((experience) => {
                    const experienceNotes = notes.filter(
                      (note) => note.experienceId === experience.id,
                    );
                    if (experienceNotes.length === 0) return null;
                    return (
                      <section key={experience.id}>
                        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                          {formatDate(experience.startedAt)} · {experience.status.replace("_", " ")}
                        </p>
                        <div className="grid gap-5">
                          {experienceNotes.map((note) => <DetailNote key={note.id} note={note} />)}
                        </div>
                      </section>
                    );
                  })}
                  {earlierNotes.length ? (
                    <section>
                      {experiences.length ? (
                        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                          Earlier notes
                        </p>
                      ) : null}
                      <div className="grid gap-5">
                        {earlierNotes.map((note) => <DetailNote key={note.id} note={note} />)}
                      </div>
                    </section>
                  ) : null}
                </div>
              </section>
            </motion.div>
          </motion.article>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function DetailNote({ note }: { note: ContentNote }) {
  return (
    <article className="border-l-2 border-line pl-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
        {note.kind === "excerpt" ? <Quote size={13} /> : <BookOpen size={13} />}
        {note.kind} · {formatDate(note.createdAt)}
      </div>
      <h4 className="mt-2 font-serif text-xl font-semibold">{note.title}</h4>
      <p className="mt-2 whitespace-pre-wrap font-serif text-[17px] leading-7 text-ink/85">
        {note.body}
      </p>
    </article>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
