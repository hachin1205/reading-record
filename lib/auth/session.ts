// Sign-in for the static site. The Supabase session lives in this browser's localStorage, so
// signing in once on a PC or phone keeps that device signed in: the short-lived access token
// is renewed with the refresh token, for as long as Supabase keeps the refresh token valid.
// Who may edit is decided by Supabase (the is_admin() function and Row Level Security), not here.

const storageKey = "rr_session";

type SupabaseUser = {
  id: string;
  email?: string;
};

type Session = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: SupabaseUser;
};

type TokenPayload = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  user: SupabaseUser;
};

function authConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured");
  return { key, url };
}

function readSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function storeSession(payload: TokenPayload) {
  const session: Session = {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at: payload.expires_at ?? Math.floor(Date.now() / 1000) + payload.expires_in,
    user: payload.user,
  };
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(session));
  } catch {
    // Private windows can refuse storage; the user stays signed in for this page only.
  }
  return session;
}

function clearSession() {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Nothing stored.
  }
}

async function tokenRequest(grant: "password" | "refresh_token", body: Record<string, string>) {
  const { key, url } = authConfig();
  const response = await fetch(`${url}/auth/v1/token?grant_type=${grant}`, {
    method: "POST",
    headers: { apikey: key, "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as TokenPayload;
}

let refreshing: Promise<Session | null> | null = null;

/** Swap the refresh token for a fresh access token. Concurrent callers share one request. */
function refreshSession(session: Session) {
  refreshing ??= tokenRequest("refresh_token", { refresh_token: session.refresh_token })
    .then((payload) => {
      if (!payload) {
        clearSession();
        return null;
      }
      return storeSession(payload);
    })
    .catch(() => session)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** The signed-in user's access token, renewed when it is about to expire; null when signed out. */
export async function getAccessToken() {
  if (typeof window === "undefined") return null;
  const session = readSession();
  if (!session) return null;
  if (session.expires_at - 60 > Date.now() / 1000) return session.access_token;
  return (await refreshSession(session))?.access_token ?? null;
}

async function isAdmin(accessToken: string) {
  const { key, url } = authConfig();
  const response = await fetch(`${url}/rest/v1/rpc/is_admin`, {
    method: "POST",
    headers: { apikey: key, authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: "{}",
    cache: "no-store",
  });
  return response.ok && (await response.json()) === true;
}

export async function signInWithPassword(email: string, password: string) {
  const payload = await tokenRequest("password", { email: email.trim(), password });
  if (!payload) throw new Error("Invalid email or password");
  if (!(await isAdmin(payload.access_token))) throw new Error("Forbidden");
  return storeSession(payload).user;
}

export async function signOut() {
  const session = typeof window === "undefined" ? null : readSession();
  clearSession();
  if (!session) return;
  const { key, url } = authConfig();
  await fetch(`${url}/auth/v1/logout`, {
    method: "POST",
    headers: { apikey: key, authorization: `Bearer ${session.access_token}` },
  }).catch(() => null);
}

/** The signed-in admin, or null. Only an account Supabase accepts as admin counts as signed in. */
export async function getCurrentUser() {
  const token = await getAccessToken();
  if (!token) return null;
  const session = readSession();
  return session?.user ?? null;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

// Sends Supabase's password-recovery email. Supabase answers the same whether or not the
// address has an account, so this can't be used to find out which emails exist.
export async function requestPasswordReset(email: string, redirectTo: string) {
  const { key, url } = authConfig();
  const response = await fetch(`${url}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    headers: { apikey: key, "content-type": "application/json" },
    body: JSON.stringify({ email: email.trim() }),
    cache: "no-store",
  });
  if (response.status === 429) throw new Error("Too many reset emails. Please wait a minute and try again.");
  if (!response.ok) throw new Error("Could not send the reset email");
}

// Uses the one-time token from the reset email link to set a new password, then signs in.
export async function setPasswordWithRecoveryToken(accessToken: string, password: string) {
  if (password.length < 8) throw new Error("Use at least 8 characters");
  const { key, url } = authConfig();

  const userResponse = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!userResponse.ok) throw new Error("This reset link has expired. Request a new one.");
  const user = (await userResponse.json()) as SupabaseUser;
  if (!(await isAdmin(accessToken))) throw new Error("Forbidden");

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
