#!/usr/bin/env node
// Import a WordPress article export (markdown) into Reading Record as Writing → Note entries.
//
//   node scripts/import-wordpress-articles.mjs imports/3.5-all-articles.md [--source "3.5次元"] [--dry-run] [--retag]
//
// --retag  rewrite the tagline of already-imported articles so their categories become #tags
//          (e.g. "Draft · #吐槽 #評論"), which the site uses for tag filtering.
//
// Each article becomes a `writing` / `note` media record (dated by its publish date) plus one
// note holding the full text. Articles already imported from the same source (same title + date)
// are skipped, so the script is safe to run again. Uses the Supabase keys in .env.local.

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith("--"));
const dryRun = args.includes("--dry-run");
const retag = args.includes("--retag");
const sourceIndex = args.indexOf("--source");
const sourceName = sourceIndex >= 0 ? args[sourceIndex + 1] : "3.5次元";
if (!file) {
  console.error("Usage: node scripts/import-wordpress-articles.mjs <export.md> [--source NAME] [--dry-run]");
  process.exit(1);
}

// --- env ---
const env = {};
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}

async function rest(path, options = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...(options.prefer ? { prefer: options.prefer } : {}),
    },
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`${options.method ?? "GET"} ${path} → ${response.status} ${raw}`);
  return raw ? JSON.parse(raw) : null; // "return=minimal" inserts reply with an empty body

}

// --- parse ---
const text = readFileSync(resolve(file), "utf8");
const marker = text.indexOf("— all articles");
const body = marker >= 0 ? text.slice(text.indexOf("\n", marker)) : text;
const pattern = /^## (.+)\n\n- Date: (\S+ \S+)\n- Status: (\S+)\n- Categories: (.*)\n- Tags: (.*)\n\n---\n/gm;
const matches = [...body.matchAll(pattern)];

function clean(markdown) {
  return markdown
    .replace(/\\([_*#\[\]()`>-])/g, "$1") // markdown escapes from the exporter
    .replace(/<(https?:\/\/[^>\s]+)>/g, "$1") // <http://…> autolinks → plain url
    .replace(/[ \t]+\n/g, "\n") // trailing hard-break spaces
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const palettes = [
  ["#7f302c", "#d8a46f"],
  ["#243f5a", "#91b7b3"],
  ["#394d35", "#d1bf73"],
  ["#4d3556", "#c6a1b8"],
  ["#28303c", "#a9a18f"],
  ["#6d4930", "#d8bd88"],
];

// Tagline stored in the record's `note`: an optional "Draft" marker plus categories as #tags.
function taglineFor(article) {
  const tags = article.categories.map((category) => `#${category.replace(/\s+/g, "_")}`).join(" ");
  return [article.draft ? "Draft" : null, tags || null].filter(Boolean).join(" · ") || null;
}

const articles = matches
  .map((match, index) => {
    const end = index + 1 < matches.length ? matches[index + 1].index : body.length;
    let content = body.slice(match.index + match[0].length, end).trim();
    if (content.endsWith("---")) content = content.slice(0, -3).trim();
    const categories = match[4]
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry && entry !== "Uncategorized");
    const date = `${match[2].replace(" ", "T")}Z`;
    const rawTitle = match[1].trim();
    return {
      title: rawTitle === "(untitled)" ? `Untitled · ${match[2].slice(0, 10)}` : rawTitle,
      date,
      draft: match[3] !== "publish",
      categories,
      content: clean(content),
    };
  })
  .filter((article) => article.content.length > 0)
  .filter((article) => !article.content.startsWith("Welcome to WordPress. This is your first post."));

console.log(`Parsed ${matches.length} articles; ${articles.length} have text to import.`);

// --- skip what is already there ---
const existing = await rest(
  `media?select=id,title,published_at&type=eq.writing&source_name=eq.${encodeURIComponent(sourceName)}`,
);
const existingByKey = new Map(existing.map((row) => [`${row.title}|${String(row.published_at).slice(0, 10)}`, row.id]));
const keyOf = (article) => `${article.title}|${article.date.slice(0, 10)}`;
const todo = articles.filter((article) => !existingByKey.has(keyOf(article)));

// Records created by an interrupted earlier run may be missing their text: add it back.
const withText = existing.length
  ? new Set(
      (await rest(`notes?select=content_id&content_id=in.(${existing.map((row) => `"${row.id}"`).join(",")})`)).map(
        (row) => row.content_id,
      ),
    )
  : new Set();
const repairs = articles.filter((article) => {
  const id = existingByKey.get(keyOf(article));
  return id && !withText.has(id);
});
console.log(`${articles.length - todo.length} already imported (${repairs.length} missing their text), ${todo.length} to add.`);
if (retag) {
  let changed = 0;
  for (const article of articles) {
    const id = existingByKey.get(keyOf(article));
    if (!id) continue;
    if (!dryRun) {
      await rest(`media?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: JSON.stringify({ note: taglineFor(article) }),
      });
    }
    changed += 1;
  }
  console.log(`${dryRun ? "Would retag" : "Retagged"} ${changed} articles.`);
}

if (dryRun) {
  for (const article of repairs) console.log(`  (restore text) ${article.title}`);
  for (const article of todo) console.log(`  ${article.date.slice(0, 10)}  ${article.title}${article.draft ? "  (draft)" : ""}`);
  process.exit(0);
}

for (const article of repairs) {
  await rest("notes", {
    method: "POST",
    prefer: "return=minimal",
    body: JSON.stringify({
      id: randomUUID(),
      content_id: existingByKey.get(keyOf(article)),
      kind: "thought",
      title: article.title,
      body: article.content,
      created_at: article.date,
      updated_at: article.date,
    }),
  });
  console.log(`  restored text for ${article.title}`);
}

let added = 0;
for (const [index, article] of todo.entries()) {
  const id = randomUUID();
  const tagline = taglineFor(article);
  await rest("media", {
    method: "POST",
    prefer: "return=minimal",
    body: JSON.stringify({
      id,
      type: "writing",
      subtype: "note",
      title: article.title,
      creator: "Huaqing",
      status: "finished",
      published_at: article.date,
      finished_at: article.date,
      updated_at: article.date,
      favorite: false,
      featured: false,
      cover_tone: palettes[index % palettes.length],
      source_name: sourceName,
      note: tagline,
    }),
  });
  await rest("notes", {
    method: "POST",
    prefer: "return=minimal",
    body: JSON.stringify({
      id: randomUUID(),
      content_id: id,
      kind: "thought",
      title: article.title,
      body: article.content,
      created_at: article.date,
      updated_at: article.date,
    }),
  });
  added += 1;
  process.stdout.write(`\r  imported ${added}/${todo.length}`);
}
console.log(`\nDone. Added ${added} articles from ${sourceName}.`);
