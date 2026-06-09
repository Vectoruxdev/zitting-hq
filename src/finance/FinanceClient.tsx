"use client";

import dynamic from "next/dynamic";

/**
 * The finance app bootstraps against `window` (icons, data, theme, screen
 * registration), so it must run client-only — no SSR. A branded full-screen
 * fallback covers the brief load before the chunk arrives.
 */
const FinanceApp = dynamic(() => import("./FinanceApp"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: "100vh",
        display: "grid",
        placeItems: "center",
        background: "var(--bg-app)",
        color: "var(--text-tertiary)",
        fontFamily: "var(--font-sans)",
        fontSize: 13,
        letterSpacing: "0.02em",
      }}
    >
      Loading Zitting HQ…
    </div>
  ),
});

export default function FinanceClient({
  data,
  role = "owner",
  name,
}: {
  data?: unknown;
  role?: "owner" | "partner" | "member";
  name?: string;
}) {
  return (
    <div style={{ height: "100vh", overflow: "hidden", background: "var(--bg-app)" }}>
      <FinanceApp data={data} role={role} name={name} />
    </div>
  );
}
