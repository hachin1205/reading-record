// Copy of the record types in lib/sample-data.ts (Edge Functions only see files in supabase/functions).
export type MediaType = "book" | "video" | "game" | "writing";
export type MediaStatus = "planned" | "in_progress" | "finished" | "dropped";
export type VideoSubtype = "movie" | "anime" | "j_drama" | "k_drama" | "us_tv" | "documentary";
export type GamePlatformFamily = "playstation" | "nintendo" | "xbox" | "pc";

export type MediaItem = {
  id: string;
  type: MediaType;
  // Built-in kinds, or any custom kind typed by hand (e.g. "Paper", "Lecture").
  subtype?: VideoSubtype | "visual_novel" | "essay" | "short_story" | "note" | (string & {});
  title: string;
  creator: string;
  creatorGroup?: string;
  creatorSortLabel?: string;
  status: MediaStatus;
  rating?: number;
  finishedAt?: string;
  publishedAt?: string;
  updatedAt: string;
  pageCount?: number;
  progressPercent?: number;
  /** Expected finish date: progress grows on its own toward 100% by then. */
  targetFinishAt?: string | null;
  /** When progressPercent was last set by hand (the starting point for automatic growth). */
  progressSetAt?: string | null;
  /** Client-only: every finish date (rewatches / rereads), from the experiences table. */
  viewings?: string[];
  /** Client-only: which time this entry stands for when a record is listed once per viewing. */
  viewingNumber?: number;
  completionCount?: number;
  favorite?: boolean;
  featured?: boolean;
  coverUrl?: string;
  isbn?: string;
  publisher?: string;
  sourceUrl?: string;
  sourceName?: string;
  coverTone: [string, string];
  platformFamily?: GamePlatformFamily;
  note?: string;
  themeYoutubeId?: string;
  themeStartSeconds?: number;
  themeEndSeconds?: number;
  themeTitle?: string;
};
