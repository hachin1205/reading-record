import type { MediaItem, MediaType } from "./sample-data";

// Built-in kinds keep their short codes in the database; anything else is stored as typed
// (e.g. "Paper", "Lecture", "Textbook") so academic material can have its own kind.
const builtIn: Record<string, string> = {
  movie: "Film",
  anime: "Anime",
  j_drama: "J-drama",
  k_drama: "K-drama",
  us_tv: "Series",
  documentary: "Documentary",
  visual_novel: "Visual novel",
  essay: "Essay",
  short_story: "Short story",
  note: "Note",
};

export const kindSuggestions: Record<MediaType, string[]> = {
  book: ["Novel", "Manga", "Textbook", "Academic book", "Paper", "Thesis", "Essay collection", "Poetry"],
  video: ["Film", "Anime", "J-drama", "K-drama", "Series", "Documentary", "Lecture", "Talk"],
  game: ["Visual novel", "RPG", "Action", "Puzzle"],
  writing: ["Note", "Essay", "Short story", "Research note", "Reading report"],
};

/** Readable name of a stored subtype ("j_drama" → "J-drama", "Paper" → "Paper"). */
export function subtypeLabel(subtype?: string | null) {
  if (!subtype) return "";
  return builtIn[subtype] ?? subtype;
}

/** What to store for a typed kind: the built-in code when it matches one, else the text itself. */
export function subtypeValue(input: string): MediaItem["subtype"] | undefined {
  const text = input.trim();
  if (!text) return undefined;
  const code = Object.entries(builtIn).find(([, label]) => label.toLowerCase() === text.toLowerCase())?.[0];
  return (code ?? text) as MediaItem["subtype"];
}

export function isCustomSubtype(subtype?: string | null) {
  return Boolean(subtype && !(subtype in builtIn));
}
