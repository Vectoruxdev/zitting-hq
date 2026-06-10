"use client";
import React from "react";

interface Props {
  children: React.ReactNode;
  /** Shown in console + telemetry to identify which area failed. */
  label?: string;
  /** Optional extra action when the user taps "Try again". */
  onReset?: () => void;
  /** Compact variant for embedding inside the member phone frame. */
  compact?: boolean;
}
interface State {
  error: Error | null;
}

/**
 * Catches render/runtime errors in a subtree so one broken screen can't take
 * down the whole app (the window-global screens render off `window.ZHQ_DATA`,
 * so a single bad data shape would otherwise white-screen everything). Give it a
 * `key` that changes per route and it auto-recovers on navigation.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Never throw further — just record it. Visible in the browser console and
    // (on Vercel) the function logs for client components.
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary${this.props.label ? ` · ${this.props.label}` : ""}]`, error, info?.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;
    const compact = this.props.compact;
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: 12,
          padding: compact ? "40px 20px" : "64px 24px",
          minHeight: compact ? 240 : 320,
        }}
      >
        <span
          style={{
            width: 48,
            height: 48,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            background: "var(--negative-soft, rgba(220,80,80,0.15))",
            color: "var(--negative, #e26)",
            fontSize: 24,
            fontWeight: 700,
          }}
        >
          !
        </span>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>This screen hit a snag</div>
        <div style={{ fontSize: 13.5, color: "var(--text-secondary)", maxWidth: 360, lineHeight: 1.5 }}>
          Something didn&apos;t load right here, but the rest of your data is safe. Try again, or reload the app.
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
          <button
            onClick={this.reset}
            style={{
              height: 40,
              padding: "0 16px",
              borderRadius: "var(--radius-pill, 999px)",
              border: "1px solid var(--border-hairline, #333)",
              background: "var(--surface-card, #1a1a1c)",
              color: "var(--text-primary, #fff)",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <button
            onClick={() => typeof window !== "undefined" && window.location.reload()}
            style={{
              height: 40,
              padding: "0 16px",
              borderRadius: "var(--radius-pill, 999px)",
              border: "1px solid transparent",
              background: "var(--btn-primary-bg, var(--accent, #3FD07F))",
              color: "var(--btn-primary-fg, #06281a)",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload app
          </button>
        </div>
        {process.env.NODE_ENV !== "production" ? (
          <pre style={{ marginTop: 14, maxWidth: 480, overflow: "auto", fontSize: 11, color: "var(--text-tertiary)", textAlign: "left" }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
        ) : null}
      </div>
    );
  }
}
