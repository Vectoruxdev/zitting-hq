import Link from "next/link";
import { MODULES } from "@/lib/modules";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <main style={{ flex: 1, padding: "56px 26px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ marginBottom: 40 }}>
            <p className="zt-eyebrow" style={{ marginBottom: 8 }}>
              Zitting household
            </p>
            <h1
              style={{
                fontSize: "var(--fs-title, 28px)",
                fontWeight: 600,
                letterSpacing: "var(--ls-tight, -0.015em)",
                color: "var(--text-primary)",
              }}
            >
              Family HQ
            </h1>
            <p style={{ marginTop: 10, maxWidth: 520, color: "var(--text-secondary)" }}>
              One place for how the family runs. Finance is up first — more
              modules are on the way.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 16,
            }}
          >
            {MODULES.map((m) => {
              const active = m.status === "active";
              const card = (
                <div
                  style={{
                    height: "100%",
                    background: "var(--surface-card)",
                    border: "1px solid var(--border-hairline)",
                    borderRadius: "var(--radius-lg, 18px)",
                    padding: 20,
                    boxShadow: "var(--shadow-card, none)",
                    opacity: active ? 1 : 0.62,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 24 }} aria-hidden>
                      {m.icon}
                    </span>
                    {!active && (
                      <span
                        className="zt-eyebrow"
                        style={{
                          border: "1px solid var(--border-hairline)",
                          borderRadius: 999,
                          padding: "3px 9px",
                        }}
                      >
                        Soon
                      </span>
                    )}
                  </div>
                  <h2
                    style={{
                      marginTop: 14,
                      fontSize: "var(--fs-h2, 18px)",
                      fontWeight: 600,
                      letterSpacing: "var(--ls-tight, -0.015em)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {m.name}
                  </h2>
                  <p style={{ marginTop: 6, fontSize: 13.5, color: "var(--text-secondary)" }}>
                    {m.description}
                  </p>
                </div>
              );
              return active ? (
                <Link key={m.slug} href={`/${m.slug}`} style={{ display: "block" }}>
                  {card}
                </Link>
              ) : (
                <div key={m.slug}>{card}</div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
