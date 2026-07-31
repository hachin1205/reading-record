import { mkdir, writeFile } from "node:fs/promises";

const applyChanges = process.argv.includes("--apply");
const appOrigin = process.env.APP_ORIGIN || "http://localhost:3009";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase server credentials are not configured");
}

const catalogMatches = [
  { id: "book-norwegian-wood", endpoint: "books", query: "Norwegian Wood Haruki Murakami", title: "Norwegian Wood" },
  { id: "book-dune", endpoint: "books", query: "9780441172719", title: "Dune" },
  { id: "book-left-hand", endpoint: "books", query: "The Left Hand of Darkness Ursula Le Guin", title: "The Left Hand of Darkness" },
  { id: "book-long-goodbye", endpoint: "books", query: "9780394757681", title: "The Long Goodbye" },
  { id: "book-kokoro", endpoint: "books", query: "Kokoro Natsume Soseki", title: "Kokoro" },
  { id: "video-anime", endpoint: "anime", query: "Frieren", first: true },
  { id: "video-eva", endpoint: "anime", query: "Neon Genesis Evangelion", first: true },
  { id: "video-gundam-zz", endpoint: "anime", query: "Gundam ZZ", first: true },
  { id: "game-steins-gate", endpoint: "games", query: "Steins Gate", title: "STEINS;GATE" },
  { id: "game-umineko", endpoint: "games", query: "Umineko no Naku Koro ni", title: "Umineko no Naku Koro ni" },
  { id: "game-higurashi", endpoint: "games", query: "Higurashi no Naku Koro ni", title: "Higurashi no Naku Koro ni" },
];

const rows = await supabaseRequest("media?select=*&order=updated_at.desc");
const backupDirectory = "/tmp/reading-record-backups";
await mkdir(backupDirectory, { recursive: true });
const backupPath = `${backupDirectory}/media-${new Date().toISOString().replaceAll(":", "-")}.json`;
await writeFile(backupPath, `${JSON.stringify(rows, null, 2)}\n`);

const existingIds = new Set(rows.map((row) => row.id));
const dummyRows = rows.filter((row) => /^book-dummy-\d+$/.test(row.id));
const updates = [];

for (const match of catalogMatches) {
  if (!existingIds.has(match.id)) continue;
  const response = await fetch(`${appOrigin}/api/search/${match.endpoint}?q=${encodeURIComponent(match.query)}`);
  const payload = await response.json();
  if (!response.ok) {
    console.warn(`Skipping ${match.id}: ${payload.error || response.status}`);
    continue;
  }

  const candidate = chooseCandidate(payload.data || [], match);
  if (!candidate) {
    console.warn(`Skipping ${match.id}: no reliable catalog match`);
    continue;
  }
  updates.push({ id: match.id, candidate });
}

console.log(`Backup: ${backupPath}`);
console.log(`Numbered placeholders: ${dummyRows.length}`);
console.log(`Reliable catalog matches: ${updates.length}`);
for (const update of updates) {
  console.log(`  ${update.id} -> ${update.candidate.title} (${update.candidate.sourceName})`);
}

if (!applyChanges) {
  console.log("Dry run only. Re-run with --apply to update Supabase.");
  process.exit(0);
}

for (const { id, candidate } of updates) {
  await supabaseRequest(`media?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: catalogPatch(candidate),
  });
}

for (const row of dummyRows) {
  await supabaseRequest(`media?id=eq.${encodeURIComponent(row.id)}`, { method: "DELETE" });
}

const remaining = await supabaseRequest("media?select=id,title,source_name&order=updated_at.desc");
console.log(`Applied ${updates.length} metadata updates and removed ${dummyRows.length} placeholders.`);
console.log(`Remaining media rows: ${remaining.length}`);

function chooseCandidate(candidates, match) {
  if (match.first) return candidates[0];
  if (match.year) {
    return candidates.find((candidate) => candidate.publishedAt?.startsWith(String(match.year)));
  }
  const expected = normalize(match.title);
  return candidates.find((candidate) => normalize(candidate.title) === expected);
}

function normalize(value = "") {
  return value.normalize("NFKC").toLocaleLowerCase().replaceAll(/[^\p{L}\p{N}]+/gu, "");
}

function catalogPatch(candidate) {
  return removeUndefined({
    title: candidate.title,
    creator: candidate.creator,
    subtype: candidate.subtype,
    published_at: candidate.publishedAt,
    page_count: candidate.pageCount,
    cover_url: candidate.coverUrl,
    isbn: candidate.isbn,
    publisher: candidate.publisher,
    source_url: candidate.sourceUrl,
    source_name: candidate.sourceName,
    platform_family: candidate.platformFamily,
    updated_at: new Date().toISOString(),
  });
}

function removeUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: supabaseKey,
      authorization: `Bearer ${supabaseKey}`,
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Supabase ${options.method || "GET"} failed (${response.status}): ${payload}`);
  }
  if (response.status === 204) return [];
  return response.json();
}
