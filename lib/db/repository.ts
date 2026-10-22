import { mediaItems } from "@/lib/sample-data";
import { supabaseRequest } from "@/lib/supabase/server";
import type { ContentExperience, ContentNote, MediaItem } from "@/lib/types";

type DatabaseMedia = {
  id: string;
  type: MediaItem["type"];
  subtype: MediaItem["subtype"] | null;
  title: string;
  creator: string;
  creator_group: string | null;
  creator_sort_label: string | null;
  status: MediaItem["status"];
  rating: number | null;
  finished_at: string | null;
  published_at: string | null;
  updated_at: string;
  page_count: number | null;
  progress_percent: number | null;
  target_finish_at?: string | null;
  progress_set_at?: string | null;
  completion_count: number | null;
  favorite: boolean;
  featured: boolean;
  cover_url: string | null;
  isbn: string | null;
  publisher: string | null;
  source_url: string | null;
  source_name: string | null;
  cover_tone: MediaItem["coverTone"];
  platform_family: MediaItem["platformFamily"] | null;
  note: string | null;
  theme_youtube_id: string | null;
  theme_start_seconds: number | null;
  theme_end_seconds: number | null;
  theme_title: string | null;
};

type DatabaseNote = {
  id: string;
  content_id: string;
  experience_id: string | null;
  kind: ContentNote["kind"];
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
};

type DatabaseExperience = {
  id: string;
  content_id: string;
  status: ContentExperience["status"];
  started_at: string;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

function removeNulls<T extends object>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== null)) as T;
}

function fromDatabaseMedia(row: DatabaseMedia): MediaItem {
  return removeNulls({
    id: row.id,
    type: row.type,
    subtype: row.subtype,
    title: row.title,
    creator: row.creator,
    creatorGroup: row.creator_group,
    creatorSortLabel: row.creator_sort_label,
    status: row.status,
    rating: row.rating,
    finishedAt: row.finished_at,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    pageCount: row.page_count,
    progressPercent: row.progress_percent,
    targetFinishAt: row.target_finish_at ?? undefined,
    progressSetAt: row.progress_set_at ?? undefined,
    completionCount: row.completion_count,
    favorite: row.favorite,
    featured: row.featured,
    coverUrl: row.cover_url,
    isbn: row.isbn,
    publisher: row.publisher,
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    coverTone: row.cover_tone,
    platformFamily: row.platform_family,
    note: row.note,
    themeYoutubeId: row.theme_youtube_id,
    themeStartSeconds: row.theme_start_seconds,
    themeEndSeconds: row.theme_end_seconds,
    themeTitle: row.theme_title,
  }) as MediaItem;
}

function toDatabaseMedia(item: Partial<MediaItem>) {
  return {
    ...(item.id !== undefined ? { id: item.id } : {}),
    ...(item.type !== undefined ? { type: item.type } : {}),
    ...(item.subtype !== undefined ? { subtype: item.subtype } : {}),
    ...(item.title !== undefined ? { title: item.title } : {}),
    ...(item.creator !== undefined ? { creator: item.creator } : {}),
    ...(item.creatorGroup !== undefined ? { creator_group: item.creatorGroup } : {}),
    ...(item.creatorSortLabel !== undefined ? { creator_sort_label: item.creatorSortLabel } : {}),
    ...(item.status !== undefined ? { status: item.status } : {}),
    ...(item.rating !== undefined ? { rating: item.rating } : {}),
    ...(item.finishedAt !== undefined ? { finished_at: item.finishedAt } : {}),
    ...(item.publishedAt !== undefined ? { published_at: item.publishedAt } : {}),
    ...(item.updatedAt !== undefined ? { updated_at: item.updatedAt } : {}),
    ...(item.pageCount !== undefined ? { page_count: item.pageCount } : {}),
    ...(item.progressPercent !== undefined ? { progress_percent: item.progressPercent } : {}),
    ...(item.targetFinishAt !== undefined ? { target_finish_at: item.targetFinishAt } : {}),
    ...(item.progressSetAt !== undefined ? { progress_set_at: item.progressSetAt } : {}),
    ...(item.completionCount !== undefined ? { completion_count: item.completionCount } : {}),
    ...(item.favorite !== undefined ? { favorite: item.favorite } : {}),
    ...(item.featured !== undefined ? { featured: item.featured } : {}),
    ...(item.coverUrl !== undefined ? { cover_url: item.coverUrl } : {}),
    ...(item.isbn !== undefined ? { isbn: item.isbn } : {}),
    ...(item.publisher !== undefined ? { publisher: item.publisher } : {}),
    ...(item.sourceUrl !== undefined ? { source_url: item.sourceUrl } : {}),
    ...(item.sourceName !== undefined ? { source_name: item.sourceName } : {}),
    ...(item.coverTone !== undefined ? { cover_tone: item.coverTone } : {}),
    ...(item.platformFamily !== undefined ? { platform_family: item.platformFamily } : {}),
    ...(item.note !== undefined ? { note: item.note } : {}),
    ...(item.themeYoutubeId !== undefined ? { theme_youtube_id: item.themeYoutubeId } : {}),
    ...(item.themeStartSeconds !== undefined ? { theme_start_seconds: item.themeStartSeconds } : {}),
    ...(item.themeEndSeconds !== undefined ? { theme_end_seconds: item.themeEndSeconds } : {}),
    ...(item.themeTitle !== undefined ? { theme_title: item.themeTitle } : {}),
  };
}

