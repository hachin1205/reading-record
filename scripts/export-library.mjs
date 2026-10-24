// Saves a copy of the whole library (records, notes, finish history) to data/library.json.
// Run by the daily GitHub workflow, which commits the file when it changed. That gives the
// repo an up-to-date backup and, as a side effect, keeps the free Supabase project from
// pausing after a week without visits.
//
//   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=... npm run export-library
import { mkdir, writeFile } from "node:fs/promises";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY first.");
  process.exit(1);
}

async function table(name, order) {
  const response = await fetch(`${url}/rest/v1/${name}?select=*&order=${order}`, {
    headers: { apikey: key, authorization: `Bearer ${key}` },
  });
  if (!response.ok) throw new Error(`${name}: ${response.status} ${await response.text()}`);
  return response.json();
}

const library = {
  media: await table("media", "id.asc"),
  notes: await table("notes", "id.asc"),
  experiences: await table("experiences", "id.asc"),
};

await mkdir("data", { recursive: true });
await writeFile("data/library.json", `${JSON.stringify(library, null, 2)}\n`);
console.log(
  `Saved ${library.media.length} records, ${library.notes.length} notes, ${library.experiences.length} finishes.`,
);
