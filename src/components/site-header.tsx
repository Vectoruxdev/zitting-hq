import Link from "next/link";
import { MODULES } from "@/lib/modules";
import { signOut } from "@/app/login/actions";
import { isAuthConfigured } from "@/lib/supabase/server";

export function SiteHeader() {
  return (
    <header
      style={{
        height: "var(--topbar-h, 60px)",
        display: "flex",
        alignItems: "center",
        gap: 24,
        padding: "0 26px",
        borderBottom: "1px solid var(--border-hairline)",
      }}
    >
      <Link
        href="/"
        style={{ display: "flex", alignItems: "center", gap: 10 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/finance/mark.svg" width={28} height={28} alt="" style={{ borderRadius: 8 }} />
        <span className="zt-wordmark" style={{ fontSize: 20, color: "var(--text-primary)" }}>
          Zitting <span style={{ color: "var(--accent)" }}>HQ</span>
        </span>
      </Link>
      <nav style={{ display: "flex", alignItems: "center", gap: 2 }}>
        {MODULES.map((m) => {
          const active = m.status === "active";
          return (
            <Link
              key={m.slug}
              href={active ? `/${m.slug}` : "/"}
              aria-disabled={!active}
              style={{
                fontSize: 14,
                fontWeight: 500,
                padding: "7px 12px",
                borderRadius: "var(--radius-sm, 10px)",
                color: active ? "var(--text-secondary)" : "var(--text-tertiary)",
                pointerEvents: active ? undefined : "none",
                opacity: active ? 1 : 0.6,
              }}
            >
              {m.name}
            </Link>
          );
        })}
      </nav>
      <div style={{ flex: 1 }} />
      {isAuthConfigured && (
        <form action={signOut}>
          <button
            type="submit"
            style={{
              fontSize: 13,
              fontWeight: 500,
              padding: "7px 12px",
              borderRadius: "var(--radius-sm, 10px)",
              border: "1px solid var(--border-hairline)",
              background: "var(--surface-raised)",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </form>
      )}
    </header>
  );
}
