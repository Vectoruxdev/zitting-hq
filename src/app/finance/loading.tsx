/* Branded splash while getFinanceData runs server-side — replaces the blank
   screen (force-dynamic pages render nothing until data resolves). Matches
   the client BootSplash so the handoff is seamless. */
export default function FinanceLoading() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        background: "var(--bg-void, #0A0A0B)",
        color: "var(--text-primary, #EDEDEF)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div className="zt-wordmark" style={{ fontSize: 30, marginBottom: 14 }}>
          Zitting HQ
        </div>
        <div
          className="zt-skeleton"
          style={{ width: 160, height: 3, borderRadius: 2, margin: "0 auto", background: "var(--surface-card, #141416)" }}
        />
      </div>
    </div>
  );
}
