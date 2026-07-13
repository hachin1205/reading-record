import { cookies } from "next/headers";

const accessCookie = "rr_access_token";

type SupabaseUser = {
  id: string;
  email?: string;
};

type LoginPayload = {
  access_token: string;
  expires_in: number;
  user: SupabaseUser;
};

function getSupabaseAuthConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) throw new Error("Supabase auth credentials are not configured");
  return { key, url };
}

function assertAllowedUser(user: SupabaseUser) {
  const allowList = process.env.ADMIN_EMAILS?.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (!allowList?.length) return;
  if (!user.email || !allowList.includes(user.email.toLowerCase())) {
    throw new Error("Forbidden");
  }
}

export async function signInWithPassword(email: string, password: string) {
  const { key, url } = getSupabaseAuthConfig();
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: key,
      "content-type": "application/json",
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  if (!response.ok) throw new Error("Invalid email or password");

  const payload = (await response.json()) as LoginPayload;
  assertAllowedUser(payload.user);

  const cookieStore = await cookies();
  cookieStore.set(accessCookie, payload.access_token, {
    httpOnly: true,
    maxAge: payload.expires_in,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return payload.user;
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete(accessCookie);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(accessCookie)?.value;
  if (!token) return null;

  const { key, url } = getSupabaseAuthConfig();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: key,
      authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) return null;
  const user = (await response.json()) as SupabaseUser;
  assertAllowedUser(user);
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
