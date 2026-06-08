"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "./actions";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signIn, {});

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
  };

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input type="hidden" name="redirect" value={redirectTo} />
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span className="zt-eyebrow">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          style={field}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span className="zt-eyebrow">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          style={field}
        />
      </label>

      {state?.error && (
        <p style={{ margin: 0, fontSize: 13, color: "var(--negative)" }}>{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        style={{
          height: 44,
          marginTop: 4,
          borderRadius: "var(--radius-pill, 999px)",
          border: "1px solid transparent",
          background: "var(--btn-primary-bg)",
          color: "var(--btn-primary-fg)",
          fontSize: 14,
          fontWeight: 600,
          cursor: pending ? "default" : "pointer",
          opacity: pending ? 0.6 : 1,
        }}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
