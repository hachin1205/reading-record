// One-time database update: adds the two columns used for "expected finish date".
// Safe to run more than once.  Run:  node scripts/add-target-finish.mjs
import { existsSync, readFileSync } from "node:fs";
import postgres from "postgres";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

const url = process.env.SUPABASE_DATABASE_URL;
if (!url) {
  console.error("SUPABASE_DATABASE_URL is missing in .env.local");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1 });
try {
  await sql`alter table media add column if not exists target_finish_at timestamptz`;
  await sql`alter table media add column if not exists progress_set_at timestamptz`;
  // Let the REST API see the new columns right away.
  await sql`notify pgrst, 'reload schema'`;
  console.log("Done: media.target_finish_at and media.progress_set_at are ready.");
} finally {
  await sql.end();
}
