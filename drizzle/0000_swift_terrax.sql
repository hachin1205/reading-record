CREATE TYPE "public"."media_status" AS ENUM('planned', 'in_progress', 'finished', 'dropped');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('book', 'video', 'game', 'writing');--> statement-breakpoint
CREATE TYPE "public"."note_kind" AS ENUM('review', 'excerpt', 'thought');--> statement-breakpoint
CREATE TABLE "media" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "media_type" NOT NULL,
	"subtype" text,
	"title" text NOT NULL,
	"creator" text NOT NULL,
	"creator_group" text,
	"creator_sort_label" text,
	"status" "media_status" DEFAULT 'planned' NOT NULL,
	"rating" real,
	"finished_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"page_count" integer,
	"progress_percent" integer,
	"completion_count" integer,
	"favorite" boolean DEFAULT false NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"cover_url" text,
	"cover_tone" jsonb NOT NULL,
	"platform_family" text,
	"note" text,
	"theme_youtube_id" text,
	"theme_start_seconds" integer,
	"theme_end_seconds" integer,
	"theme_title" text
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" text PRIMARY KEY NOT NULL,
	"content_id" text NOT NULL,
	"kind" "note_kind" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_content_id_media_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;