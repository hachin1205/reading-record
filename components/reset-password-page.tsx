"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";

type Stage = "loading" | "request" | "sent" | "set" | "done";

function readRecoveryHash() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return {
    token: hash.get("type") === "recovery" ? hash.get("access_token") : null,
    error: hash.get("error_description"),
  };
}

export function ResetPasswordPage() {
  const [stage, setStage] = useState<Stage>("loading");
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const applyHash = (initial: boolean) => {
      const { token: recoveryToken, error: linkError } = readRecoveryHash();
      if (recoveryToken) {
        setToken(recoveryToken);
        setError(null);
        setStage("set");
        // Keep the one-time token out of the address bar and history.
        window.history.replaceState(null, "", window.location.pathname);
      } else if (initial) {
        if (linkError) setError(linkError.replace(/\+/g, " "));
        setStage("request");
      }
    };
    applyHash(true);
    // A reset link opened in a tab that already shows this page only changes the #hash.
    const onHashChange = () => applyHash(false);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  async function requestEmail(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch("/api/auth/request-reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not send the email");
      setStage("sent");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send the email");
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accessToken: token, password }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not update the password");
      setStage("done");
      setPassword("");
      setConfirm("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update the password");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "h-11 w-full border-0 border-b border-line bg-transparent text-[17px] text-ink outline-none transition-colors placeholder:text-muted focus:border-ink";

  return (
    <main className="min-h-screen px-4 sm:px-6">
      <div className="mx-auto w-full max-w-[26rem] pt-16 sm:pt-24">
        <Link href="/" className="font-serif text-lg text-ink">
          Reading Record
        </Link>

        {stage === "set" ? (
          <form className="mt-14" onSubmit={savePassword}>
            <h1 className="font-serif text-[36px] font-normal leading-tight tracking-[-0.01em]">Set a new password</h1>
            <p className="mt-3 text-[15px] text-muted">At least 8 characters.</p>
            <label className="mt-10 block">
              <span className="text-sm text-muted">New password</span>
              <input
                className={field}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                autoFocus
              />
            </label>
            <label className="mt-6 block">
              <span className="text-sm text-muted">Repeat it</span>
              <input
                className={field}
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
                minLength={8}
              />
            </label>
            {error ? <p className="mt-6 text-sm text-accent">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="mt-10 rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-paper disabled:opacity-40"
            >
              {busy ? "Saving…" : "Save password"}
            </button>
          </form>
        ) : stage === "done" ? (
          <div className="mt-14">
            <h1 className="font-serif text-[36px] font-normal leading-tight">You&rsquo;re all set</h1>
            <p className="mt-3 text-[15px] text-muted">Your password is changed and you&rsquo;re signed in.</p>
            <Link href="/" className="mt-10 inline-block rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-paper">
              Back to the record
            </Link>
          </div>
        ) : stage === "sent" ? (
          <div className="mt-14">
            <h1 className="font-serif text-[36px] font-normal leading-tight">Check your email</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              If that address belongs to the site&rsquo;s admin, a reset link is on its way. Open it on this computer to choose a new password.
            </p>
          </div>
        ) : stage === "request" ? (
          <form className="mt-14" onSubmit={requestEmail}>
            <h1 className="font-serif text-[36px] font-normal leading-tight tracking-[-0.01em]">Forgot your password?</h1>
            <p className="mt-3 text-[15px] text-muted">We&rsquo;ll email you a link to set a new one.</p>
            <label className="mt-10 block">
              <span className="text-sm text-muted">Email</span>
              <input
                className={field}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            {error ? <p className="mt-6 text-sm text-accent">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="mt-10 rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-paper disabled:opacity-40"
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
