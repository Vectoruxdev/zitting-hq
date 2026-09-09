"use client";
import * as React from "react";
import { Button, Input } from "@/ui";
import { requestPasswordReset } from "../actions";

export function ForgotForm() {
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  if (done) return <p role="status" style={{ margin: 0, font: "var(--type-body)", color: "var(--text-primary)" }}>Check your email. If <b>{email}</b> is on the family roster, the link is there — it may take a minute, and it might land in spam. Didn’t get it? Ask Jared to send one from People.</p>;
  return (
    <form style={{ display: "flex", flexDirection: "column", gap: 12 }} onSubmit={async (e) => { e.preventDefault(); if (!email.trim()) return; setBusy(true); try { await requestPasswordReset(email); } finally { setBusy(false); setDone(true); } }}>
      <Input label="Email" type="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Button type="submit" size="lg" fullWidth loading={busy} disabled={!email.trim()}>Send me a reset link</Button>
    </form>
  );
}
