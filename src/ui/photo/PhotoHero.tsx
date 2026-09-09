"use client";
/* eslint-disable @next/next/no-img-element -- hero photo is a signed Supabase URL with cover crop and drift */
import * as React from "react";
import { Icon } from "../core/Icon";
import { Button } from "../core/Button";

export interface PhotoHeroProps {
  src?: string | null;
  /** Responsive candidates for `src` (e.g. Commons thumbs at several widths). */
  srcSet?: string;
  sizes?: string;
  /** Above the fold: fetch at high priority. */
  priority?: boolean;
  alt?: string;
  ratio?: string;
  eyebrow?: string;
  title?: React.ReactNode;
  subtitle?: string;
  actions?: React.ReactNode;
  topRight?: React.ReactNode;
  height?: string | number;
  radius?: string;
  /** Slow 6% zoom over 18s — phones and tablets only (see base.css); off under reduced motion. */
  drift?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
  emptyAction?: React.ReactNode;
  onAddPhoto?: () => void;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/** Full-bleed photo with text over a bottom scrim: photo of the day on the hub, album and goal headers, login. Text is always pure white on the scrim. When there is no photo it becomes a warm, honest invitation, not a broken hero. */
export function PhotoHero({ src, srcSet, sizes, priority = false, alt = "", ratio = "var(--ratio-hero)", eyebrow, title, subtitle, actions, topRight, height, radius = "var(--radius-card)", drift = true, emptyTitle = "Your photo of the day will live here", emptyBody = "Add a few photos and one of them will greet the family every morning.", emptyAction, onAddPhoto, style, children }: PhotoHeroProps) {
  const [err, setErr] = React.useState(false);
  const has = !!src && !err;
  return (
    // isolation + translateZ: the rounded, clipped box composites as its own
    // layer, so an animating child never makes the compositor re-clip and
    // flash black frames (seen on a large Retina window, 2026-09-09).
    <section className="zh-photo" style={{ position: "relative", aspectRatio: height ? undefined : ratio, height, width: "100%", minWidth: 0, borderRadius: radius, overflow: "hidden", isolation: "isolate", transform: "translateZ(0)", background: has ? "var(--text-primary)" : "var(--photo-placeholder)", color: has ? "#fff" : "var(--text-primary)", boxShadow: has ? "var(--shadow-photo)" : "var(--photo-ring)", ...style }}>
      {has ? <img src={src as string} srcSet={srcSet} sizes={srcSet ? sizes : undefined} alt={alt} decoding="async" loading={priority ? "eager" : undefined} fetchPriority={priority ? "high" : undefined} onError={() => setErr(true)} className={drift ? "zh-drift" : undefined} style={{ position: "absolute", inset: 0, transformOrigin: "center", backfaceVisibility: "hidden" }} /> : null}
      {has ? <div aria-hidden style={{ position: "absolute", inset: 0, background: "var(--scrim-bottom)" }} /> : null}
      {has && topRight ? <div aria-hidden style={{ position: "absolute", inset: 0, background: "var(--scrim-top)", pointerEvents: "none" }} /> : null}
      {topRight ? <div style={{ position: "absolute", top: 14, right: 14, display: "flex", gap: 6, zIndex: 1 }}>{topRight}</div> : null}
      {has ? (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "clamp(16px, 5%, 28px)", display: "flex", flexDirection: "column", gap: 6, animation: "zh-fade-up var(--dur-slow) var(--ease-out) 150ms both" }}>
          {eyebrow ? <span style={{ font: "var(--type-overline)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: "rgba(255,255,255,.85)" }}>{eyebrow}</span> : null}
          {title ? <h2 style={{ margin: 0, font: "400 clamp(var(--fs-2xl), 4vw, var(--fs-4xl))/var(--lh-tight) var(--font-display)", letterSpacing: "var(--ls-display)", textWrap: "balance" }}>{title}</h2> : null}
          {subtitle ? <p style={{ margin: 0, font: "var(--type-body-sm)", color: "rgba(255,255,255,.9)", maxWidth: 520 }}>{subtitle}</p> : null}
          {actions ? <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>{actions}</div> : null}
          {children}
        </div>
      ) : (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 8, padding: 24, border: "1.5px dashed var(--border-strong)", borderRadius: radius }}>
          <span style={{ width: 56, height: 56, borderRadius: 28, background: "var(--surface-card)", display: "grid", placeItems: "center", color: "var(--accent)", boxShadow: "var(--shadow-1)" }}><Icon name="camera" size={26} /></span>
          <h2 style={{ margin: "8px 0 0", font: "400 var(--fs-2xl)/var(--lh-snug) var(--font-display)", textWrap: "balance" }}>{emptyTitle}</h2>
          <p style={{ margin: 0, font: "var(--type-body-sm)", color: "var(--text-secondary)", maxWidth: 360, textWrap: "pretty" }}>{emptyBody}</p>
          {emptyAction || (onAddPhoto ? <Button variant="primary" iconLeft="upload" onClick={onAddPhoto} style={{ marginTop: 8 }}>Add a photo</Button> : null)}
        </div>
      )}
    </section>
  );
}
