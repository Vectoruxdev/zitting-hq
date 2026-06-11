import { LoginForm } from "./login-form";
import { MODULES } from "@/lib/modules";

export const metadata = { title: "Sign in · Zitting HQ" };

/**
 * Login landing — the one page a signed-out visitor sees, so it carries the
 * pitch: what Zitting HQ is, how it works, and where it's headed. Private
 * family app; the copy stays generic (no live numbers, no names).
 */

const HOW_IT_WORKS = [
  {
    icon: "🏦",
    title: "Banks sync themselves",
    body: "Accounts and transactions flow in automatically, read-only. Balances reconcile to the bank on every sync — no spreadsheets, no manual entry.",
  },
  {
    icon: "🧠",
    title: "It learns how you categorize",
    body: "Every fix teaches it. Bulk 'tidy up' clears a month in minutes, and the review queue keeps everyone honest about where money went.",
  },
  {
    icon: "📬",
    title: "Money gets where it should",
    body: "Paychecks trigger an allocation checklist — tithing, bills, savings, allowances. Nothing moves without you; the app just watches the bank and checks things off when the real transfer lands.",
  },
  {
    icon: "👨‍👩‍👧‍👦",
    title: "Everyone gets their own view",
    body: "Kids see their accounts, their spending money, and their goals — and nothing else. Reviewing transactions unlocks the monthly allowance.",
  },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  const redirectTo = redirect && redirect.startsWith("/") ? redirect : "/";
  const planned = MODULES.filter((m) => m.status === "planned");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(120% 90% at 50% 0%, var(--surface-card) 0%, var(--bg-void) 72%)",
        overflowY: "auto",
      }}
    >
      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "clamp(28px, 6vh, 72px) 24px 56px" }}>
        {/* wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "clamp(28px, 6vh, 56px)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/finance/mark.svg" width={32} height={32} alt="" style={{ borderRadius: 9 }} />
          <span className="zt-wordmark" style={{ fontSize: 22, color: "var(--text-primary)" }}>
            Zitting <span style={{ color: "var(--accent)" }}>HQ</span>
          </span>
        </div>

        {/* hero + sign-in */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "var(--grid-split, 1fr 360px)",
            gap: "clamp(28px, 5vw, 64px)",
            alignItems: "start",
          }}
        >
          <div>
            <p className="zt-eyebrow" style={{ marginBottom: 14 }}>The family home base</p>
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(30px, 4.5vw, 44px)",
                lineHeight: 1.12,
                fontWeight: 600,
                letterSpacing: "-0.025em",
                color: "var(--text-primary)",
              }}
            >
              One place for how
              <br />
              the family <span style={{ color: "var(--accent)" }}>runs</span>.
            </h1>
            <p style={{ margin: "18px 0 0", maxWidth: 480, fontSize: 15.5, lineHeight: 1.65, color: "var(--text-secondary)" }}>
              Zitting HQ keeps the household&apos;s money honest and visible — live bank sync,
              budgets that fill themselves in, a transfer checklist that knows when a
              paycheck lands, and a kid-friendly view that turns categorizing into
              allowance. Calendar, meals, and groceries are next.
            </p>
          </div>

          {/* sign-in card */}
          <div
            style={{
              background: "var(--surface-card)",
              border: "1px solid var(--border-hairline)",
              borderRadius: "var(--radius-lg, 18px)",
              padding: 24,
              position: "sticky",
              top: 24,
            }}
          >
            <h2 style={{ margin: "0 0 4px", fontSize: "var(--fs-h2, 18px)", fontWeight: 600, color: "var(--text-primary)" }}>
              Welcome back
            </h2>
            <p style={{ margin: "0 0 18px", fontSize: 13.5, color: "var(--text-secondary)" }}>
              Sign in to Zitting HQ. Family members only.
            </p>
            <LoginForm redirectTo={redirectTo} />
            <p style={{ margin: "16px 0 0", fontSize: 12, lineHeight: 1.55, color: "var(--text-tertiary)" }}>
              Invited but no password yet? Use the link in your invite email to set one.
            </p>
          </div>
        </div>

        {/* how it works — below the hero/sign-in pair so phones reach the
            form without scrolling past four cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 14, marginTop: "clamp(32px, 6vh, 56px)" }}>
          {HOW_IT_WORKS.map((f) => (
            <div
              key={f.title}
              style={{
                background: "var(--surface-card)",
                border: "1px solid var(--border-hairline)",
                borderRadius: "var(--radius-lg, 18px)",
                padding: 18,
                minWidth: 0,
              }}
            >
              <span style={{ fontSize: 22 }} aria-hidden>{f.icon}</span>
              <h2 style={{ margin: "10px 0 6px", fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{f.title}</h2>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--text-secondary)" }}>{f.body}</p>
            </div>
          ))}
        </div>

        {/* roadmap */}
        <div style={{ marginTop: "clamp(40px, 8vh, 72px)" }}>
          <p className="zt-eyebrow" style={{ marginBottom: 14 }}>What&apos;s coming</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            {planned.map((m) => (
              <div
                key={m.slug}
                style={{
                  background: "var(--surface-card)",
                  border: "1px solid var(--border-hairline)",
                  borderRadius: "var(--radius-lg, 18px)",
                  padding: 18,
                  opacity: 0.85,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 22 }} aria-hidden>{m.icon}</span>
                  <span className="zt-eyebrow" style={{ border: "1px solid var(--border-hairline)", borderRadius: 999, padding: "3px 9px" }}>Soon</span>
                </div>
                <h3 style={{ margin: "12px 0 4px", fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{m.name}</h3>
                <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "var(--text-secondary)" }}>{m.description}</p>
              </div>
            ))}
          </div>
        </div>

        <p style={{ margin: "40px 0 0", fontSize: 12, color: "var(--text-tertiary)" }}>
          A private app for the Zitting household. Read-only bank access — it never moves money.
        </p>
      </div>
    </div>
  );
}
