"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { PasswordInput } from "@/components/password-input";

type Status = "loading" | "noConfig" | "ready" | "noSession";

export default function SetPasswordPage() {
  const router = useRouter();
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowserClient>>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // "request a new link" sub-flow (shown when the link is expired/invalid)
  const [reqEmail, setReqEmail] = useState("");
  const [reqMsg, setReqMsg] = useState("");
  const [reqBusy, setReqBusy] = useState(false);

  // Resolve which state we're in. Missing public env keys → noConfig (server
  // misconfig). A valid invite/recovery link establishes a session (read from
  // the URL) → ready. Otherwise, after a short grace for the URL to be
  // processed, → noSession (expired/used/wrong link).
  useEffect(() => {
    const sb = createSupabaseBrowserClient();
    supabaseRef.current = sb;
    if (!sb) {
      setStatus("noConfig");
      return;
    }
    let cancelled = false;
    // Establish a session from whatever shape the link arrives in:
    //  - ?token_hash=…&type=recovery|invite  → verifyOtp (the current default)
    //  - ?code=…                              → exchangeCodeForSession
    //  - #access_token=…                      → auto-handled by detectSessionInUrl
    // Relying on getSession() alone left valid links looking "expired" instantly.
    async function establish() {
      try {
        const url = new URL(window.location.href);
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");
        const code = url.searchParams.get("code");
        if (tokenHash && type) {
          await sb!.auth.verifyOtp({ token_hash: tokenHash, type: type as "recovery" | "invite" | "signup" | "magiclink" | "email" });
        } else if (code) {
          await sb!.auth.exchangeCodeForSession(code);
        }
      } catch {
        /* fall through — getSession decides below */
      }
      const { data } = await sb!.auth.getSession();
      if (cancelled) return;
      setStatus(data.session ? "ready" : "noSession");
    }
    establish();
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      if (session && !cancelled) setStatus("ready");
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const sb = supabaseRef.current;
    if (!sb) return setError("Auth isn't available. Open this page from your invite link.");
    if (pw.length < 8) return setError("Use at least 8 characters.");
    if (pw !== pw2) return setError("Passwords don't match.");
    setBusy(true);
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push("/finance");
  }

  async function requestNew(e: React.FormEvent) {
    e.preventDefault();
    setReqMsg("");
    const sb = supabaseRef.current;
    const email = reqEmail.trim().toLowerCase();
    if (!sb || !email) return;
    setReqBusy(true);
    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/set-password` : undefined;
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
    setReqBusy(false);
    setReqMsg(
      error
        ? error.message
        : "If that email has an account, a fresh link is on its way — check your inbox and spam. If it doesn't arrive, ask whoever invited you to resend it."
    );
  }

  const field: React.CSSProperties = {
    height: 44,
    width: "100%",
    padding: "0 14px",
    background: "var(--surface-sunken)",
    border: "1px solid var(--border-hairline)",
    borderRadius: "var(--radius-md, 12px)",
    color: "var(--text-primary)",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  };
  const primaryBtn: React.CSSProperties = {
    height: 44,
    marginTop: 4,
    borderRadius: "var(--radius-pill, 999px)",
    border: "1px solid transparent",
    background: "var(--btn-primary-bg)",
    color: "var(--btn-primary-fg)",
    fontSize: 14,
    fontWeight: 600,
    width: "100%",
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "radial-gradient(120% 90% at 50% 0%, var(--surface-card) 0%, var(--bg-void) 72%)" }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/finance/mark.svg" width={32} height={32} alt="" style={{ borderRadius: 9 }} />
          <span className="zt-wordmark" style={{ fontSize: 22, color: "var(--text-primary)" }}>
            Zitting <span style={{ color: "var(--accent)" }}>HQ</span>
          </span>
        </div>
        <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg, 18px)", padding: 24 }}>
          <h1 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>
            {status === "noConfig" ? "Almost there" : status === "noSession" ? "This link can't be used" : "Set your password"}
          </h1>

          {status === "loading" ? (
            <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--text-secondary)" }}>Checking your invite link…</p>
          ) : status === "ready" ? (
            <>
              <p style={{ margin: "0 0 18px", fontSize: 13.5, color: "var(--text-secondary)" }}>Choose a password to finish setting up your Family HQ login.</p>
              <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <PasswordInput placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} style={field} autoComplete="new-password" />
                <PasswordInput placeholder="Confirm password" value={pw2} onChange={(e) => setPw2(e.target.value)} style={field} autoComplete="new-password" />
                {error ? <p style={{ margin: 0, fontSize: 13, color: "var(--negative)" }}>{error}</p> : null}
                <button type="submit" disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1, cursor: busy ? "default" : "pointer" }}>
                  {busy ? "Saving…" : "Set password & continue"}
                </button>
              </form>
            </>
          ) : status === "noConfig" ? (
            <>
              <p style={{ margin: "0 0 8px", fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                Your link worked, but this site isn&apos;t finished configuring sign-in yet, so passwords can&apos;t be set right now.
              </p>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
                Ask the account owner to add the public Supabase keys (a one-time setup step) and resend your invite.
              </p>
            </>
          ) : (
            // noSession — expired / already used / wrong link
            <>
              <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                This invite link has expired or was already used. Enter your email and we&apos;ll send a fresh one.
              </p>
              <form onSubmit={requestNew} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={reqEmail}
                  onChange={(e) => setReqEmail(e.target.value)}
                  style={field}
                />
                {reqMsg ? <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{reqMsg}</p> : null}
                <button type="submit" disabled={reqBusy || !reqEmail.trim()} style={{ ...primaryBtn, opacity: reqBusy || !reqEmail.trim() ? 0.6 : 1, cursor: reqBusy ? "default" : "pointer" }}>
                  {reqBusy ? "Sending…" : "Send me a new link"}
                </button>
              </form>
              <p style={{ margin: "14px 0 0", fontSize: 12.5, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
                If it doesn&apos;t arrive in a few minutes (check spam), ask whoever invited you to resend your invite link.
              </p>
            </>
          )}
        </div>

        <p style={{ margin: "16px 4px 0", fontSize: 12, color: "var(--text-tertiary)", textAlign: "center" }}>
          Already set up? <a href="/login" style={{ color: "var(--accent)", textDecoration: "none" }}>Sign in</a>
        </p>
      </div>
    </div>
  );
}
