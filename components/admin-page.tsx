"use client";

import { DefaultCover } from "./default-cover";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Check,
  CheckCircle2,
  Clapperboard,
  FileText,
  Gamepad2,
  Library,
  LoaderCircle,
  Lock,
  LogOut,
  PenLine,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  type GamePlatformFamily,
  type MediaItem,
  type MediaStatus,
  type MediaType,
} from "@/lib/sample-data";
import type {
  ContentExperience,
  ContentNote,
  ExperienceStatus,
  NoteKind,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-shell";
import { apiFetch } from "@/lib/client-api";

type AdminSection = "writing" | "content" | "library";
type ApiStatus = "loading" | "connected" | "unavailable";
type AuthStatus = "checking" | "signed_in" | "signed_out";
type PendingAction = "note" | "content" | "library" | "delete" | null;

const typeOptions: Array<{ value: MediaType; label: string; icon: React.ReactNode }> = [
  { value: "book", label: "Book", icon: <BookOpen size={16} /> },
  { value: "video", label: "Video", icon: <Clapperboard size={16} /> },
  { value: "game", label: "Game", icon: <Gamepad2 size={16} /> },
  { value: "writing", label: "Writing", icon: <FileText size={16} /> },
];

const statusOptions: Array<{ value: MediaStatus; label: string }> = [
  { value: "in_progress", label: "In progress" },
  { value: "finished", label: "Finished" },
  { value: "planned", label: "Planned" },
  { value: "dropped", label: "Dropped" },
];

const platformOptions: Array<{ value: GamePlatformFamily; label: string }> = [
  { value: "playstation", label: "PlayStation" },
  { value: "nintendo", label: "Nintendo" },
  { value: "xbox", label: "Xbox" },
  { value: "pc", label: "PC" },
];

const libraryPageSize = 8;

const generatedCoverPalettes: Array<[string, string]> = [
  ["#7f302c", "#d8a46f"],
  ["#243f5a", "#91b7b3"],
  ["#394d35", "#d1bf73"],
  ["#4d3556", "#c6a1b8"],
  ["#28303c", "#a9a18f"],
  ["#6d4930", "#d8bd88"],
];

export function AdminPage() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const [records, setRecords] = useState<MediaItem[]>([]);
  const [notes, setNotes] = useState<ContentNote[]>([]);
  const [experiences, setExperiences] = useState<ContentExperience[]>([]);
  const [activeSection, setActiveSection] = useState<AdminSection>("writing");
  const [selectedType, setSelectedType] = useState<MediaType>("book");
  // Which catalog a video search uses: anime (Jikan/AniList), J/K-dramas (TVmaze/TMDB) or films (iTunes).
  const [videoSource, setVideoSource] = useState<"anime" | "dramas" | "films">("anime");
  const [query, setQuery] = useState("");
  const [importCandidate, setImportCandidate] = useState<MediaItem | null>(null);
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [quickTargetQuery, setQuickTargetQuery] = useState("");
  const [noteKind, setNoteKind] = useState<NoteKind>("review");
  const [lastSavedNoteId, setLastSavedNoteId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<ExperienceStatus>("in_progress");
  const [experienceMode, setExperienceMode] = useState<"new" | "current">("new");
  const [apiStatus, setApiStatus] = useState<ApiStatus>("loading");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sourceResults, setSourceResults] = useState<MediaItem[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [confirmation, setConfirmation] = useState<{ id: number; message: string } | null>(null);

  useEffect(() => {
    if (!confirmation) return;
    const timer = window.setTimeout(() => setConfirmation(null), 2600);
    return () => window.clearTimeout(timer);
  }, [confirmation]);

  function showConfirmation(message: string) {
    setConfirmation({ id: Date.now(), message });
  }

  useEffect(() => {
    let active = true;
    apiFetch("/api/auth/me", { cache: "no-store" })
      .then((response) => {
        if (!active) return;
        setAuthStatus(response.ok ? "signed_in" : "signed_out");
      })
      .catch(() => {
        if (active) setAuthStatus("signed_out");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    Promise.all([
      apiFetch("/api/media", { cache: "no-store" }),
      apiFetch("/api/notes", { cache: "no-store" }),
      apiFetch("/api/experiences", { cache: "no-store" }),
    ])
      .then(async ([mediaResponse, notesResponse, experiencesResponse]) => {
        if (!mediaResponse.ok || !notesResponse.ok || !experiencesResponse.ok) {
          throw new Error("API unavailable");
        }
        const mediaPayload = (await mediaResponse.json()) as { data: MediaItem[] };
        const notesPayload = (await notesResponse.json()) as { data: ContentNote[] };
        const experiencesPayload = (await experiencesResponse.json()) as {
          data: ContentExperience[];
        };
        if (!active) return;
        setRecords(mediaPayload.data);
        setNotes(notesPayload.data);
        setExperiences(experiencesPayload.data);
        setApiStatus("connected");
      })
      .catch(() => {
        if (active) setApiStatus("unavailable");
      });

    return () => {
      active = false;
    };
  }, []);

  const localSearchResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return records
      .filter((item) => item.type === selectedType)
      .filter((item) => {
        if (!normalized) return true;
        return `${item.title} ${item.creator}`.toLowerCase().includes(normalized);
      })
      .slice(0, 8);
  }, [query, records, selectedType]);
  const usesExternalSearch =
    selectedType === "book" || selectedType === "video" || selectedType === "game";
  const searchResults = usesExternalSearch && query.trim().length >= 2
    ? sourceResults
    : localSearchResults;

  useEffect(() => {
    const endpoint =
      selectedType === "book"
        ? "books"
        : selectedType === "video"
          ? videoSource
          : selectedType === "game"
            ? "games"
            : null;
    const sourceName =
      selectedType === "book"
        ? "book catalogs"
        : selectedType === "video"
          ? videoSource === "dramas"
            ? "drama catalogs"
            : videoSource === "films"
              ? "film catalogs"
              : "anime catalogs"
          : "SteamGridDB and VNDB";
    if (!endpoint || query.trim().length < 2) {
      setSourceResults([]);
      setSourceError(null);
      setSourceLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSourceLoading(true);
      setSourceError(null);
      try {
        const response = await apiFetch(`/api/search/${endpoint}?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as { data?: MediaItem[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? `${sourceName} failed`);
        setSourceResults(payload.data ?? []);
      } catch (error) {
        if (controller.signal.aborted) return;
        setSourceError(error instanceof Error ? error.message : `${sourceName} failed`);
        setSourceResults([]);
      } finally {
        if (!controller.signal.aborted) setSourceLoading(false);
      }
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, selectedType, videoSource]);
  const quickTargets = useMemo(() => {
    const normalized = quickTargetQuery.trim().toLowerCase();
    return records
      .filter(() => normalized.length > 0)
      .filter((item) => {
        return `${item.title} ${item.creator}`.toLowerCase().includes(normalized);
      })
      .slice(0, 6);
  }, [quickTargetQuery, records]);
  const selectedNotes = notes.filter((note) => note.contentId === selectedItem?.id);
  const selectedExperiences = experiences.filter(
    (experience) => experience.contentId === selectedItem?.id,
  );

  async function saveNoteToContent() {
    if (!selectedItem) return;

    const now = new Date().toISOString();
    const draft = {
      contentId: selectedItem.id,
      kind: noteKind,
      title: draftTitle.trim() || `${noteKind} note`,
      body: draftBody,
    };

    setSaveError(null);
    setPendingAction("note");
    let createdExperience: ContentExperience | null = null;
    try {
      let experience =
        experienceMode === "current"
          ? selectedExperiences.find((entry) => entry.status === "in_progress") ??
            selectedExperiences[0]
          : undefined;

      if (!experience) {
        const experienceResponse = await apiFetch("/api/experiences", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contentId: selectedItem.id, status: draftStatus }),
        });
        const experiencePayload = (await experienceResponse.json()) as {
          data?: ContentExperience;
          error?: string;
        };
        if (!experienceResponse.ok || !experiencePayload.data) {
          throw new Error(experiencePayload.error ?? "Unable to create reading round");
        }
        experience = experiencePayload.data;
        createdExperience = experience;
      }

      const response = await apiFetch("/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...draft, experienceId: experience.id }),
      });
      const payload = (await response.json()) as { data?: ContentNote; error?: string };
      if (!response.ok || !payload.data) {
        setSaveError(payload.error ?? "Unable to save note");
        setApiStatus("unavailable");
        return;
      }

      const note = payload.data;
      setNotes((current) => [note, ...current]);
      if (createdExperience) {
        setExperiences((current) => [createdExperience!, ...current]);
      }
      setRecords((current) =>
        current.map((item) =>
          item.id === selectedItem.id ? { ...item, updatedAt: now } : item,
        ),
      );
      setSelectedItem((current) => (current ? { ...current, updatedAt: now } : current));
      setLastSavedNoteId(note.id);
      setDraftTitle("");
      setDraftBody("");
      setExperienceMode("current");
      showConfirmation(`Note saved to ${selectedItem.title}`);
    } catch (error) {
      if (createdExperience) {
        await apiFetch(`/api/experiences/${encodeURIComponent(createdExperience.id)}`, {
          method: "DELETE",
        }).catch(() => undefined);
      }
      setSaveError(error instanceof Error ? error.message : "Unable to save note");
    } finally {
      setPendingAction(null);
    }
  }

  async function addImportCandidate() {
    if (!importCandidate) return;
    setSaveError(null);
    setPendingAction("content");
    try {
      const response = await apiFetch("/api/media", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(importCandidate),
      });
      const payload = (await response.json()) as { data?: MediaItem; error?: string };
      if (!response.ok || !payload.data) {
        setSaveError(payload.error ?? "Unable to add content");
        return;
      }
      setRecords((current) => [payload.data!, ...current.filter((item) => item.id !== payload.data!.id)]);
      setImportCandidate(payload.data);
      showConfirmation(`${payload.data.title} added to Library`);
    } catch {
      setSaveError("Unable to add content");
    } finally {
      setPendingAction(null);
    }
  }

  async function updateLibraryItem(id: string, changes: Partial<MediaItem>): Promise<boolean> {
    setSaveError(null);
    setPendingAction("library");
    try {
      const response = await apiFetch(`/api/media/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(changes),
      });
      const payload = (await response.json()) as { data?: MediaItem; error?: string };
      if (!response.ok || !payload.data) {
        setSaveError(payload.error ?? "Unable to update content");
        return false;
      }
      setRecords((current) => current.map((item) => (item.id === id ? payload.data! : item)));
      setEditingItem(payload.data);
      setSelectedItem((current) => (current?.id === id ? payload.data! : current));
      showConfirmation(`${payload.data.title} saved`);
      return true;
    } catch {
      setSaveError("Unable to update content");
      return false;
    } finally {
      setPendingAction(null);
    }
  }

  async function deleteLibraryItem(id: string): Promise<boolean> {
    setSaveError(null);
    setPendingAction("delete");
    try {
      const response = await apiFetch(`/api/media/${encodeURIComponent(id)}`, { method: "DELETE" });
      const payload = (await response.json()) as { data?: { id: string }; error?: string };
      if (!response.ok || !payload.data?.id) {
        setSaveError(payload.error ?? "Unable to delete content");
        return false;
      }
      setRecords((current) => current.filter((item) => item.id !== id));
      setNotes((current) => current.filter((note) => note.contentId !== id));
      setEditingItem((current) => (current?.id === id ? null : current));
      setSelectedItem((current) => (current?.id === id ? null : current));
      showConfirmation("Content removed from Library");
      return true;
    } catch {
      setSaveError("Unable to delete content");
      return false;
    } finally {
      setPendingAction(null);
    }
  }

  async function login(email: string, password: string) {
    const response = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) return payload.error ?? "Unable to sign in";
    setAuthStatus("signed_in");
    return null;
  }

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setAuthStatus("signed_out");
  }

  if (authStatus !== "signed_in") {
    return <LoginPanel checking={authStatus === "checking"} onLogin={login} />;
  }

  return (
    <main className="min-h-screen bg-paper px-3 py-4 text-ink sm:px-5 lg:px-7">
      <div className="mx-auto flex max-w-[1480px] flex-col gap-4">
        <header className="flex items-center justify-between gap-3 border-b border-line/70 pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              aria-label="Back to shelf"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-line bg-panel shadow-sm transition hover:-translate-y-0.5"
              href="/"
            >
              <Library size={20} />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate font-serif text-2xl font-semibold leading-none sm:text-3xl">
                Admin
              </h1>
              <p className="mt-1 truncate text-sm text-muted">
                {apiStatus === "connected"
                  ? "Database connected"
                  : apiStatus === "loading"
                    ? "Connecting to database..."
                    : "Using sample data - database unavailable"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <button
              className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-panel px-3 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5"
              type="button"
              onClick={logout}
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
            <nav className="flex gap-2 overflow-x-auto rounded-lg border border-line bg-panel p-2 shadow-sm lg:grid">
              <SectionButton
                active={activeSection === "writing"}
                icon={<PenLine size={17} />}
                label="Quick writing"
                onClick={() => setActiveSection("writing")}
              />
              <SectionButton
                active={activeSection === "content"}
                icon={<Search size={17} />}
                label="Add content"
                onClick={() => setActiveSection("content")}
              />
              <SectionButton
                active={activeSection === "library"}
                icon={<Library size={17} />}
                label="Library"
                onClick={() => setActiveSection("library")}
              />
            </nav>

            <div className="mt-3 hidden rounded-lg border border-line bg-panel p-3 shadow-sm lg:block">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Review target
              </p>
              <p className="mt-2 line-clamp-2 font-serif text-xl font-semibold">
                {selectedItem?.title ?? "Unassigned"}
              </p>
              <p className="mt-1 text-sm text-muted">{selectedItem?.creator ?? "Choose later"}</p>
            </div>
          </aside>

          <section
            className={cn(
              "grid gap-4",
              activeSection === "writing" ? "xl:grid-cols-[minmax(0,1fr)_320px]" : "",
            )}
          >
            <div className="min-w-0">
              {activeSection === "writing" ? (
                <WritingWorkspace
                  body={draftBody}
                  experienceMode={experienceMode}
                  experienceStatus={draftStatus}
                  hasCurrentExperience={selectedExperiences.length > 0}
                  noteKind={noteKind}
                  quickTargetQuery={quickTargetQuery}
                  quickTargets={quickTargets}
                  selectedItem={selectedItem}
                  title={draftTitle}
                  onBodyChange={setDraftBody}
                  onExperienceModeChange={setExperienceMode}
                  onExperienceStatusChange={setDraftStatus}
                  onSaveNote={saveNoteToContent}
                  saving={pendingAction === "note"}
                  onNoteKindChange={setNoteKind}
                  onQuickTargetQueryChange={setQuickTargetQuery}
                  onSelectTarget={(item) => {
                    setSelectedItem(item);
                    setDraftStatus(item.status === "planned" ? "in_progress" : item.status);
                    setExperienceMode("new");
                  }}
                  onTitleChange={setDraftTitle}
                />
              ) : null}

              {activeSection === "content" ? (
                <ContentWorkspace
                  candidate={importCandidate}
                  query={query}
                  results={searchResults}
                  sourceError={sourceError}
                  sourceLoading={sourceLoading}
                  selectedType={selectedType}
                  videoSource={videoSource}
                  onVideoSourceChange={(source) => {
                    setVideoSource(source);
                    setImportCandidate(null);
                  }}
                  onAddCandidate={addImportCandidate}
                  saving={pendingAction === "content"}
                  onCandidateChange={setImportCandidate}
                  onQueryChange={setQuery}
                  onSelectItem={(item) => {
                    setImportCandidate(item);
                  }}
                  onTypeChange={(type) => {
                    setSelectedType(type);
                    setImportCandidate(null);
                  }}
                />
              ) : null}

              {activeSection === "library" ? (
                <LibraryWorkspace
                  editingItem={editingItem}
                  records={records}
                  onDelete={deleteLibraryItem}
                  onEdit={setEditingItem}
                  onUpdate={updateLibraryItem}
                />
              ) : null}
            </div>

            {activeSection === "writing" ? (
              <PreviewPanel
                body={draftBody}
                lastSavedNoteId={lastSavedNoteId}
                noteKind={noteKind}
                notes={selectedNotes}
                selectedItem={selectedItem}
                title={draftTitle}
              />
            ) : null}
            {saveError ? (
              <p className="rounded-md border border-red-700/30 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200">
                {saveError}
              </p>
            ) : null}
          </section>
        </div>
      </div>
      <SaveConfirmation notice={confirmation} />
    </main>
  );
}

function LoginPanel({
  checking,
  onLogin,
}: {
  checking: boolean;
  onLogin: (email: string, password: string) => Promise<string | null>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const message = await onLogin(email, password);
    if (message) setError(message);
    setLoading(false);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-4 py-10 text-ink">
      <form
        className="w-full max-w-sm rounded-lg border border-line bg-panel p-5 shadow-[0_28px_70px_rgba(var(--shadow),0.14)]"
        onSubmit={submit}
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-md border border-line bg-paper">
            <Lock size={20} />
          </div>
          <div>
            <h1 className="font-serif text-3xl font-semibold leading-none">Admin</h1>
            <p className="mt-1 text-sm text-muted">Hidden workspace</p>
          </div>
        </div>

        <label className="grid gap-1.5 text-sm font-semibold">
          Email
          <input
            autoComplete="email"
            className="h-11 rounded-md border border-line bg-paper px-3 text-sm outline-none focus:border-ink"
            disabled={checking || loading}
            placeholder="you@example.com"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="mt-4 grid gap-1.5 text-sm font-semibold">
          Password
          <input
            autoComplete="current-password"
            className="h-11 rounded-md border border-line bg-paper px-3 text-sm outline-none focus:border-ink"
            disabled={checking || loading}
            placeholder="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error ? (
          <p className="mt-4 rounded-md border border-red-700/30 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <button
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-paper transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
          disabled={checking || loading || !email || !password}
          type="submit"
        >
          <Lock size={16} />
          {checking ? "Checking session..." : loading ? "Signing in..." : "Enter workspace"}
        </button>
        <Link className="mt-4 block text-center text-sm text-muted underline-offset-4 hover:text-ink hover:underline" href="/reset-password">
          Forgot password?
        </Link>
      </form>
    </main>
  );
}

function SectionButton({
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
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-left text-sm font-semibold transition",
        active ? "bg-ink text-paper" : "text-muted hover:bg-paper hover:text-ink",
      )}
      type="button"
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

function SaveConfirmation({ notice }: { notice: { id: number; message: string } | null }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-5 z-[120] flex justify-center px-4 sm:justify-end sm:px-6"
    >
      <AnimatePresence mode="wait">
        {notice ? (
          <motion.div
            key={notice.id}
            className="relative flex min-w-[250px] items-center gap-3 overflow-hidden rounded-md border border-[#46765b]/40 bg-panel px-4 py-3 text-sm font-semibold text-ink shadow-[0_16px_45px_rgba(0,0,0,0.18)]"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 430, damping: 30 }}
          >
            <motion.span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#46765b] text-white"
              initial={{ scale: 0.45, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.08, type: "spring", stiffness: 520, damping: 24 }}
            >
              <CheckCircle2 size={18} />
            </motion.span>
            <span>{notice.message}</span>
            <motion.span
              className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-[#46765b]"
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 2.6, ease: "linear" }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function WritingWorkspace({
  body,
  experienceMode,
  experienceStatus,
  hasCurrentExperience,
  noteKind,
  quickTargetQuery,
  quickTargets,
  selectedItem,
  title,
  onBodyChange,
  onExperienceModeChange,
  onExperienceStatusChange,
  onNoteKindChange,
  onQuickTargetQueryChange,
  onSaveNote,
  onSelectTarget,
  onTitleChange,
  saving,
}: {
  body: string;
  experienceMode: "new" | "current";
  experienceStatus: ExperienceStatus;
  hasCurrentExperience: boolean;
  noteKind: NoteKind;
  quickTargetQuery: string;
  quickTargets: MediaItem[];
  selectedItem: MediaItem | null;
  title: string;
  onBodyChange: (value: string) => void;
  onExperienceModeChange: (value: "new" | "current") => void;
  onExperienceStatusChange: (value: ExperienceStatus) => void;
  onNoteKindChange: (value: NoteKind) => void;
  onQuickTargetQueryChange: (value: string) => void;
  onSaveNote: () => void;
  onSelectTarget: (item: MediaItem) => void;
  onTitleChange: (value: string) => void;
  saving: boolean;
}) {
  return (
    <div className="rounded-lg border border-line bg-panel shadow-sm">
      <div className="flex flex-col gap-3 border-b border-line/70 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-3xl font-semibold leading-none">Add note</h2>
          <p className="mt-1 text-sm text-muted">
            Start blank. Attach it when you know where it belongs.
          </p>
        </div>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-paper transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
          disabled={saving || !selectedItem || !body.trim()}
          type="button"
          onClick={onSaveNote}
        >
          {saving ? <LoaderCircle className="animate-spin" size={16} /> : <Check size={16} />}
          {saving ? "Saving..." : "Save to reviews"}
        </button>
      </div>

      <div className="grid gap-3 p-4">
        <div className="rounded-md border border-line bg-paper p-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
            <label className="grid gap-1.5 text-sm font-semibold">
              Attach to content
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                <input
                  className="h-10 w-full rounded-md border border-line bg-panel pl-9 pr-3 text-sm outline-none focus:border-ink"
                  placeholder="Search existing content"
                  value={quickTargetQuery}
                  onChange={(event) => onQuickTargetQueryChange(event.target.value)}
                />
              </div>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Note type
              <select
                className="h-10 rounded-md border border-line bg-panel px-3 text-sm outline-none focus:border-ink"
                value={noteKind}
                onChange={(event) => onNoteKindChange(event.target.value as NoteKind)}
              >
                <option value="review">Review</option>
                <option value="excerpt">Excerpt</option>
                <option value="thought">Thought</option>
              </select>
            </label>
          </div>
          {quickTargetQuery.trim() ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {quickTargets.map((item) => (
                <button
                  key={item.id}
                  className={cn(
                    "grid grid-cols-[34px_minmax(0,1fr)] items-center gap-2 rounded-md border p-2 text-left transition hover:border-ink",
                    selectedItem?.id === item.id ? "border-ink bg-panel" : "border-line bg-panel/70",
                  )}
                  type="button"
                  onClick={() => onSelectTarget(item)}
                >
                  <AdminThumb item={item} small />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{item.title}</span>
                    <span className="block truncate text-xs text-muted">{item.creator}</span>
                  </span>
                </button>
              ))}
              {quickTargets.length === 0 ? (
                <p className="rounded-md border border-line bg-panel p-3 text-sm text-muted">
                  No matching content yet. Add it from Add content first.
                </p>
              ) : null}
            </div>
          ) : null}
          {selectedItem ? (
            <div className="mt-3 flex flex-col gap-3 border-t border-line/70 pt-3 sm:flex-row sm:items-end">
              <div className="grid flex-1 gap-1.5 text-sm font-semibold">
                Reading round
                <div className="flex w-fit rounded-md border border-line bg-panel p-1">
                  <button
                    className={cn(
                      "h-8 rounded px-3 text-xs font-semibold transition",
                      experienceMode === "new" ? "bg-ink text-paper" : "text-muted hover:text-ink",
                    )}
                    type="button"
                    onClick={() => onExperienceModeChange("new")}
                  >
                    Start new
                  </button>
                  <button
                    className={cn(
                      "h-8 rounded px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
                      experienceMode === "current" ? "bg-ink text-paper" : "text-muted hover:text-ink",
                    )}
                    disabled={!hasCurrentExperience}
                    type="button"
                    onClick={() => onExperienceModeChange("current")}
                  >
                    Current round
                  </button>
                </div>
              </div>
              {experienceMode === "new" ? (
                <label className="grid gap-1.5 text-sm font-semibold sm:w-44">
                  Round status
                  <select
                    className="h-10 rounded-md border border-line bg-panel px-3 text-sm outline-none focus:border-ink"
                    value={experienceStatus}
                    onChange={(event) =>
                      onExperienceStatusChange(event.target.value as ExperienceStatus)
                    }
                  >
                    <option value="in_progress">In progress</option>
                    <option value="finished">Finished</option>
                    <option value="dropped">Dropped</option>
                  </select>
                </label>
              ) : (
                <p className="pb-2 text-xs text-muted">This note stays with the latest round.</p>
              )}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1.5 text-sm font-semibold">
            Note title
            <input
              className="h-11 rounded-md border border-line bg-paper px-3 text-sm outline-none focus:border-ink"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
            />
          </label>
        </div>

        <textarea
          className="min-h-[620px] resize-y rounded-md border border-line/80 bg-paper p-5 font-serif text-[20px] leading-9 outline-none focus:border-ink"
          value={body}
          onChange={(event) => onBodyChange(event.target.value)}
        />
      </div>
    </div>
  );
}

function ContentWorkspace({
  candidate,
  query,
  results,
  sourceError,
  sourceLoading,
  selectedType,
  videoSource,
  onVideoSourceChange,
  onAddCandidate,
  onCandidateChange,
  onQueryChange,
  onSelectItem,
  onTypeChange,
  saving,
}: {
  candidate: MediaItem | null;
  query: string;
  results: MediaItem[];
  sourceError: string | null;
  sourceLoading: boolean;
  selectedType: MediaType;
  videoSource: "anime" | "dramas" | "films";
  onVideoSourceChange: (source: "anime" | "dramas" | "films") => void;
  onAddCandidate: () => void;
  onCandidateChange: (item: MediaItem | null) => void;
  onQueryChange: (value: string) => void;
  onSelectItem: (item: MediaItem) => void;
  onTypeChange: (value: MediaType) => void;
  saving: boolean;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-line bg-panel shadow-sm xl:max-h-[calc(100vh-7.5rem)] xl:min-h-[520px]">
      <div className="border-b border-line/70 p-4">
        <h2 className="font-serif text-3xl font-semibold leading-none">Add content</h2>
        <p className="mt-1 text-sm text-muted">Search metadata, then refine manually.</p>
      </div>

      <div className="grid gap-4 p-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
        <div className="flex min-h-0 flex-col gap-4 rounded-md border border-line bg-paper p-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {typeOptions.map((option) => (
              <button
                key={option.value}
                className={cn(
                  "inline-flex h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition",
                  selectedType === option.value
                    ? "border-ink bg-ink text-paper"
                    : "border-line bg-panel text-muted hover:text-ink",
                )}
                type="button"
                onClick={() => onTypeChange(option.value)}
              >
                {option.icon}
                {option.label}
              </button>
            ))}
          </div>

          <label className="grid gap-1.5 text-sm font-semibold">
            Search source
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={17} />
              <input
                className="h-12 w-full rounded-md border border-line bg-panel pl-10 pr-3 text-sm outline-none focus:border-ink"
                placeholder={
                  selectedType === "book"
                    ? "English or Japanese title, author, or ISBN"
                    : selectedType === "video"
                      ? videoSource === "dramas"
                        ? "Japanese, Korean or English drama title"
                        : videoSource === "films"
                          ? "Film or series title"
                          : "Japanese or English anime title"
                      : selectedType === "game"
                        ? "Game title or VNDB id"
                        : "Title or creator"
                }
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
              />
            </div>
          </label>

          {selectedType === "book" ? (
            <p className="text-xs text-muted">
              Japanese metadata comes from{" "}
              <a className="underline underline-offset-2" href="https://books.rakuten.co.jp/" rel="noreferrer" target="_blank">
                Rakuten Books
              </a>
              , with{" "}
              <a className="underline underline-offset-2" href="https://ndlsearch.ndl.go.jp/" rel="noreferrer" target="_blank">
                NDL Search
              </a>
              {" "}as fallback. English metadata comes from Google Books or Open Library. Missing covers can use a generated placeholder.
            </p>
          ) : null}
          {selectedType === "video" ? (
            <div className="grid gap-2">
              <div className="inline-flex w-fit rounded-full border border-line bg-panel p-0.5 text-xs font-semibold" role="group" aria-label="Video catalog">
                {([
                  ["anime", "Anime"],
                  ["dramas", "J/K-drama"],
                  ["films", "Film / TV"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={videoSource === value}
                    className={cn(
                      "rounded-full px-3 py-1 transition-colors",
                      videoSource === value ? "bg-ink text-paper" : "text-muted hover:text-ink",
                    )}
                    onClick={() => onVideoSourceChange(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted">
                {videoSource === "dramas" ? (
                  <>Japanese and Korean dramas from TVmaze (titles in their original language), plus TMDB when a TMDB key is set.</>
                ) : videoSource === "films" ? (
                  <>Films and TV series from the iTunes catalog.</>
                ) : (
                  <>
                    Anime metadata and cover art provided by{" "}
                    <a className="underline underline-offset-2" href="https://jikan.moe/" rel="noreferrer" target="_blank">
                      Jikan / MyAnimeList
                    </a>
                    , with AniList as a fallback.
                  </>
                )}
              </p>
            </div>
          ) : null}
          {selectedType === "game" ? (
            <p className="text-xs text-muted">
              Game artwork provided by{" "}
              <a className="underline underline-offset-2" href="https://www.steamgriddb.com/" rel="noreferrer" target="_blank">
                SteamGridDB
              </a>
              , with visual novel metadata from{" "}
              <a className="underline underline-offset-2" href="https://vndb.org/" rel="noreferrer" target="_blank">
                VNDB
              </a>
              . Confirm the platform and developer before adding a game.
            </p>
          ) : null}

          <div className="grid max-h-[26rem] content-start gap-2 overflow-y-auto pr-1 xl:max-h-none xl:min-h-0 xl:flex-1">
            {sourceLoading ? (
              <div className="rounded-md border border-line bg-panel p-4 text-sm text-muted">
                Searching{" "}
                {selectedType === "book"
                  ? "book catalogs"
                  : selectedType === "video"
                    ? videoSource === "dramas"
                      ? "drama catalogs"
                      : videoSource === "films"
                        ? "film catalogs"
                        : "anime catalogs"
                    : "SteamGridDB and VNDB"}
                ...
              </div>
            ) : null}
            {sourceError ? (
              <div className="rounded-md border border-red-700/30 bg-red-500/10 p-4 text-sm text-red-800 dark:text-red-200">
                {sourceError}
              </div>
            ) : null}
            {results.map((item) => (
              <button
                key={item.id}
                className={cn(
                  "grid grid-cols-[48px_minmax(0,1fr)] gap-3 rounded-md border p-3 text-left transition hover:-translate-y-0.5 hover:border-ink",
                  candidate?.id === item.id ? "border-ink bg-panel" : "border-line bg-panel/70",
                )}
                type="button"
                onClick={() => onSelectItem(item)}
              >
                <AdminThumb item={item} />
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{item.title}</p>
                      <p className="truncate text-sm text-muted">{item.creator}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-line px-2 py-1 text-xs font-semibold capitalize text-muted">
                      {item.type}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-muted">
                    {[item.sourceName, item.publisher, item.isbn, item.subtype].filter(Boolean).join(" · ") || item.status.replace("_", " ")}
                  </p>
                </div>
              </button>
            ))}
            {results.length === 0 && !sourceLoading && !sourceError ? (
              <div className="rounded-md border border-line bg-panel p-4 text-sm text-muted">
                No matching source result. Create it manually.
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col rounded-md border border-line bg-paper xl:min-h-0">
          <div className="border-b border-line/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Import draft
            </p>
            <h3 className="mt-2 font-serif text-2xl font-semibold">
              {candidate?.title ?? "No candidate selected"}
            </h3>
          </div>

          {candidate ? (
            <div className="grid gap-4 p-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
              <div className="flex items-start gap-4">
                <AdminThumb item={candidate} />
                <div className="min-w-0">
                  <p className="font-semibold">{candidate.title}</p>
                  <p className="text-sm text-muted">{candidate.creator}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                    {candidate.type}
                  </p>
                  {candidate.publisher ? <p className="mt-2 text-sm text-muted">{candidate.publisher}</p> : null}
                  {candidate.isbn ? <p className="text-sm text-muted">ISBN {candidate.isbn}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {candidate.sourceUrl ? (
                      <a className="inline-flex h-9 items-center rounded-md border border-line bg-panel px-3 text-sm font-semibold transition hover:-translate-y-0.5 hover:border-ink" href={candidate.sourceUrl} rel="noreferrer" target="_blank">
                        View {candidate.sourceName || "source"} record
                      </a>
                    ) : null}
                    {candidate.type === "book" ? (
                      <button
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-panel px-3 text-sm font-semibold transition hover:-translate-y-0.5 hover:border-ink"
                        type="button"
                        onClick={() => onCandidateChange(generateCover(candidate))}
                      >
                        <Sparkles size={15} />
                        Generate cover
                      </button>
                    ) : null}
                  </div>
                  {candidate.type === "book" ? (
                    <p className="mt-2 text-xs text-muted">Generated covers are placeholders, not official publisher artwork.</p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-semibold sm:col-span-2">
                  Title
                  <input
                    className="h-10 rounded-md border border-line bg-panel px-3 text-sm outline-none focus:border-ink"
                    value={candidate.title}
                    onChange={(event) => onCandidateChange({ ...candidate, title: event.target.value })}
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-semibold">
                  Creator
                  <input
                    className="h-10 rounded-md border border-line bg-panel px-3 text-sm outline-none focus:border-ink"
                    value={candidate.creator}
                    onChange={(event) => onCandidateChange({ ...candidate, creator: event.target.value })}
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-semibold">
                  Status
                  <select
                    className="h-10 rounded-md border border-line bg-panel px-3 text-sm outline-none focus:border-ink"
                    value={candidate.status}
                    onChange={(event) =>
                      onCandidateChange({ ...candidate, status: event.target.value as MediaStatus })
                    }
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                {candidate.type === "game" ? (
                  <label className="grid gap-1.5 text-sm font-semibold">
                    Platform
                    <select
                      className="h-10 rounded-md border border-line bg-panel px-3 text-sm outline-none focus:border-ink"
                      value={candidate.platformFamily ?? "pc"}
                      onChange={(event) => onCandidateChange({
                        ...candidate,
                        platformFamily: event.target.value as GamePlatformFamily,
                      })}
                    >
                      {platformOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="grid flex-1 place-items-center p-6 text-center text-sm text-muted">
              Pick a source result, or create a blank content record.
            </div>
          )}

          <div className="flex flex-col gap-2 border-t border-line/70 p-3 sm:flex-row sm:justify-end">
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line bg-panel px-4 text-sm font-semibold transition hover:-translate-y-0.5"
              type="button"
              onClick={() => onCandidateChange(createBlankMediaItem(selectedType))}
            >
              <Plus size={16} />
              Create blank
            </button>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-paper transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
              disabled={saving || !candidate?.title.trim() || !candidate.creator.trim()}
              type="button"
              onClick={onAddCandidate}
            >
              {saving ? <LoaderCircle className="animate-spin" size={16} /> : <Check size={16} />}
              {saving ? "Adding..." : "Add to library"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function createBlankMediaItem(type: MediaType): MediaItem {
  return {
    id: `draft-${crypto.randomUUID()}`,
    type,
    title: "",
    creator: "",
    status: "planned",
    updatedAt: new Date().toISOString(),
    coverTone: generatedCoverPalettes[0],
    platformFamily: type === "game" ? "pc" : undefined,
  };
}

function generateCover(item: MediaItem): MediaItem {
  const currentIndex = generatedCoverPalettes.findIndex(
    ([first, second]) => first === item.coverTone[0] && second === item.coverTone[1],
  );
  const seed = `${item.title}:${item.creator}`
    .split("")
    .reduce((total, character) => total + character.codePointAt(0)!, 0);
  const nextIndex = currentIndex >= 0
    ? (currentIndex + 1) % generatedCoverPalettes.length
    : seed % generatedCoverPalettes.length;

  return {
    ...item,
    coverUrl: undefined,
    coverTone: generatedCoverPalettes[nextIndex],
  };
}

function LibraryWorkspace({
  editingItem,
  records: allRecords,
  onDelete,
  onEdit,
  onUpdate,
}: {
  editingItem: MediaItem | null;
  records: MediaItem[];
  onDelete: (id: string) => Promise<boolean>;
  onEdit: (item: MediaItem | null) => void;
  onUpdate: (id: string, changes: Partial<MediaItem>) => Promise<boolean>;
}) {
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryType, setLibraryType] = useState<MediaType | "all">("all");
  const [libraryStatus, setLibraryStatus] = useState<MediaStatus | "all">("all");
  const [libraryPage, setLibraryPage] = useState(1);

  const filteredRecords = useMemo(() => {
    const normalized = libraryQuery.trim().toLowerCase();
    return allRecords
      .filter((item) => libraryType === "all" || item.type === libraryType)
      .filter((item) => libraryStatus === "all" || item.status === libraryStatus)
      .filter((item) => {
        if (!normalized) return true;
        return `${item.title} ${item.creator}`.toLowerCase().includes(normalized);
      });
  }, [allRecords, libraryQuery, libraryStatus, libraryType]);
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / libraryPageSize));
  const safePage = Math.min(libraryPage, totalPages);
  const records = filteredRecords.slice(
    (safePage - 1) * libraryPageSize,
    safePage * libraryPageSize,
  );
  const pageStart = filteredRecords.length === 0 ? 0 : (safePage - 1) * libraryPageSize + 1;
  const pageEnd = Math.min(safePage * libraryPageSize, filteredRecords.length);

  function resetPage() {
    setLibraryPage(1);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-lg border border-line bg-panel shadow-sm">
        <div className="border-b border-line/70 p-4">
          <h2 className="font-serif text-3xl font-semibold leading-none">Library</h2>
          <p className="mt-1 text-sm text-muted">Review and maintain existing content records.</p>
        </div>

        <div className="grid gap-3 border-b border-line/70 p-3 lg:grid-cols-[minmax(0,1fr)_160px_170px]">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input
              className="h-10 w-full rounded-md border border-line bg-paper pl-9 pr-3 text-sm outline-none focus:border-ink"
              placeholder="Search title or creator"
              value={libraryQuery}
              onChange={(event) => {
                setLibraryQuery(event.target.value);
                resetPage();
              }}
            />
          </label>
          <select
            className="h-10 rounded-md border border-line bg-paper px-3 text-sm font-semibold outline-none focus:border-ink"
            value={libraryType}
            onChange={(event) => {
              setLibraryType(event.target.value as MediaType | "all");
              resetPage();
            }}
          >
            <option value="all">All types</option>
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-line bg-paper px-3 text-sm font-semibold outline-none focus:border-ink"
            value={libraryStatus}
            onChange={(event) => {
              setLibraryStatus(event.target.value as MediaStatus | "all");
              resetPage();
            }}
          >
            <option value="all">All status</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2 overflow-y-auto p-3 md:hidden">
          {records.map((item) => (
            <button
              key={item.id}
              className={cn(
                "grid grid-cols-[52px_minmax(0,1fr)] gap-3 rounded-md border bg-paper p-3 text-left transition hover:border-ink",
                editingItem?.id === item.id ? "border-ink" : "border-line",
              )}
              type="button"
              onClick={() => onEdit(item)}
            >
            <AdminThumb item={item} />
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{item.title}</h3>
                  <p className="truncate text-sm text-muted">{item.creator}</p>
                </div>
                <span className="shrink-0 rounded-full border border-line px-2 py-1 text-xs font-semibold capitalize text-muted">
                  {item.type}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted">
                <div>
                  <p className="font-semibold text-ink">Status</p>
                  <p>{item.status.replace("_", " ")}</p>
                </div>
                <div>
                  <p className="font-semibold text-ink">Rating</p>
                  <p>{item.rating ? item.rating.toFixed(1) : "-"}</p>
                </div>
                <div>
                  <p className="font-semibold text-ink">Updated</p>
                  <p>{new Date(item.updatedAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
            </button>
          ))}
          {records.length === 0 ? <EmptyLibraryState /> : null}
        </div>

        <div className="hidden min-h-0 overflow-auto md:block">
          <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-panel">
            <tr className="border-b border-line text-left text-xs uppercase tracking-[0.14em] text-muted">
              <th className="px-4 py-3 font-semibold">Title</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Rating</th>
              <th className="px-4 py-3 font-semibold">Updated</th>
            </tr>
          </thead>
            <tbody>
              {records.map((item) => (
                <tr
                  key={item.id}
                  className={cn(
                    "cursor-pointer border-b border-line/70 transition hover:bg-paper",
                    editingItem?.id === item.id ? "bg-paper" : "",
                  )}
                  onClick={() => onEdit(item)}
                >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <AdminThumb item={item} small />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{item.title}</p>
                      <p className="truncate text-muted">{item.creator}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 capitalize">{item.type}</td>
                <td className="px-4 py-3">{item.status.replace("_", " ")}</td>
                <td className="px-4 py-3">{item.rating ? item.rating.toFixed(1) : "-"}</td>
                <td className="px-4 py-3">{new Date(item.updatedAt).toLocaleDateString()}</td>
              </tr>
              ))}
            </tbody>
          </table>
          {records.length === 0 ? <EmptyLibraryState /> : null}
        </div>

        <div className="flex flex-col gap-2 border-t border-line/70 p-3 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            {pageStart}-{pageEnd} of {filteredRecords.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="h-9 rounded-md border border-line bg-paper px-3 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40"
              disabled={safePage <= 1}
              type="button"
              onClick={() => setLibraryPage((page) => Math.max(1, page - 1))}
            >
              Previous
            </button>
            <span className="min-w-16 text-center font-semibold text-ink">
              {safePage} / {totalPages}
            </span>
            <button
              className="h-9 rounded-md border border-line bg-paper px-3 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40"
              disabled={safePage >= totalPages}
              type="button"
              onClick={() => setLibraryPage((page) => Math.min(totalPages, page + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <LibraryEditor item={editingItem} onDelete={onDelete} onUpdate={onUpdate} />
    </div>
  );
}

function EmptyLibraryState() {
  return (
    <div className="p-6 text-center text-sm text-muted">
      No records match the current filters.
    </div>
  );
}

function LibraryEditor({
  item,
  onDelete,
  onUpdate,
}: {
  item: MediaItem | null;
  onDelete: (id: string) => Promise<boolean>;
  onUpdate: (id: string, changes: Partial<MediaItem>) => Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const [creator, setCreator] = useState("");
  const [status, setStatus] = useState<MediaStatus>("planned");
  const [rating, setRating] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [featured, setFeatured] = useState(false);
  const [platformFamily, setPlatformFamily] = useState<GamePlatformFamily>("pc");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(item?.title ?? "");
    setCreator(item?.creator ?? "");
    setStatus(item?.status ?? "planned");
    setRating(item?.rating === undefined ? "" : String(item.rating));
    setFavorite(Boolean(item?.favorite));
    setFeatured(Boolean(item?.featured));
    setPlatformFamily(item?.platformFamily ?? "pc");
  }, [item]);

  async function save() {
    if (!item) return;
    setSaving(true);
    await onUpdate(item.id, {
      title,
      creator,
      status,
      rating: rating.trim() ? Number(rating) : undefined,
      favorite,
      featured,
      platformFamily: item.type === "game" ? platformFamily : undefined,
    });
    setSaving(false);
  }

  async function remove() {
    if (!item) return;
    const confirmed = window.confirm(`Delete "${item.title}"? This also deletes its notes.`);
    if (!confirmed) return;
    setSaving(true);
    await onDelete(item.id);
    setSaving(false);
  }

  return (
    <aside className="rounded-lg border border-line bg-panel shadow-sm xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)]">
      <div className="border-b border-line/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Edit content
        </p>
        <h3 className="mt-2 font-serif text-2xl font-semibold">
          {item?.title ?? "Select a record"}
        </h3>
      </div>

      {item ? (
        <div className="grid gap-3 p-4">
          <div className="flex items-start gap-3">
            <AdminThumb item={item} />
            <div className="min-w-0 text-sm text-muted">
              <p className="font-semibold capitalize text-ink">{item.type}</p>
              <p className="truncate">{item.id}</p>
            </div>
          </div>

          {item.type === "game" ? (
            <label className="grid gap-1.5 text-sm font-semibold">
              Platform
              <select
                className="h-10 rounded-md border border-line bg-paper px-3 text-sm outline-none focus:border-ink"
                value={platformFamily}
                onChange={(event) => setPlatformFamily(event.target.value as GamePlatformFamily)}
              >
                {platformOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="grid gap-1.5 text-sm font-semibold">
            Title
            <input
              className="h-10 rounded-md border border-line bg-paper px-3 text-sm outline-none focus:border-ink"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <label className="grid gap-1.5 text-sm font-semibold">
            Creator
            <input
              className="h-10 rounded-md border border-line bg-paper px-3 text-sm outline-none focus:border-ink"
              value={creator}
              onChange={(event) => setCreator(event.target.value)}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold">
              Status
              <select
                className="h-10 rounded-md border border-line bg-paper px-3 text-sm outline-none focus:border-ink"
                value={status}
                onChange={(event) => setStatus(event.target.value as MediaStatus)}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5 text-sm font-semibold">
              Rating
              <input
                className="h-10 rounded-md border border-line bg-paper px-3 text-sm outline-none focus:border-ink"
                inputMode="decimal"
                placeholder="-"
                value={rating}
                onChange={(event) => setRating(event.target.value)}
              />
            </label>
          </div>

          <label className="flex items-center gap-2 rounded-md border border-line bg-paper px-3 py-2 text-sm font-semibold">
            <input
              checked={favorite}
              type="checkbox"
              onChange={(event) => setFavorite(event.target.checked)}
            />
            Favorite
          </label>

          <label className="flex items-center gap-2 rounded-md border border-line bg-paper px-3 py-2 text-sm font-semibold">
            <input
              checked={featured}
              type="checkbox"
              onChange={(event) => setFeatured(event.target.checked)}
            />
            Current feature
          </label>

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-paper transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
              disabled={saving || !title.trim() || !creator.trim()}
              type="button"
              onClick={save}
            >
              {saving ? <LoaderCircle className="animate-spin" size={16} /> : <Check size={16} />}
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-700/30 bg-red-500/10 px-3 text-sm font-semibold text-red-800 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 dark:text-red-200"
              disabled={saving}
              type="button"
              onClick={remove}
            >
              <Trash2 size={16} />
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 text-sm text-muted">
          Select a record from Library to edit status, rating, and shelf flags.
        </div>
      )}
    </aside>
  );
}

function AdminThumb({ item, small = false }: { item: MediaItem; small?: boolean }) {
  // Real cover whenever the source has one (books, anime, films, games); otherwise the default printed cover.
  const square = item.type === "video" && item.subtype !== "movie" && !item.coverUrl;
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-[4px] border border-black/10 bg-paper shadow-sm",
        square ? (small ? "h-11 w-11" : "h-[52px] w-[52px]") : small ? "h-12 w-8" : "h-16 w-11",
      )}
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
    </div>
  );
}

function PreviewPanel({
  body,
  lastSavedNoteId,
  noteKind,
  notes,
  selectedItem,
  title,
}: {
  body: string;
  lastSavedNoteId: string | null;
  noteKind: NoteKind;
  notes: ContentNote[];
  selectedItem: MediaItem | null;
  title: string;
}) {
  return (
    <aside className="rounded-lg border border-line bg-panel p-4 shadow-sm xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        Attachment
      </p>
      {selectedItem ? (
        <>
          <h2 className="mt-3 font-serif text-2xl font-semibold leading-tight">
            {selectedItem.title}
          </h2>
          <p className="mt-2 text-sm text-muted">{selectedItem.creator}</p>
        </>
      ) : (
        <div className="mt-4 rounded-md border border-line bg-paper p-4 text-sm text-muted">
          Nothing attached yet.
        </div>
      )}

      <div className="mt-5 rounded-md border border-line bg-paper p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          {noteKind}
        </p>
        <h3 className="mb-2 font-semibold">{title || "Untitled note"}</h3>
        <p className="line-clamp-[10] whitespace-pre-wrap font-serif text-[16px] leading-7">
          {body || "Start writing..."}
        </p>
      </div>

      {selectedItem ? (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Saved notes
          </p>
          <div className="grid gap-2">
            {notes.length ? (
              notes.slice(0, 4).map((note) => (
                <div
                  key={note.id}
                  className={cn(
                    "rounded-md border bg-paper p-3 text-sm",
                    lastSavedNoteId === note.id ? "border-ink" : "border-line",
                  )}
                >
                  <p className="font-semibold">{note.title}</p>
                  <p className="mt-1 line-clamp-2 text-muted">{note.body}</p>
                </div>
              ))
            ) : (
              <p className="rounded-md border border-line bg-paper p-3 text-sm text-muted">
                No saved notes for this content yet.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
