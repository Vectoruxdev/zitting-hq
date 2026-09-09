"use client";
import * as React from "react";
import { IconButton } from "../core/IconButton";
import { useDialog, useExit } from "./Modal";

export interface DrawerProps {
  open: boolean;
  onClose?: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
  container?: "fixed" | "absolute";
  side?: "left" | "right";
  style?: React.CSSProperties;
}

/** Side panel for detail views on desktop and tablet (a transaction, an appointment, a photo's info). 420px from the right; on phones use BottomSheet. Focus trap, scroll lock, Escape. */
export function Drawer({ open, onClose, title, description, children, footer, width = 420, container = "fixed", side = "right", style }: DrawerProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const mounted = useExit(open);
  useDialog(open, onClose, ref);
  if (!mounted) return null;
  const off = side === "right" ? "translateX(24px)" : "translateX(-24px)";
  return (
    <div style={{ position: container, inset: 0, zIndex: "var(--z-drawer)", display: "flex", justifyContent: side === "right" ? "flex-end" : "flex-start" }}>
      <div onClick={onClose} aria-hidden style={{ position: "absolute", inset: 0, background: "var(--overlay-scrim)", animation: `${open ? "zh-fade-in" : "zh-fade-out"} var(--dur-slow) var(--ease-out) both` }} />
      <div ref={ref} role="dialog" aria-modal="true" tabIndex={-1} style={{ position: "relative", width: "100%", maxWidth: width, height: "100%", display: "flex", flexDirection: "column", background: "var(--surface-raised)", color: "var(--text-primary)", boxShadow: "var(--shadow-3)", outline: "none", borderRadius: side === "right" ? "var(--radius-xl) 0 0 var(--radius-xl)" : "0 var(--radius-xl) var(--radius-xl) 0", opacity: open ? 1 : 0, transform: open ? "none" : off, transition: "opacity var(--dur-slow) var(--ease-out), transform var(--dur-slow) var(--ease-out)", animation: open ? "zh-fade-in var(--dur-slow) var(--ease-out) both" : undefined, ...style }}>
        <header style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "20px 16px 12px 24px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {title ? <h2 style={{ margin: 0, font: "var(--type-h2)" }}>{title}</h2> : null}
            {description ? <p style={{ margin: "4px 0 0", font: "var(--type-body-sm)", color: "var(--text-secondary)" }}>{description}</p> : null}
          </div>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </header>
        <div style={{ padding: "0 24px 24px", overflow: "auto", flex: 1 }}>{children}</div>
        {footer ? <footer style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 24px 20px", borderTop: "1px solid var(--border-hairline)" }}>{footer}</footer> : null}
      </div>
    </div>
  );
}
