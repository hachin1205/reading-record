import { apiError } from "@/lib/api";
import { requestPasswordReset } from "@/lib/auth/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: unknown };
    if (typeof body.email !== "string" || !body.email.includes("@")) {
      throw new Error("Enter your email address");
    }
    const redirectTo = new URL("/reset-password", request.url).toString();
    await requestPasswordReset(body.email, redirectTo);
    return Response.json({ data: { sent: true } });
  } catch (error) {
    return apiError(error);
  }
}
