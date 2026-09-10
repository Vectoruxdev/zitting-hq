"use client";
import * as React from "react";
import { IconButton } from "../core/IconButton";
import { inOverlayHost, overlayFrame, useOverlayHost, useVisibleViewport } from "./viewport";

/** Focus trap + scroll lock + Escape shared by Modal, BottomSheet, Drawer and Lightbox. */
export function useDialog(open: boolean, onClose: (() => void) | null | undefined, ref: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    if (!open) return;
    const root = ref.current;
    if (!root) return;
    const prev = document.activeElement as HTMLElement | null;
    const target = document.body, prevOverflow = target.style.overflow;
    target.style.overflow = "hidden";
    const focusables = () => Array.from(root.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'));
    const first = focusables()[0];
    (first || root).focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose?.(); }
      if (e.key === "Tab") {
        const f = focusables();
        if (!f.length) { e.preventDefault(); return; }
        const i = f.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    };
    root.addEventListener("keydown", onKey);
    return () => { root.removeEventListener("keydown", onKey); target.style.overflow = prevOverflow; prev?.focus?.({ preventScroll: true }); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only on open/close
  }, [open]);
}

/** Keeps the element mounted through the exit animation. */
export function useExit(open: boolean, dur = 400): boolean {
  const [state, setState] = React.useState({ open, mounted: open });
  // Adjust state when the prop changes (React's "storing information from
  // previous renders" pattern): opening mounts immediately; closing keeps it
  // mounted until the timer below has let the exit animation finish.
  if (state.open !== open) setState({ open, mounted: open ? true : state.mounted });
  React.useEffect(() => {
    if (open) return;
    const t = setTimeout(() => setState((s) => (s.open ? s : { ...s, mounted: false })), dur);
    return () => clearTimeout(t);
  }, [open, dur]);
  return state.mounted;
}

export interface ModalProps {
  open: boolean;
  onClose?: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  container?: "fixed" | "absolute";
  dismissible?: boolean;
  style?: React.CSSProperties;
}

/** Centered dialog (desktop and tablet). On phones prefer BottomSheet. Fixed dialogs render in a body portal (see useOverlayHost); `container="absolute"` scopes it to a positioned parent (device frames). Header and footer stay put, only the body scrolls; while the on-screen keyboard is up the dialog sizes itself to the visible part of the screen. */
export function Modal({ open, onClose, title, description, children, footer, size = "md", container = "fixed", dismissible = true, style }: ModalProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const mounted = useExit(open);
  const host = useOverlayHost(container);
  const titleId = React.useId();
  useDialog(open && host !== null, dismissible ? onClose : null, ref);
  const box = useVisibleViewport(open && container === "fixed", ref);
  if (!mounted) return null;
  const w = size === "sm" ? 400 : size === "lg" ? 720 : 520;
  return inOverlayHost(
    <div style={{ ...overlayFrame(container, box), zIndex: "var(--z-modal)", display: "grid", placeItems: "center", padding: 16 }}>
      <div onClick={dismissible ? onClose : undefined} aria-hidden style={{ position: "absolute", inset: 0, background: "var(--overlay-scrim)", backdropFilter: "blur(4px)", animation: `${open ? "zh-fade-in" : "zh-fade-out"} var(--dur-slow) var(--ease-out) both` }} />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} tabIndex={-1}
        style={{ position: "relative", width: "100%", maxWidth: w, maxHeight: "calc(100% - 32px)", display: "flex", flexDirection: "column", background: "var(--surface-raised)", color: "var(--text-primary)", borderRadius: "var(--radius-sheet)", boxShadow: "var(--shadow-3)", border: "1px solid var(--border-hairline)", outline: "none", overflow: "hidden", animation: `${open ? "zh-modal-in" : "zh-fade-out"} var(--dur-slow) var(--ease-out) both`, ...style }}>
        {(title || dismissible) ? (
          <header style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "20px 20px 0 24px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {title ? <h2 id={titleId} style={{ margin: 0, font: "var(--type-h2)" }}>{title}</h2> : null}
              {description ? <p style={{ margin: "4px 0 0", font: "var(--type-body-sm)", color: "var(--text-secondary)" }}>{description}</p> : null}
            </div>
            {dismissible ? <IconButton icon="x" label="Close" onClick={onClose} /> : null}
          </header>
        ) : null}
        <div style={{ padding: 24, overflow: "auto", overscrollBehavior: "contain", flex: 1, minHeight: 0 }}>{children}</div>
        {footer ? <footer style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "0 24px 20px" }}>{footer}</footer> : null}
      </div>
    </div>,
    host,
  );
}
