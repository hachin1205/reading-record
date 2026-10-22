import { cookies } from "next/headers";

const accessCookie = "rr_access_token";
const refreshCookie = "rr_refresh_token";
// Stay signed in for 30 days: the short-lived access token is renewed with the refresh token.
const SESSION_SECONDS = 60 * 60 * 24 * 30;

type SupabaseUser = {
  id: string;
  email?: string;
};

type LoginPayload = {
  access_token: string;
  refresh_token?: string;
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

  await storeSession(payload);
  return payload.user;
}

async function storeSession(payload: LoginPayload) {
  const cookieStore = await cookies();
  const options = {
    httpOnly: true,
    maxAge: SESSION_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
  cookieStore.set(accessCookie, payload.access_token, options);
  if (payload.refresh_token) cookieStore.set(refreshCookie, payload.refresh_token, options);
}

/** Swap the refresh token for a fresh access token (and a new refresh token). */
async function refreshSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(refreshCookie)?.value;
  if (!refreshToken) return null;
  const { key, url } = getSupabaseAuthConfig();
  const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: key, "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as LoginPayload;
  try {
    await storeSession(payload);
  } catch {
    // Cookies can't be written while rendering a page; the next API call will store them.
  }
  return payload.access_token;
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete(accessCookie);
  cookieStore.delete(refreshCookie);
}

// Local development convenience: set ADMIN_AUTH_DISABLED=true in .env.local to skip
// the admin sign-in on your own machine. Never honoured in a production build, so the
// deployed site always requires a real sign-in before anything can be edited.
function isLocalAuthBypass() {
  return process.env.NODE_ENV !== "production" && process.env.ADMIN_AUTH_DISABLED === "true";
}

const localAdmin: SupabaseUser = { id: "local-admin", email: "local@localhost" };

export async function getCurrentUser() {
  if (isLocalAuthBypass()) return localAdmin;

  const cookieStore = await cookies();
  const { key, url } = getSupabaseAuthConfig();
  const fetchUser = (token: string) =>
    fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, authorization: `Bearer ${token}` },
      cache: "no-store",
    });

  let token = cookieStore.get(accessCookie)?.value ?? (await refreshSession());
  if (!token) return null;
  let response = await fetchUser(token);
  if (response.status === 401 || response.status === 403) {
    // Access token expired (they last about an hour): renew it quietly.
    token = await refreshSession();
    if (!token) return null;
    response = await fetchUser(token);
  }

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

function isAllowedAdminEmail(email: string) {
  const allowList = process.env.ADMIN_EMAILS?.split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(allowList?.length) && allowList!.includes(email.trim().toLowerCase());
}

// Sends Supabase's password-recovery email. Only for admin addresses, and it always
// reports success so the endpoint can't be used to probe which emails exist.
export async function requestPasswordReset(email: string, redirectTo: string) {
  if (!isAllowedAdminEmail(email)) return;
  const { key, url } = getSupabaseAuthConfig();
  const response = await fetch(`${url}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    headers: { apikey: key, "content-type": "application/json" },
    body: JSON.stringify({ email: email.trim() }),
    cache: "no-store",
  });
  if (!response.ok && response.status !== 429) {
    throw new Error("Could not send the reset email");
  }
  if (response.status === 429) throw new Error("Too many reset emails. Please wait a minute and try again.");
}

// Uses the one-time token from the reset email link to set a new password, then signs in.
export async function setPasswordWithRecoveryToken(accessToken: string, password: string) {
  if (password.length < 8) throw new Error("Use at least 8 characters");
  const { key, url } = getSupabaseAuthConfig();

  const userResponse = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!userResponse.ok) throw new Error("This reset link has expired. Request a new one.");
  const user = (await userResponse.json()) as SupabaseUser;
  assertAllowedUser(user);

  const update = await fetch(`${url}/auth/v1/user`, {
    method: "PUT",
    headers: { apikey: key, authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ password }),
    cache: "no-store",
  });
  if (!update.ok) {
    const payload = (await update.json().catch(() => null)) as { msg?: string; message?: string } | null;
    throw new Error(payload?.msg ?? payload?.message ?? "Could not update the password");
  }

  if (!user.email) return user;
  return signInWithPassword(user.email, password);
}
