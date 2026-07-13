import { getCurrentUser } from "@/lib/auth/server";

export async function GET() {
  const user = await getCurrentUser();
  return user
    ? Response.json({ data: { user } })
    : Response.json({ error: "Unauthorized" }, { status: 401 });
}
