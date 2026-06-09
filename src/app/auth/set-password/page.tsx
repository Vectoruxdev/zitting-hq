"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const router = useRouter();
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowserClient>>(null);
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Create the browser client only on the client (avoids prerender with no env).
  useEffect(() => {
    const sb = createSupabaseBrowserClient();
    supabaseRef.current = sb;
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setReady(!!data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      if (session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
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

  const field: React.CSSProperties = {
    height: 44, width: "100%", padding: "0 14px", background: "var(--surface-sunken)",
    border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md, 12px)",
    color: "var(--text-primary)", fontSize: 14, outline: "none",
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
          <h1 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>Set your password</h1>
          {ready ? (
            <>
              <p style={{ margin: "0 0 18px", fontSize: 13.5, color: "var(--text-secondary)" }}>Choose a password to finish setting up your Family HQ login.</p>
              <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input type="password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} style={field} autoComplete="new-password" />
                <input type="password" placeholder="Confirm password" value={pw2} onChange={(e) => setPw2(e.target.value)} style={field} autoComplete="new-password" />
                {error ? <p style={{ margin: 0, fontSize: 13, color: "var(--negative)" }}>{error}</p> : null}
                <button type="submit" disabled={busy} style={{ height: 44, marginTop: 4, borderRadius: "var(--radius-pill, 999px)", border: "1px solid transparent", background: "var(--btn-primary-bg)", color: "var(--btn-primary-fg)", fontSize: 14, fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
                  {busy ? "Saving…" : "Set password & continue"}
                </button>
              </form>
            </>
          ) : (
            <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--text-secondary)" }}>
              Open this page from your invitation link to continue. If the link expired, ask the owner to resend it.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
