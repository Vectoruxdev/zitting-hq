"use client";
/* eslint-disable @next/next/no-img-element -- media is a signed photo URL cropped by aspect-ratio tokens */
import * as React from "react";
import { Icon } from "../core/Icon";
import { useInteract, focusRing, transition } from "../interact";

export interface CardProps {
  children?: React.ReactNode;
  title?: React.ReactNode;
  eyebrow?: string;
  action?: React.ReactNode;
  icon?: string;
  media?: string | React.ReactNode;
  mediaRatio?: string;
  intensity?: "family" | "finance";
  tone?: "default" | "accent" | "sunken" | "photo";
  onClick?: () => void;
  href?: string;
  padding?: string | number;
  elevated?: boolean;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
  className?: string;
}

/** The surface everything sits on. `intensity="family"` (20px pad, generous) or `"finance"` (16px, tight). `media` puts a photo flush at the top. `onClick` makes the whole card the navigation target (hub cards). */
export function Card({ children, title, eyebrow, action, icon, media, mediaRatio = "var(--ratio-card)", intensity = "family", tone = "default", onClick, href, padding, elevated = false, style, bodyStyle, className }: CardProps) {
  const interactive = !!(onClick || href);
  const it = useInteract(!interactive);
  const pad = padding ?? (intensity === "finance" ? "var(--pad-card-finance)" : "var(--pad-card-family)");
  const bg = tone === "accent" ? "var(--accent-soft)" : tone === "sunken" ? "var(--surface-sunken)" : tone === "photo" ? "var(--text-primary)" : it.hover && interactive ? "var(--surface-hover)" : "var(--surface-card)";
  const El: React.ElementType = href ? "a" : interactive ? "button" : "section";
  return (
    <El
      href={href} onClick={onClick} type={El === "button" ? "button" : undefined} className={className} {...(interactive ? it.bind : {})}
      style={{ display: "flex", flexDirection: "column", textAlign: "left", width: "100%", minWidth: 0, margin: 0, padding: 0, border: "var(--card-border)", borderRadius: "var(--radius-card)", background: bg, color: tone === "photo" ? "#fff" : "var(--text-primary)", boxShadow: elevated || (interactive && it.hover) ? "var(--shadow-2)" : "var(--shadow-1)", overflow: "hidden", cursor: interactive ? "pointer" : "default", transform: it.press ? "scale(var(--press-scale))" : interactive && it.hover ? "translateY(-1px)" : "none", outline: "none", font: "inherit", textDecoration: "none", ...transition("background-color, box-shadow, transform, border-color", "var(--dur-base)"), ...focusRing(it.focus), ...style }}
    >
      {media ? <div className="zh-photo" style={{ aspectRatio: mediaRatio, background: "var(--photo-placeholder)", position: "relative", overflow: "hidden" }}>{typeof media === "string" ? <img src={media} alt="" /> : media}</div> : null}
      <div style={{ padding: pad, display: "flex", flexDirection: "column", gap: intensity === "finance" ? "var(--space-4)" : "var(--space-5)", flex: 1, ...bodyStyle }}>
        {title || eyebrow || action || icon ? (
          <header style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
            {icon ? <span style={{ display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: "var(--radius-md)", background: tone === "photo" ? "rgba(255,255,255,.14)" : "var(--accent-soft)", color: tone === "photo" ? "#fff" : "var(--accent-hover)", flex: "none" }}><Icon name={icon} size={18} /></span> : null}
            <div style={{ flex: "1 1 120px", minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              {eyebrow ? <span style={{ font: "var(--type-overline)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: tone === "photo" ? "rgba(255,255,255,.75)" : "var(--text-tertiary)" }}>{eyebrow}</span> : null}
              {title ? <h3 style={{ margin: 0, font: intensity === "finance" ? "var(--type-h3)" : "var(--type-h2)", color: "inherit", textWrap: "balance" }}>{title}</h3> : null}
            </div>
            {action ? <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 4, minHeight: 36 }}>{action}</div>
              : interactive ? <Icon name="chevron-right" size={18} color={tone === "photo" ? "rgba(255,255,255,.7)" : "var(--text-tertiary)"} style={{ marginTop: 2, transform: it.hover ? "translateX(2px)" : "none", transition: "transform var(--dur-fast) var(--ease-out)" }} /> : null}
          </header>
        ) : null}
        {children}
      </div>
    </El>
  );
}
