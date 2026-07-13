import { apiError, parseNote } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/server";
import { createNote, listNotes } from "@/lib/db/repository";

export async function GET(request: Request) {
  try {
    const contentId = new URL(request.url).searchParams.get("contentId") ?? undefined;
    return Response.json({ data: await listNotes(contentId) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const note = parseNote(await request.json());
    return Response.json({ data: await createNote(note) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
