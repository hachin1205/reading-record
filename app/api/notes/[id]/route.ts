import { apiError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/server";
import { deleteNote } from "@/lib/db/repository";

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