function fromDatabaseNote(row: DatabaseNote): ContentNote {
  return removeNulls({
    id: row.id,
    contentId: row.content_id,
    experienceId: row.experience_id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }) as ContentNote;
}

function fromDatabaseExperience(row: DatabaseExperience): ContentExperience {
  return removeNulls({
    id: row.id,
    contentId: row.content_id,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }) as ContentExperience;
}

export async function listMedia(): Promise<MediaItem[]> {
  let rows = await supabaseRequest<DatabaseMedia[]>("media?select=*&order=updated_at.desc");
  if (rows.length === 0 && process.env.SEED_SAMPLE_DATA === "true") {
    rows = [];
    for (const item of mediaItems) {
      const created = await supabaseRequest<DatabaseMedia[]>("media", {
        method: "POST",
        body: toDatabaseMedia(item),
        prefer: "return=representation,resolution=ignore-duplicates",
      });
      rows.push(...created);
    }
  }
  return rows.map(fromDatabaseMedia);
}

export async function createMedia(item: MediaItem): Promise<MediaItem> {
  const [created] = await supabaseRequest<DatabaseMedia[]>("media", {
    method: "POST",
    body: toDatabaseMedia(item),
    prefer: "return=representation",
  });
  return fromDatabaseMedia(created);
}

export async function updateMedia(id: string, changes: Partial<MediaItem>): Promise<MediaItem | null> {
  const rows = await supabaseRequest<DatabaseMedia[]>(`media?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: toDatabaseMedia({ ...changes, id: undefined, updatedAt: new Date().toISOString() }),
    prefer: "return=representation",
  });
  return rows[0] ? fromDatabaseMedia(rows[0]) : null;
}

export async function deleteMedia(id: string) {
  const rows = await supabaseRequest<Array<{ id: string }>>(
    `media?id=eq.${encodeURIComponent(id)}&select=id`,
    { method: "DELETE", prefer: "return=representation" },
  );
  return rows[0]?.id ?? null;
}

export async function listNotes(contentId?: string): Promise<ContentNote[]> {
  const filter = contentId ? `&content_id=eq.${encodeURIComponent(contentId)}` : "";
  const rows = await supabaseRequest<DatabaseNote[]>(`notes?select=*&order=created_at.desc${filter}`);
  return rows.map(fromDatabaseNote);
}

export async function createNote(note: ContentNote): Promise<ContentNote> {
  const [created] = await supabaseRequest<DatabaseNote[]>("notes", {
    method: "POST",
    body: {
      id: note.id,
      content_id: note.contentId,
      experience_id: note.experienceId,
      kind: note.kind,
      title: note.title,
      body: note.body,
      created_at: note.createdAt,
      updated_at: note.updatedAt,
    },
    prefer: "return=representation",
  });
  await updateMedia(note.contentId, { updatedAt: note.updatedAt });
  return fromDatabaseNote(created);
}

export async function updateNote(
  id: string,
  changes: Partial<Pick<ContentNote, "kind" | "title" | "body">>,
): Promise<ContentNote | null> {
  const now = new Date().toISOString();
  const rows = await supabaseRequest<DatabaseNote[]>(`notes?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: {
      ...(changes.kind !== undefined ? { kind: changes.kind } : {}),
      ...(changes.title !== undefined ? { title: changes.title } : {}),
      ...(changes.body !== undefined ? { body: changes.body } : {}),
      updated_at: now,
    },
    prefer: "return=representation",
  });
  if (!rows[0]) return null;
  const note = fromDatabaseNote(rows[0]);
  await updateMedia(note.contentId, { updatedAt: now });
  return note;
}

export async function listExperiences(contentId?: string): Promise<ContentExperience[]> {
  const filter = contentId ? `&content_id=eq.${encodeURIComponent(contentId)}` : "";
  const rows = await supabaseRequest<DatabaseExperience[]>(
    `experiences?select=*&order=started_at.desc${filter}`,
  );
  return rows.map(fromDatabaseExperience);
}

export async function createExperience(experience: ContentExperience): Promise<ContentExperience> {
  const [created] = await supabaseRequest<DatabaseExperience[]>("experiences", {
    method: "POST",
    body: {
      id: experience.id,
      content_id: experience.contentId,
      status: experience.status,
      started_at: experience.startedAt,
      finished_at: experience.finishedAt,
      created_at: experience.createdAt,
      updated_at: experience.updatedAt,
    },
    prefer: "return=representation",
  });
  return fromDatabaseExperience(created);
}

export async function deleteExperience(id: string) {
  const rows = await supabaseRequest<Array<{ id: string }>>(
    `experiences?id=eq.${encodeURIComponent(id)}&select=id`,
    { method: "DELETE", prefer: "return=representation" },
  );
  return rows[0]?.id ?? null;
}

export async function deleteNote(id: string) {
  const rows = await supabaseRequest<Array<{ id: string }>>(
    `notes?id=eq.${encodeURIComponent(id)}&select=id`,
    { method: "DELETE", prefer: "return=representation" },
  );
  return rows[0]?.id ?? null;
}
