import { apiError, parseExperience, parseMedia, parseMediaChanges, parseNote } from "@/lib/api";
import {
  getAccessToken,
  getCurrentUser,
  requestPasswordReset,
  requireAdmin,
  setPasswordWithRecoveryToken,
  signInWithPassword,
  signOut,
} from "@/lib/auth/session";
import {
  createExperience,
  createMedia,
  createNote,
  deleteExperience,
  deleteMedia,
  deleteNote,
  listExperiences,
  listMedia,
  listNotes,
  updateMedia,
  updateNote,
} from "@/lib/db/repository";
import { findDuplicate } from "@/lib/duplicates";
import { supabaseConfig } from "@/lib/supabase/rest";

// The site used to have a server answering /api/*. It is now a static site, so the same
// /api/* calls are answered here in the browser: records go straight to Supabase, and the
// searches and Claude/Gemini (which need secret keys) go to the "api" Supabase Edge Function.
// Components call apiFetch() exactly like they used to call fetch().

const json = (data: unknown, status = 200) => Response.json(data, { status });
const notFound = (what: string) => json({ error: `${what} not found` }, 404);

async function readBody(init?: RequestInit) {
  return typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : {};
}

/** Searches and Claude/Gemini run in the "api" Edge Function, which holds the secret keys. */
async function edgeFunction(path: string, init?: RequestInit) {
  const config = supabaseConfig();
  if (!config) return json({ error: "Supabase is not configured" }, 503);
  const token = await getAccessToken();
  return fetch(`${config.url}/functions/v1/api${path}`, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string> | undefined),
      apikey: config.key,
      authorization: `Bearer ${token ?? config.key}`,
    },
  });
}

async function route(path: string, method: string, init?: RequestInit): Promise<Response> {
  const url = new URL(path, "https://site.local");
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const [resource, id] = parts;
  const contentId = url.searchParams.get("contentId") ?? undefined;

  if (resource === "search" || resource === "claude") return edgeFunction(url.pathname.slice(4) + url.search, init);

  if (resource === "auth") {
    if (id === "me") {
      const user = await getCurrentUser();
      return user ? json({ data: { user } }) : json({ error: "Unauthorized" }, 401);
    }
    if (id === "login") {
      const body = (await readBody(init)) as { email?: unknown; password?: unknown };
      if (typeof body.email !== "string" || typeof body.password !== "string") {
        throw new Error("Email and password are required");
      }
      return json({ data: { user: await signInWithPassword(body.email, body.password) } });
    }
    if (id === "logout") {
      await signOut();
      return json({ data: { ok: true } });
    }
    if (id === "request-reset") {
      const body = (await readBody(init)) as { email?: unknown };
      if (typeof body.email !== "string" || !body.email.includes("@")) throw new Error("Enter your email address");
      await requestPasswordReset(body.email, new URL("/reset-password/", window.location.origin).toString());
      return json({ data: { sent: true } });
    }
    if (id === "reset-password") {
      const body = (await readBody(init)) as { accessToken?: unknown; password?: unknown };
      if (typeof body.accessToken !== "string" || typeof body.password !== "string") {
        throw new Error("The reset link is incomplete. Request a new one.");
      }
      return json({ data: { user: await setPasswordWithRecoveryToken(body.accessToken, body.password) } });
    }
  }

  if (resource === "media") {
    if (!id && method === "GET") return json({ data: await listMedia() });
    await requireAdmin();
    if (!id && method === "POST") {
      const item = parseMedia(await readBody(init));
      const duplicate = findDuplicate(await listMedia(), item);
      if (duplicate) {
        return json({ error: `Already in your library: ${duplicate.title}`, duplicateId: duplicate.id }, 409);
      }
      return json({ data: await createMedia(item) }, 201);
    }
    if (id && method === "PATCH") {
      const item = await updateMedia(id, parseMediaChanges(await readBody(init)));
      return item ? json({ data: item }) : notFound("Media");
    }
    if (id && method === "DELETE") {
      const deletedId = await deleteMedia(id);
      return deletedId ? json({ data: { id: deletedId } }) : notFound("Media");
    }
  }

  if (resource === "notes") {
    if (!id && method === "GET") return json({ data: await listNotes(contentId) });
    await requireAdmin();
    if (!id && method === "POST") return json({ data: await createNote(parseNote(await readBody(init))) }, 201);
    if (id && method === "PATCH") {
      const input = (await readBody(init)) as Record<string, unknown>;
      const changes: { kind?: "review" | "excerpt" | "thought"; title?: string; body?: string } = {};
      if (input.kind === "review" || input.kind === "excerpt" || input.kind === "thought") changes.kind = input.kind;
      if (typeof input.title === "string") changes.title = input.title.trim().slice(0, 300);
      if (typeof input.body === "string") {
        if (!input.body.trim()) throw new Error("A note needs some text");
        changes.body = input.body;
      }
      const note = await updateNote(id, changes);
      return note ? json({ data: note }) : notFound("Note");
    }
    if (id && method === "DELETE") {
      const deletedId = await deleteNote(id);
      return deletedId ? json({ data: { id: deletedId } }) : notFound("Note");
    }
  }

  if (resource === "experiences") {
    if (!id && method === "GET") return json({ data: await listExperiences(contentId) });
    await requireAdmin();
    if (!id && method === "POST") {
      return json({ data: await createExperience(parseExperience(await readBody(init))) }, 201);
    }
    if (id && method === "DELETE") {
      const deletedId = await deleteExperience(id);
      return deletedId ? json({ data: { id: deletedId } }) : notFound("Experience");
    }
  }

  return json({ error: "Not found" }, 404);
}

/** Drop-in for fetch() on the site's own /api/* paths. */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await route(path, (init?.method ?? "GET").toUpperCase(), init);
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw error;
    return apiError(error);
  }
}
