import { getAccessToken } from "@/lib/auth/session";

// The site is a static build: the browser talks to Supabase's REST API directly with the
// publishable key. Reads are public; writes only succeed for the signed-in admin, which the
// Row Level Security policies in supabase/migrations enforce on Supabase's side.

type SupabaseRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  prefer?: string;
};

export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

export function hasSupabaseConfig() {
  return Boolean(supabaseConfig());
}

export async function supabaseRequest<T>(path: string, options: SupabaseRequestOptions = {}) {
  const config = supabaseConfig();
  if (!config) throw new Error("Supabase is not configured");

  const token = typeof window === "undefined" ? null : await getAccessToken();
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    method: options.method ?? "GET",
    headers: {
      apikey: config.key,
      authorization: `Bearer ${token ?? config.key}`,
      "content-type": "application/json",
      ...(options.prefer ? { prefer: options.prefer } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    // At build time the fetch is cached so Next can bake it into the static page; in the browser it's always live.
    cache: typeof window === "undefined" ? "force-cache" : "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    if (response.status === 401 || response.status === 403 || payload?.message?.includes("row-level security")) {
      throw new Error("Unauthorized");
    }
    throw new Error(payload?.message ?? `Supabase request failed with ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
