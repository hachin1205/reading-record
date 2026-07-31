import { mediaItems } from "@/lib/sample-data";
import type { MediaItem } from "@/lib/types";
import { hasSupabaseConfig } from "@/lib/supabase/server";
import { listMedia } from "./repository";

export async function getMediaForPage(): Promise<MediaItem[]> {
  if (!hasSupabaseConfig()) return mediaItems;

  try {
    const items = await listMedia();
    return items;
  } catch (error) {
    console.error("Unable to load media from Supabase", error);
    return process.env.SEED_SAMPLE_DATA === "true" ? mediaItems : [];
  }
}
