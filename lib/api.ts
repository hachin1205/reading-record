import type {
  ContentExperience,
  ContentNote,
  ExperienceStatus,
  MediaItem,
  NoteKind,
} from "@/lib/types";

const mediaTypes = new Set(["book", "video", "game", "writing"]);
const mediaStatuses = new Set(["planned", "in_progress", "finished", "dropped"]);
const noteKinds = new Set<NoteKind>(["review", "excerpt", "thought"]);
const experienceStatuses = new Set<ExperienceStatus>(["in_progress", "finished", "dropped"]);

export function parseMedia(input: unknown): MediaItem {
  if (!input || typeof input !== "object") throw new Error("A media object is required");
  const value = input as Record<string, unknown>;
  if (typeof value.title !== "string" || !value.title.trim()) throw new Error("Title is required");
  if (typeof value.creator !== "string" || !value.creator.trim()) throw new Error("Creator is required");
  if (!mediaTypes.has(String(value.type))) throw new Error("Invalid media type");
  if (!mediaStatuses.has(String(value.status))) throw new Error("Invalid media status");
  if (!Array.isArray(value.coverTone) || value.coverTone.length !== 2) {
    throw new Error("coverTone must contain two colors");
  }

  return {
    ...value,
    id: crypto.randomUUID(),
    title: value.title.trim(),
    creator: value.creator.trim(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
    coverTone: [String(value.coverTone[0]), String(value.coverTone[1])],
  } as MediaItem;
}

export function parseMediaChanges(input: unknown): Partial<MediaItem> {
  if (!input || typeof input !== "object") throw new Error("A media object is required");
  const value = { ...(input as Record<string, unknown>) };
  delete value.id;
  if (value.type !== undefined && !mediaTypes.has(String(value.type))) throw new Error("Invalid media type");
  if (value.status !== undefined && !mediaStatuses.has(String(value.status))) throw new Error("Invalid media status");
  return value as Partial<MediaItem>;
}

export function parseNote(input: unknown): ContentNote {
  if (!input || typeof input !== "object") throw new Error("A note object is required");
  const value = input as Record<string, unknown>;
  if (typeof value.contentId !== "string" || !value.contentId) throw new Error("contentId is required");
  if (typeof value.body !== "string" || !value.body.trim()) throw new Error("Note body is required");
  if (!noteKinds.has(value.kind as NoteKind)) throw new Error("Invalid note kind");
  const now = new Date().toISOString();
  return {
    id: typeof value.id === "string" ? value.id : crypto.randomUUID(),
    contentId: value.contentId,
    experienceId: typeof value.experienceId === "string" ? value.experienceId : undefined,
    kind: value.kind as NoteKind,
    title: typeof value.title === "string" && value.title.trim() ? value.title.trim() : `${value.kind} note`,
    body: value.body,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : now,
  };
}

export function parseExperience(input: unknown): ContentExperience {
  if (!input || typeof input !== "object") throw new Error("An experience object is required");
  const value = input as Record<string, unknown>;
  if (typeof value.contentId !== "string" || !value.contentId) throw new Error("contentId is required");
  if (!experienceStatuses.has(value.status as ExperienceStatus)) {
    throw new Error("Invalid experience status");
  }
  const now = new Date().toISOString();
  const status = value.status as ExperienceStatus;
  return {
    id: typeof value.id === "string" ? value.id : crypto.randomUUID(),
    contentId: value.contentId,
    status,
    startedAt: typeof value.startedAt === "string" ? value.startedAt : now,
    finishedAt:
      typeof value.finishedAt === "string"
        ? value.finishedAt
        : status === "in_progress"
          ? undefined
          : now,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : now,
  };
}

export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  const status = message === "Unauthorized"
    ? 401
    : message === "Forbidden"
      ? 403
      : message.includes("Supabase server credentials")
        ? 503
        : 400;
  return Response.json({ error: message }, { status });
}
