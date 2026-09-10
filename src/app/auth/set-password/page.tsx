"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { PasswordInput } from "@/components/password-input";
import { requestPasswordReset } from "@/app/login/actions";

type Status = "loading" | "noConfig" | "ready" | "noSession";

// Public keys are inlined at build time, so "is sign-in configured" is a constant.
const AUTH_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function SetPasswordPage() {
  const router = useRouter();
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowserClient>>(null);
  const [status, setStatus] = useState<Status>(AUTH_CONFIGURED ? "loading" : "noConfig");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // "request a new link" sub-flow (shown when the link is expired/invalid)
  const [reqEmail, setReqEmail] = useState("");
  const [reqMsg, setReqMsg] = useState("");
  const [reqBusy, setReqBusy] = useState(false);
  const [reqDone, setReqDone] = useState(false);
  // What kind of link this is (recovery = "reset my password", invite = first
  // login) and why it failed, when it did — both read from the URL.
  const [linkType, setLinkType] = useState<"recovery" | "invite" | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Resolve which state we're in. Missing public env keys → noConfig (server
  // misconfig). A valid invite/recovery link establishes a session (read from
  // the URL) → ready. Otherwise, after a short grace for the URL to be
  // processed, → noSession (expired/used/wrong link).
  useEffect(() => {
    const sb = createSupabaseBrowserClient();
    supabaseRef.current = sb;
    if (!sb) return; // status already "noConfig"
    let cancelled = false;
    // Establish a session from whatever shape the link arrives in:
    //  - ?token_hash=…&type=recovery|invite  → verifyOtp (our own emails)
    //  - ?code=…                              → exchangeCodeForSession (PKCE)
    //  - #access_token=…&refresh_token=…      → setSession (Supabase's own
    //    emails: implicit flow, which the PKCE browser client won't auto-read)
    //  - #error=…&error_code=otp_expired      → say so plainly
    // Relying on getSession() alone left valid links looking "expired" instantly.
    async function establish() {
      try {
        const url = new URL(window.location.href);
        const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type") || hash.get("type");
        const code = url.searchParams.get("code");
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        const errCode = url.searchParams.get("error_code") || hash.get("error_code");
        const errDesc = url.searchParams.get("error_description") || hash.get("error_description");
        if (type === "recovery" || type === "invite") setLinkType(type);
        if (errCode || errDesc) setLinkError(errCode === "otp_expired" ? "expired" : (errDesc || errCode || "invalid").replace(/\+/g, " "));
        if (tokenHash && type) {
          const { error } = await sb!.auth.verifyOtp({ token_hash: tokenHash, type: type as "recovery" | "invite" | "signup" | "magiclink" | "email" });
          if (error) setLinkError(/expired|invalid|not found/i.test(error.message) ? "expired" : error.message);
        } else if (code) {
          const { error } = await sb!.auth.exchangeCodeForSession(code);
          if (error) setLinkError(error.message);
        } else if (accessToken && refreshToken) {
          const { error } = await sb!.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) setLinkError(error.message);
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
    router.push("/");
    router.refresh();
  }

  // Ask for a fresh link. Goes through our server (roster emails only, sent
  // with our own template) rather than Supabase's mailer, which rate-limits to
  // one request a minute and once answered 429 right after a real reset.
  async function requestNew(e: React.FormEvent) {
    e.preventDefault();
    setReqMsg("");
    const email = reqEmail.trim().toLowerCase();
    if (!email) return;
    setReqBusy(true);
    try {
      await requestPasswordReset(email);
      setReqDone(true);
      setReqMsg(`Check your email. If ${email} is on the family roster, a fresh link is there — give it a minute, and look in spam. Didn’t get it? Ask Jared to send one from People.`);
    } catch {
      setReqMsg("Something went wrong sending the link. Try again in a minute, or ask Jared to send one from People.");
    } finally {
      setReqBusy(false);
    }
  }

  const field: React.CSSProperties = {
    height: 44,
    width: "100%",
    padding: "0 14px",
    background: "var(--surface-sunken)",
    border: "1px solid var(--border-hairline)",
    borderRadius: "var(--radius-md, 12px)",
    color: "var(--text-primary)",
    fontSize: "max(14px, var(--fs-control-min, 0px))",
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
            {status === "noConfig" ? "Almost there" : status === "noSession" ? "This link can't be used" : linkType === "recovery" ? "Choose a new password" : "Set your password"}
          </h1>

          {status === "loading" ? (
            <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--text-secondary)" }}>Checking your link…</p>
          ) : status === "ready" ? (
            <>
              <p style={{ margin: "0 0 18px", fontSize: 13.5, color: "var(--text-secondary)" }}>{linkType === "recovery" ? "Pick a new password for your Zitting HQ login. You’ll be signed in as soon as it’s saved." : "Choose a password to finish setting up your Zitting HQ login."}</p>
              <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <PasswordInput placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} style={field} autoComplete="new-password" />
                <PasswordInput placeholder="Confirm password" value={pw2} onChange={(e) => setPw2(e.target.value)} style={field} autoComplete="new-password" />
                {error ? <p style={{ margin: 0, fontSize: 13, color: "var(--negative)" }}>{error}</p> : null}
                <button type="submit" disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1, cursor: busy ? "default" : "pointer" }}>
                  {busy ? "Saving…" : linkType === "recovery" ? "Save new password" : "Set password & continue"}
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
                {linkError === "expired"
                  ? "This link has expired or was already used — each one works once, for about an hour."
                  : linkError
                    ? `This link didn’t work (${linkError}).`
                    : "This page needs to be opened from a link in your email — the link may have expired, been used already, or been cut short when it was copied."}
                {" "}Enter your email and we&apos;ll send a fresh one.
              </p>
              {reqDone ? (
                <p role="status" style={{ margin: 0, fontSize: 13.5, color: "var(--text-primary)", lineHeight: 1.5 }}>{reqMsg}</p>
              ) : (
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
              )}
              <p style={{ margin: "14px 0 0", fontSize: 12.5, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
                Open the new link on this same device, straight from the email. If it doesn&apos;t arrive in a few minutes (check spam), Jared can send one from People.
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
