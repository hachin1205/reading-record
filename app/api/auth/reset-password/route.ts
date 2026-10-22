import { apiError } from "@/lib/api";
import { setPasswordWithRecoveryToken } from "@/lib/auth/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { accessToken?: unknown; password?: unknown };
    if (typeof body.accessToken !== "string" || typeof body.password !== "string") {
      throw new Error("The reset link is incomplete. Request a new one.");
    }
    const user = await setPasswordWithRecoveryToken(body.accessToken, body.password);
    return Response.json({ data: { user } });
  } catch (error) {
    return apiError(error);
  }
}
