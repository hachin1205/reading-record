import { mediaItems } from "@/lib/sample-data";
import type { MediaItem } from "@/lib/types";
import { hasSupabaseConfig } from "@/lib/supabase/rest";
import { listMedia } from "./repository";

/** The library baked into the static page at build time; the browser then loads the live copy. */
export async function getMediaForPage(): Promise<MediaItem[]> {
  if (!hasSupabaseConfig()) return mediaItems;

  try {
    return await listMedia();
  } catch (error) {
    console.error("Unable to load media from Supabase", error);
    return [];
  }
}
