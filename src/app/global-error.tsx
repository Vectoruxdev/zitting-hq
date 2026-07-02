"use client";

/**
 * Last-resort boundary (errors in the root layout itself). Must render its
 * own <html>/<body> because the layout is gone at this point.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0A0A0B",
          color: "#EDEDEF",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
          <div style={{ fontSize: 26, marginBottom: 10 }}>Family HQ</div>
          <p style={{ fontSize: 14.5, color: "#A0A0A8", marginBottom: 18, lineHeight: 1.5 }}>
            The app hit an unexpected error. Refresh to get back to it — your
            data is safe.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: "10px 22px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,.14)",
              background: "#141416",
              color: "inherit",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
