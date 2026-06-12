import Link from "next/link";
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
      {/* The logo is the only header nav — it returns to the dashboard, where
          the cards are the navigation. */}
      <Link
        href="/"
        title="Family HQ home"
        style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, whiteSpace: "nowrap" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/finance/mark.svg" width={28} height={28} alt="" style={{ borderRadius: 8 }} />
        <span className="zt-wordmark" style={{ fontSize: 20, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
          Zitting <span style={{ color: "var(--accent)" }}>HQ</span>
        </span>
      </Link>
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
