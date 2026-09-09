import * as React from "react";
import { Icon } from "../core/Icon";

export type AlertTone = "info" | "positive" | "warning" | "negative" | "accent";
const ICON: Record<AlertTone, string> = { info: "info", positive: "circle-check", warning: "triangle-alert", negative: "circle-alert", accent: "sparkles" };

export interface InlineAlertProps {
  tone?: AlertTone;
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  onDismiss?: () => void;
  icon?: string;
  style?: React.CSSProperties;
}

/** Inline message in the page flow — sync failed, coverage short, bank reconnect. Soft tinted, rounded, one optional action. Not a toast (those float) and not an EmptyState (that replaces content). */
export function InlineAlert({ tone = "info", title, children, action, onDismiss, icon, style }: InlineAlertProps) {
  const c = tone === "accent" ? "var(--accent)" : `var(--${tone})`;
  return (
    <div role={tone === "negative" || tone === "warning" ? "alert" : "status"} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderRadius: "var(--radius-lg)", background: tone === "accent" ? "var(--accent-soft)" : `var(--${tone}-soft)`, color: "var(--text-primary)", ...style }}>
      <Icon name={icon || ICON[tone]} size={20} color={c} style={{ marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        {title ? <span style={{ font: "var(--type-label)", fontWeight: 600 }}>{title}</span> : null}
        {children ? <span style={{ font: "var(--type-body-sm)", color: "var(--text-secondary)", textWrap: "pretty" }}>{children}</span> : null}
      </div>
      {action ? <div style={{ flex: "none" }}>{action}</div> : null}
      {onDismiss ? <button type="button" aria-label="Dismiss" onClick={onDismiss} style={{ border: 0, background: "transparent", color: "var(--text-tertiary)", cursor: "pointer", display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: 14, padding: 0, marginTop: -2 }}><Icon name="x" size={14} /></button> : null}
    </div>
  );
}
