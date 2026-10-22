import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { MediaItem } from "@/lib/types";

export const mediaTypeEnum = pgEnum("media_type", ["book", "video", "game", "writing"]);
export const mediaStatusEnum = pgEnum("media_status", [
  "planned",
  "in_progress",
  "finished",
  "dropped",
]);
export const noteKindEnum = pgEnum("note_kind", ["review", "excerpt", "thought"]);
export const experienceStatusEnum = pgEnum("experience_status", [
  "in_progress",
  "finished",
  "dropped",
]);

export const media = pgTable("media", {
  id: text("id").primaryKey(),
  type: mediaTypeEnum("type").notNull(),
  subtype: text("subtype"),
  title: text("title").notNull(),
  creator: text("creator").notNull(),
  creatorGroup: text("creator_group"),
  creatorSortLabel: text("creator_sort_label"),
  status: mediaStatusEnum("status").notNull().default("planned"),
  rating: real("rating"),
  finishedAt: timestamp("finished_at", { withTimezone: true, mode: "string" }),
  publishedAt: timestamp("published_at", { withTimezone: true, mode: "string" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
  pageCount: integer("page_count"),
  progressPercent: integer("progress_percent"),
  targetFinishAt: timestamp("target_finish_at", { withTimezone: true, mode: "string" }),
  progressSetAt: timestamp("progress_set_at", { withTimezone: true, mode: "string" }),
  completionCount: integer("completion_count"),
  favorite: boolean("favorite").notNull().default(false),
  featured: boolean("featured").notNull().default(false),
  coverUrl: text("cover_url"),
  isbn: text("isbn"),
  publisher: text("publisher"),
  sourceUrl: text("source_url"),
  sourceName: text("source_name"),
  coverTone: jsonb("cover_tone").$type<MediaItem["coverTone"]>().notNull(),
  platformFamily: text("platform_family"),
  note: text("note"),
  themeYoutubeId: text("theme_youtube_id"),
  themeStartSeconds: integer("theme_start_seconds"),
  themeEndSeconds: integer("theme_end_seconds"),
  themeTitle: text("theme_title"),
});

export const experiences = pgTable("experiences", {
  id: text("id").primaryKey(),
  contentId: text("content_id")
    .notNull()
    .references(() => media.id, { onDelete: "cascade" }),
  status: experienceStatusEnum("status").notNull().default("in_progress"),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true, mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

export const notes = pgTable("notes", {
  id: text("id").primaryKey(),
  contentId: text("content_id")
    .notNull()
    .references(() => media.id, { onDelete: "cascade" }),
  experienceId: text("experience_id").references(() => experiences.id, {
    onDelete: "set null",
  }),
  kind: noteKindEnum("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});
