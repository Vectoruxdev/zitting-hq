import { SiteHeader } from "@/components/site-header";

/* Instant skeleton while the dashboard gathers its module summaries — the
   page paints immediately instead of hanging white during data fetch. */
export default function DashboardLoading() {
  const card = (h: number, span?: string) => (
    <div className="hq-skel" style={{ gridColumn: span, height: h, background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg, 18px)" }} />
  );
  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <main style={{ flex: 1, padding: "clamp(22px, 4vw, 44px) 18px 64px" }}>
        <div style={{ maxWidth: 1060, margin: "0 auto" }}>
          <div style={{ marginBottom: "clamp(22px, 3.5vw, 34px)" }}>
            <div className="hq-skel" style={{ width: 150, height: 12, borderRadius: 6, background: "var(--surface-card)", marginBottom: 14 }} />
            <div className="hq-skel" style={{ width: 320, height: 34, borderRadius: 10, background: "var(--surface-card)" }} />
          </div>
          <div className="hq-grid">
            {card(230, "span 2")}
            {card(230)}
            {card(190)}
            {card(190)}
          </div>
        </div>
      </main>
    </div>
  );
}
