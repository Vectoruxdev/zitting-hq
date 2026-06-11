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
        gap: "clamp(10px, 2.5vw, 24px)",
        padding: "0 clamp(14px, 3vw, 26px)",
        borderBottom: "1px solid var(--border-hairline)",
      }}
    >
      <Link
        href="/"
        style={{ display: "flex", alignItems: "center", gap: 10, flex: "none", whiteSpace: "nowrap" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/finance/mark.svg" width={28} height={28} alt="" style={{ borderRadius: 8 }} />
        <span className="zt-wordmark zhq-desktop-only" style={{ fontSize: 20, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
          Zitting <span style={{ color: "var(--accent)" }}>HQ</span>
        </span>
      </Link>
      {/* module nav scrolls horizontally on phones instead of wrapping/clipping */}
      <nav className="zhq-hscroll" style={{ display: "flex", alignItems: "center", gap: 2, overflowX: "auto", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>
        <Link
          href="/"
          style={{
            fontSize: 14,
            fontWeight: 500,
            padding: "7px 12px",
            borderRadius: "var(--radius-sm, 10px)",
            color: "var(--text-secondary)",
          }}
        >
          Home
        </Link>
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
      {isAuthConfigured && (
        <form action={signOut}>
          <button
            type="submit"
            style={{
              fontSize: 13,
              fontWeight: 500,
              whiteSpace: "nowrap",
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
