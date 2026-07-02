import { SiteHeader } from "@/components/site-header";

/* Instant skeleton while the calendar data loads (force-dynamic page). */
export default function CalendarLoading() {
  const card = (h: number) => (
    <div
      className="hq-skel"
      style={{ height: h, background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg, 18px)", marginBottom: 16 }}
    />
  );
  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <main style={{ flex: 1, padding: "clamp(22px, 4vw, 44px) 18px 64px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div className="hq-skel" style={{ width: 260, height: 32, borderRadius: 10, background: "var(--surface-card)", marginBottom: 24 }} />
          {card(120)}
          {card(320)}
          {card(200)}
        </div>
      </main>
    </div>
  );
}
