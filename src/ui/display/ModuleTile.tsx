"use client";
import * as React from "react";
import { Icon } from "../core/Icon";
import { useInteract, focusRing, transition, type Tint } from "../interact";

export interface ModuleTileProps {
  icon: string;
  label: string;
  tint?: Tint;
  count?: number;
  muted?: boolean;
  onClick?: () => void;
  href?: string;
  style?: React.CSSProperties;
}

/** Module launcher tile: a tinted circle with the module icon and a label — the hub's navigation, compact and friendly. `count` shows a small badge. `muted` for planned modules. */
export function ModuleTile({ icon, label, tint = "coral", count, muted = false, onClick, href, style }: ModuleTileProps) {
  const it = useInteract(muted);
  const El: React.ElementType = href ? "a" : "button";
  return (
    <El
      href={href} type={El === "button" ? "button" : undefined} onClick={muted ? undefined : onClick} aria-disabled={muted || undefined} {...(muted ? {} : it.bind)}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "10px 4px", border: 0, background: it.hover ? "var(--surface-hover)" : "transparent", borderRadius: "var(--radius-md)", color: "var(--text-primary)", textDecoration: "none", cursor: muted ? "default" : "pointer", outline: "none", opacity: muted ? 0.55 : 1, minWidth: 0, transform: it.press ? "scale(0.96)" : "none", font: "inherit", ...transition("background-color, transform, box-shadow"), ...focusRing(it.focus), ...style }}
    >
      <span style={{ position: "relative", width: 56, height: 56, borderRadius: "50%", display: "grid", placeItems: "center", background: `var(--hue-${tint}-soft)`, color: `var(--hue-${tint})`, transform: it.hover ? "translateY(-2px)" : "none", transition: "transform var(--dur-base) var(--ease-out)" }}>
        <Icon name={icon} size={24} />
        {count ? <span className="zh-num" style={{ position: "absolute", top: -2, right: -4, minWidth: 20, height: 20, padding: "0 6px", borderRadius: 10, background: "var(--accent)", color: "var(--text-on-accent)", font: "600 11px/20px var(--font-num)", fontVariantNumeric: "tabular-nums", border: "2px solid var(--bg-app)", boxSizing: "content-box" }}>{count}</span> : null}
      </span>
      <span style={{ font: "500 var(--fs-sm)/1.2 var(--font-ui)", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{label}</span>
    </El>
  );
}
