import { apiError, parseExperience } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/server";
import { createExperience, listExperiences } from "@/lib/db/repository";

export async function GET(request: Request) {
  try {
    const contentId = new URL(request.url).searchParams.get("contentId") ?? undefined;
    return Response.json({ data: await listExperiences(contentId) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const experience = parseExperience(await request.json());
    return Response.json({ data: await createExperience(experience) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
