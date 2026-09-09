import * as React from "react";
import { Icon } from "../core/Icon";

export interface EmptyStateProps {
  icon?: string;
  title?: string;
  body?: string;
  action?: React.ReactNode;
  secondary?: React.ReactNode;
  tone?: "default" | "error";
  ratio?: string;
  compact?: boolean;
  style?: React.CSSProperties;
}

/** Empty states anticipate photos: a dashed photo frame with the module icon, a warm sentence, one action. Never a sad illustration. `tone="error"` for failures (with retry). */
export function EmptyState({ icon = "image", title, body, action, secondary, tone = "default", ratio = "var(--ratio-card)", compact = false, style }: EmptyStateProps) {
  const err = tone === "error";
  return (
    <div role={err ? "alert" : undefined} style={{ display: "flex", flexDirection: compact ? "row" : "column", alignItems: "center", gap: 16, padding: compact ? 16 : "32px 24px", textAlign: compact ? "left" : "center", borderRadius: "var(--radius-card)", background: err ? "var(--negative-soft)" : "transparent", ...style }}>
      <div aria-hidden style={{ width: compact ? 72 : "min(100%, 220px)", aspectRatio: compact ? "1 / 1" : ratio, flex: "none", display: "grid", placeItems: "center", borderRadius: compact ? "var(--radius-md)" : "var(--radius-photo)", border: `1.5px dashed ${err ? "var(--negative)" : "var(--border-strong)"}`, background: err ? "transparent" : "var(--photo-placeholder)", color: err ? "var(--negative)" : "var(--text-tertiary)" }}>
        <Icon name={err ? "circle-alert" : icon} size={compact ? 24 : 32} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 360, minWidth: 0 }}>
        {title ? <h3 style={{ margin: 0, font: compact ? "var(--type-h3)" : "var(--type-h2)", color: "var(--text-primary)" }}>{title}</h3> : null}
        {body ? <p style={{ margin: 0, font: "var(--type-body-sm)", color: "var(--text-secondary)", textWrap: "pretty" }}>{body}</p> : null}
        {action || secondary ? <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: compact ? "flex-start" : "center", flexWrap: "wrap" }}>{action}{secondary}</div> : null}
      </div>
    </div>
  );
}
