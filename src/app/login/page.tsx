import { LoginForm } from "./login-form";
import { Icon } from "@/ui";
import { loginQuote } from "@/db/quotes";
import { familyTodayISO } from "@/db/dashboard";

export const metadata = { title: "Sign in · Zitting HQ" };
export const dynamic = "force-dynamic";

/**
 * Login — the one page a signed-out visitor sees. Everyone who lands here
 * already belongs, so there is no pitch: the wordmark, today's quote from the
 * curated login set (never the kids' words — those stay behind the login), and
 * the sign-in card.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
  const { redirect } = await searchParams;
  const redirectTo = redirect && redirect.startsWith("/") ? redirect : "/";
  const quote = await loginQuote(familyTodayISO()).catch(() => null);
  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg-app)", display: "flex", flexDirection: "column" }}>
      <div style={{ width: "100%", maxWidth: 1120, margin: "0 auto", padding: "clamp(24px, 5vh, 56px) var(--page-gutter-mobile) 48px", display: "flex", flexDirection: "column", gap: "clamp(32px, 7vh, 72px)", flex: 1 }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ font: "500 var(--fs-xl)/1 var(--font-display)", color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Zitting <span style={{ color: "var(--accent)" }}>HQ</span></span>
          <span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}>Family only</span>
        </header>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: "clamp(32px, 6vw, 80px)", alignItems: "center", flex: 1 }}>
          <figure style={{ margin: 0, display: "flex", flexDirection: "column", gap: 18, animation: "zh-fade-up var(--dur-slow) var(--ease-out) both" }}>
            <Icon name="quote" size={22} color="var(--accent)" />
            <blockquote style={{ margin: 0, font: "var(--type-quote)", fontSize: "clamp(var(--fs-2xl), 3.6vw, var(--fs-4xl))", lineHeight: "var(--lh-snug)", textWrap: "balance", color: "var(--text-primary)", maxWidth: 560 }}>
              {quote?.text ?? "The family's home base — money, meals, the calendar, and the moments worth keeping."}
            </blockquote>
            {quote?.who ? <figcaption style={{ font: "var(--type-label)", color: "var(--text-secondary)" }}>{quote.who}</figcaption> : null}
          </figure>
          <div style={{ background: "var(--surface-card)", borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-2)", padding: "var(--space-7)", maxWidth: 420, width: "100%", justifySelf: "end", animation: "zh-fade-up var(--dur-slow) var(--ease-out) 120ms both" }}>
            <h1 style={{ margin: "0 0 4px", font: "var(--type-h2)", color: "var(--text-primary)" }}>Welcome home</h1>
            <p style={{ margin: "0 0 18px", font: "var(--type-body-sm)", color: "var(--text-secondary)" }}>Sign in to Zitting HQ.</p>
            <LoginForm redirectTo={redirectTo} />
            <p style={{ margin: "16px 0 0", font: "var(--type-caption)", color: "var(--text-tertiary)", lineHeight: 1.55 }}>Invited but no password yet? Use the link in your invite email to set one.</p>
          </div>
        </div>
        <p style={{ margin: 0, font: "var(--type-caption)", color: "var(--text-tertiary)" }}>A private app for the Zitting household. Read-only bank access — it never moves money.</p>
      </div>
    </div>
  );
}
