import * as React from "react";
import { Icon } from "../core/Icon";

export type BadgeTone = "neutral" | "accent" | "positive" | "negative" | "warning" | "info";
const TONES: Record<BadgeTone, [string, string]> = {
  neutral: ["var(--surface-sunken)", "var(--text-secondary)"],
  accent: ["var(--accent-soft)", "var(--accent-hover)"],
  positive: ["var(--positive-soft)", "var(--positive)"],
  negative: ["var(--negative-soft)", "var(--negative)"],
  warning: ["var(--warning-soft)", "var(--warning)"],
  info: ["var(--info-soft)", "var(--info)"],
};

export interface BadgeProps {
  children?: React.ReactNode;
  tone?: BadgeTone;
  solid?: boolean;
  dot?: boolean;
  icon?: string;
  size?: "sm" | "md";
  style?: React.CSSProperties;
}

/** Status badge. `solid` inverts to a filled pill (for counts on dark photo chrome, verdicts). `dot` renders a tiny status dot only. */
export function Badge({ children, tone = "neutral", solid = false, dot = false, icon, size = "md", style }: BadgeProps) {
  const [bg, fg] = TONES[tone] || TONES.neutral;
  if (dot) return <span aria-hidden style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: fg, flex: "none", ...style }} />;
  const solidBg = tone === "neutral" ? "var(--text-primary)" : fg;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, height: size === "sm" ? 18 : 22, padding: size === "sm" ? "0 6px" : "0 8px", borderRadius: "var(--radius-pill)", background: solid ? solidBg : bg, color: solid ? (tone === "neutral" ? "var(--bg-app)" : "#fff") : fg, font: `600 ${size === "sm" ? "var(--fs-2xs)" : "var(--fs-xs)"}/1 var(--font-ui)`, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", letterSpacing: "0.01em", ...style }}>
      {icon ? <Icon name={icon} size={size === "sm" ? 10 : 12} /> : null}{children}
    </span>
  );
}
