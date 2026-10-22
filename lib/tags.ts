// Tags live in a record's `note` (tagline) as #hashtags, e.g. "Draft · #吐槽 #評論".
// Anything that isn't a tag stays as the tagline text.

const TAG = /#([^\s#·,，、]+)/g;

export function parseTagline(note?: string | null) {
  const value = note ?? "";
  const all = [...value.matchAll(TAG)].map((match) => match[1]);
  // "#plan:Name" marks membership of a watch/read plan — kept apart from ordinary tags.
  const plan = all.find((tag) => tag.startsWith("plan:"))?.slice(5).replace(/_/g, " ") || null;
  const tags = all.filter((tag) => !tag.startsWith("plan:"));
  const text = value
    .replace(TAG, "")
    .replace(/\s*·\s*(·\s*)*/g, " · ")
    .replace(/^[\s·]+|[\s·]+$/g, "")
    .trim();
  return { tags: [...new Set(tags)], text, plan };
}

export function formatTagline(text: string, tags: string[], plan?: string | null) {
  const cleanTags = [
    ...new Set([...tags, ...(plan ? [`plan:${plan.trim()}`] : [])].map((tag) => tag.replace(/^#/, "").trim()).filter(Boolean)),
  ];
  const tagPart = cleanTags.map((tag) => `#${tag.replace(/\s+/g, "_")}`).join(" ");
  return [text.trim() || null, tagPart || null].filter(Boolean).join(" · ");
}

/** "吐槽 評論", "#吐槽, #評論" or "吐槽、評論" → ["吐槽", "評論"] */
export function splitTagInput(input: string) {
  return input
    .split(/[\s,，、#]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}
