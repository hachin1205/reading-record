import { apiError, parseMediaChanges } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/server";
import { deleteMedia, updateMedia } from "@/lib/db/repository";

function readId(params: unknown) {
  if (!params || typeof params !== "object" || !("id" in params)) throw new Error("Media id is required");
  return String(params.id);
}

export async function PATCH(request: Request, context: { params: Promise<unknown> }) {
  try {
    await requireAdmin();
    const id = readId(await context.params);
    const item = await updateMedia(id, parseMediaChanges(await request.json()));
    return item
      ? Response.json({ data: item })
      : Response.json({ error: "Media not found" }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, context: { params: Promise<unknown> }) {
  try {
    await requireAdmin();
    const id = readId(await context.params);
    const deletedId = await deleteMedia(id);
    return deletedId
      ? Response.json({ data: { id: deletedId } })
      : Response.json({ error: "Media not found" }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}
