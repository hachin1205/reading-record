import process from "node:process";

// Only the site's admin may use the searches and Claude/Gemini, so visitors can't spend the
// API keys' quota. "Admin" is whatever Supabase's public.is_admin() says for the caller's token.

const supabaseUrl = () => process.env.SUPABASE_URL ?? "";
const anonKey = () => process.env.SUPABASE_ANON_KEY ?? "";

export async function requireAdmin(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Unauthorized");
  const allowed = await fetch(`${supabaseUrl()}/rest/v1/rpc/is_admin`, {
    method: "POST",
    headers: { apikey: request.headers.get("apikey") ?? anonKey(), authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: "{}",
  })
    .then(async (response) => response.ok && (await response.json()) === true)
    .catch(() => false);
  if (!allowed) throw new Error("Unauthorized");
}

export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
  return Response.json({ error: message }, { status });
}
