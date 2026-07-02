"use client";

/**
 * Route-level error boundary: an uncaught server exception used to render
 * Next's generic "Application error" screen. This keeps it branded and gives
 * a one-tap recovery (most of these are transient DB/pooler blips).
 */
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--bg-void, #0A0A0B)",
        color: "var(--text-primary, #EDEDEF)",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div className="zt-wordmark" style={{ fontSize: 28, marginBottom: 10 }}>
          Family HQ
        </div>
        <p style={{ fontSize: 14.5, color: "var(--text-secondary, #A0A0A8)", marginBottom: 18, lineHeight: 1.5 }}>
          Something hiccuped loading this page. It’s almost always a momentary
          connection blip — your data is safe.
        </p>
        <button
          onClick={() => reset()}
          style={{
            padding: "10px 22px",
            borderRadius: 10,
            border: "1px solid var(--border-hairline, rgba(255,255,255,.12))",
            background: "var(--surface-card, #141416)",
            color: "inherit",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
