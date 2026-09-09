"use client";
/* eslint-disable @next/next/no-img-element -- avatar sources are signed Supabase URLs sized by the token scale; next/image adds nothing here */
import * as React from "react";
import { personTint, initials } from "../interact";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
const SIZES: Record<AvatarSize, number> = { xs: 24, sm: 32, md: 40, lg: 56, xl: 80, "2xl": 120 };

export interface AvatarProps {
  src?: string | null;
  name?: string;
  person?: number;
  size?: AvatarSize | number;
  ring?: boolean;
  status?: "online" | "away";
  onClick?: () => void;
  style?: React.CSSProperties;
}

/** Photo first; initials on the person's tint when there is no photo. `person` 1–6 keeps a member's color stable app-wide. */
export function Avatar({ src, name = "", person = 1, size = "md", ring = false, status, style, onClick }: AvatarProps) {
  const d = typeof size === "number" ? size : SIZES[size] || 40;
  const [broken, setBroken] = React.useState(false);
  const showImg = !!src && !broken;
  const El: React.ElementType = onClick ? "button" : "span";
  return (
    <El
      type={onClick ? "button" : undefined} onClick={onClick} aria-label={onClick ? name : undefined} title={name}
      style={{ position: "relative", display: "inline-grid", placeItems: "center", width: d, height: d, flex: "none", borderRadius: "50%", overflow: "visible", background: showImg ? "var(--surface-sunken)" : personTint(person), color: "#fff", font: `600 ${Math.round(d * 0.38)}px/1 var(--font-ui)`, letterSpacing: "0.02em", boxShadow: ring ? "0 0 0 2px var(--surface-card), 0 0 0 4px var(--accent)" : "var(--photo-ring)", border: 0, padding: 0, cursor: onClick ? "pointer" : "default", userSelect: "none", ...style }}
    >
      {showImg ? <img src={src as string} alt={name} onError={() => setBroken(true)} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", display: "block" }} /> : <span aria-hidden>{initials(name) || "?"}</span>}
      {status ? <span aria-label={status} style={{ position: "absolute", right: -1, bottom: -1, width: Math.max(8, d * 0.28), height: Math.max(8, d * 0.28), borderRadius: "50%", background: status === "away" ? "var(--warning)" : "var(--positive)", border: "2px solid var(--surface-card)" }} /> : null}
    </El>
  );
}

export interface AvatarStackProps { people: AvatarProps[]; size?: "xs" | "sm" | "md"; max?: number; style?: React.CSSProperties }

/** Overlapping stack (−8px) with a card-colored ring; shows `+N` after `max`. */
export function AvatarStack({ people = [], size = "sm", max = 4, style }: AvatarStackProps) {
  const shown = people.slice(0, max), rest = people.length - shown.length;
  const d = SIZES[size] || 32;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", ...style }}>
      {shown.map((p, i) => <Avatar key={i} {...p} size={size} style={{ marginLeft: i ? "var(--avatar-stack-overlap)" : 0, boxShadow: "0 0 0 2px var(--surface-card)" }} />)}
      {rest > 0 ? <span style={{ marginLeft: "var(--avatar-stack-overlap)", width: d, height: d, borderRadius: "50%", background: "var(--surface-sunken)", color: "var(--text-secondary)", display: "grid", placeItems: "center", font: `600 ${Math.round(d * 0.36)}px/1 var(--font-num)`, boxShadow: "0 0 0 2px var(--surface-card)" }}>+{rest}</span> : null}
    </span>
  );
}
