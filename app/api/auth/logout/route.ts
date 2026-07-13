import { signOut } from "@/lib/auth/server";

export async function POST() {
  await signOut();
  return Response.json({ data: { ok: true } });
}
