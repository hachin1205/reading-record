import { signInWithPassword } from "@/lib/auth/server";
import { apiError } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: unknown; password?: unknown };
    if (typeof body.email !== "string" || typeof body.password !== "string") {
      throw new Error("Email and password are required");
    }

    const user = await signInWithPassword(body.email, body.password);
    return Response.json({ data: { user } });
  } catch (error) {
    return apiError(error);
  }
}
