"use client";
import * as React from "react";
import { Icon } from "../core/Icon";
import { useInteract, focusRing, transition } from "../interact";

export interface SectionProps {
  title?: string;
  eyebrow?: string;
  action?: React.ReactNode;
  onAction?: () => void;
  actionLabel?: string;
  children?: React.ReactNode;
  gap?: string | number;
  style?: React.CSSProperties;
  headingStyle?: React.CSSProperties;
}

/** A page section: small heading row (title + optional action) and content that sits directly on the canvas. The primary layout unit — reach for Card only when a thing is a tappable object. */
export function Section({ title, eyebrow, action, onAction, actionLabel = "See all", children, gap = "var(--space-3)", style, headingStyle }: SectionProps) {
  const it = useInteract(!onAction);
  const showAction = action || onAction;
  return (
    <section style={{ display: "flex", flexDirection: "column", gap, minWidth: 0, ...style }}>
      {title || eyebrow || showAction ? (
        <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, minHeight: 28, ...headingStyle }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            {eyebrow ? <span style={{ font: "var(--type-overline)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: "var(--text-tertiary)" }}>{eyebrow}</span> : null}
            {title ? <h2 style={{ margin: 0, font: "var(--type-h2)", color: "var(--text-primary)" }}>{title}</h2> : null}
          </div>
          {action ? <div style={{ flex: "none" }}>{action}</div> : onAction ? (
            <button type="button" onClick={onAction} {...it.bind} style={{ display: "inline-flex", alignItems: "center", gap: 2, border: 0, background: "transparent", padding: "6px 2px", borderRadius: 6, color: it.hover ? "var(--accent-hover)" : "var(--accent)", font: "600 var(--fs-sm)/1 var(--font-ui)", cursor: "pointer", outline: "none", flex: "none", ...transition("color, box-shadow"), ...focusRing(it.focus) }}>
              {actionLabel}<Icon name="chevron-right" size={14} />
            </button>
          ) : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
