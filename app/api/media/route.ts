import { apiError, parseMedia } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/server";
import { createMedia, listMedia } from "@/lib/db/repository";
import { findDuplicate } from "@/lib/duplicates";

export async function GET() {
  try {
    return Response.json({ data: await listMedia() });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const item = parseMedia(await request.json());
    const duplicate = findDuplicate(await listMedia(), item);
    if (duplicate) {
      return Response.json(
        { error: `Already in your library: ${duplicate.title}`, duplicateId: duplicate.id },
        { status: 409 },
      );
    }
    return Response.json({ data: await createMedia(item) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
