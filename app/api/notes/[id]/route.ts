import { apiError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/server";
import { deleteNote, updateNote } from "@/lib/db/repository";

export async function DELETE(_: Request, context: { params: Promise<unknown> }) {
  try {
    await requireAdmin();
    const params = await context.params;
    if (!params || typeof params !== "object" || !("id" in params)) throw new Error("Note id is required");
    const id = String(params.id);
    const deletedId = await deleteNote(id);
    return deletedId
      ? Response.json({ data: { id: deletedId } })
      : Response.json({ error: "Note not found" }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<unknown> }) {
  try {
    await requireAdmin();
    const params = await context.params;
    if (!params || typeof params !== "object" || !("id" in params)) throw new Error("Note id is required");
    const input = (await request.json()) as Record<string, unknown>;
    const changes: { kind?: "review" | "excerpt" | "thought"; title?: string; body?: string } = {};
    if (input.kind === "review" || input.kind === "excerpt" || input.kind === "thought") changes.kind = input.kind;
    if (typeof input.title === "string") changes.title = input.title.trim().slice(0, 300);
    if (typeof input.body === "string") {
      if (!input.body.trim()) throw new Error("A note needs some text");
      changes.body = input.body;
    }
    const note = await updateNote(String(params.id), changes);
    return note ? Response.json({ data: note }) : Response.json({ error: "Note not found" }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}
