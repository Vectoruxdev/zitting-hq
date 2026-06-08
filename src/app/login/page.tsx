import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Family HQ" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  const redirectTo = redirect && redirect.startsWith("/") ? redirect : "/";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "radial-gradient(120% 90% at 50% 0%, var(--surface-card) 0%, var(--bg-void) 72%)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/finance/mark.svg" width={32} height={32} alt="" style={{ borderRadius: 9 }} />
          <span className="zt-wordmark" style={{ fontSize: 22, color: "var(--text-primary)" }}>
            Zitting <span style={{ color: "var(--accent)" }}>HQ</span>
          </span>
        </div>

        <div
          style={{
            background: "var(--surface-card)",
            border: "1px solid var(--border-hairline)",
            borderRadius: "var(--radius-lg, 18px)",
            padding: 24,
          }}
        >
          <h1
            style={{
              margin: "0 0 4px",
              fontSize: "var(--fs-h2, 18px)",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            Welcome back
          </h1>
          <p style={{ margin: "0 0 18px", fontSize: 13.5, color: "var(--text-secondary)" }}>
            Sign in to Family HQ.
          </p>
          <LoginForm redirectTo={redirectTo} />
        </div>
      </div>
    </div>
  );
}
