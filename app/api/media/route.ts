import { apiError, parseMedia } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/server";
import { createMedia, listMedia } from "@/lib/db/repository";

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
    return Response.json({ data: await createMedia(item) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
