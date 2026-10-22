ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "target_finish_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "progress_set_at" timestamp with time zone;
