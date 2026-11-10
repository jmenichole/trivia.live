"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function callbackUrl(next: string): string {
  const url = new URL("/auth/callback", window.location.origin);
  url.searchParams.set("next", next);
  return url.toString();
}

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function signInWithDiscord() {
    setError(null);
    const { error: err } = await createClient().auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo: callbackUrl(next), scopes: "identify email" },
    });
    if (err) setError(err.message);
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("sending");
    const { error: err } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl(next) },
    });
    if (err) {
      setError(err.message);
      setStatus("idle");
      return;
    }
    setStatus("sent");
  }

  return (
    <div className="show-card login-card">
      <button type="button" className="btn btn-discord" onClick={signInWithDiscord}>
        Continue with Discord
      </button>

      <p className="login-divider">or get a sign-in link by email</p>

      {status === "sent" ? (
        <p className="answered-msg">Check {email} for your sign-in link.</p>
      ) : (
        <form className="admin-form" onSubmit={sendMagicLink}>
          <label className="admin-label">
            Email
            <input
              type="email"
              className="admin-input"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <button type="submit" className="btn" disabled={status === "sending"}>
            {status === "sending" ? "Sending…" : "Email me a link"}
          </button>
        </form>
      )}

      {error && <p className="admin-error">{error}</p>}
    </div>
  );
}
