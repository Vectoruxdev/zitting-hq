import Link from "next/link";
import { ForgotForm } from "./forgot-form";

export const metadata = { title: "Reset password · Zitting HQ" };

export default function ForgotPage() {
  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg-app)", display: "grid", placeItems: "center", padding: "clamp(24px, 5vh, 56px) var(--page-gutter-mobile)" }}>
      <div style={{ width: "100%", maxWidth: 420, background: "var(--surface-card)", borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-2)", padding: "var(--space-7)", animation: "zh-fade-up var(--dur-slow) var(--ease-out) both" }}>
        <span style={{ display: "block", font: "500 var(--fs-xl)/1 var(--font-display)", color: "var(--text-primary)", letterSpacing: "-0.01em", marginBottom: 18 }}>Zitting <span style={{ color: "var(--accent)" }}>HQ</span></span>
        <h1 style={{ margin: "0 0 4px", font: "var(--type-h2)", color: "var(--text-primary)" }}>Reset your password</h1>
        <p style={{ margin: "0 0 18px", font: "var(--type-body-sm)", color: "var(--text-secondary)" }}>Enter the email you sign in with. If it belongs to someone in the family, a link to choose a new password is on its way.</p>
        <ForgotForm />
        <p style={{ margin: "16px 0 0", font: "var(--type-caption)", color: "var(--text-tertiary)" }}><Link href="/login" className="zh-link" style={{ color: "var(--accent)" }}>Back to sign in</Link></p>
      </div>
    </div>
  );
}
