"use client";
import * as React from "react";
import { useDialog, useExit } from "./Modal";

export interface BottomSheetProps {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  container?: "fixed" | "absolute";
  height?: string | number;
  dismissible?: boolean;
  style?: React.CSSProperties;
}

/** Phone-first dialog that rises from the bottom. Drag handle, focus trap, scroll lock, Escape. `container="absolute"` inside a 392px frame. */
export function BottomSheet({ open, onClose, title, children, footer, container = "fixed", height = "auto", dismissible = true, style }: BottomSheetProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const mounted = useExit(open);
  useDialog(open, dismissible ? onClose : null, ref);
  const [dragY, setDragY] = React.useState(0);
  const start = React.useRef<number | null>(null);
  if (!mounted) return null;
  const clientY = (e: React.TouchEvent | React.MouseEvent) => ("touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY);
  const onDown = (e: React.TouchEvent | React.MouseEvent) => { start.current = clientY(e); };
  const onMove = (e: React.TouchEvent | React.MouseEvent) => { if (start.current == null) return; setDragY(Math.max(0, clientY(e) - start.current)); };
  const onUp = () => { if (dragY > 90 && dismissible) onClose?.(); setDragY(0); start.current = null; };
  return (
    <div style={{ position: container, inset: 0, zIndex: "var(--z-sheet)", display: "flex", alignItems: "flex-end" }}>
      <div onClick={dismissible ? onClose : undefined} aria-hidden style={{ position: "absolute", inset: 0, background: "var(--overlay-scrim)", animation: `${open ? "zh-fade-in" : "zh-fade-out"} var(--dur-slow) var(--ease-out) both` }} />
      <div ref={ref} role="dialog" aria-modal="true" tabIndex={-1} onTouchMove={onMove} onTouchEnd={onUp} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
        style={{ position: "relative", width: "100%", maxHeight: "92%", height, display: "flex", flexDirection: "column", background: "var(--surface-raised)", color: "var(--text-primary)", borderRadius: "var(--radius-sheet) var(--radius-sheet) 0 0", boxShadow: "var(--shadow-3)", outline: "none", paddingBottom: "env(safe-area-inset-bottom)", transform: dragY ? `translateY(${dragY}px)` : undefined, transition: dragY ? "none" : "transform var(--dur-base) var(--ease-out)", animation: dragY ? "none" : `${open ? "zh-sheet-up" : "zh-fade-out"} var(--dur-slow) var(--ease-out) both`, ...style }}>
        <div onTouchStart={onDown} onMouseDown={onDown} style={{ display: "grid", placeItems: "center", height: 28, cursor: "grab", touchAction: "none" }}><span aria-hidden style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border-strong)" }} /></div>
        {title ? <h2 style={{ margin: 0, padding: "0 20px 12px", font: "var(--type-h2)" }}>{title}</h2> : null}
        <div style={{ padding: "0 20px 20px", overflow: "auto", flex: 1 }}>{children}</div>
        {footer ? <footer style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 20px 20px", borderTop: "1px solid var(--border-hairline)" }}>{footer}</footer> : null}
      </div>
    </div>
  );
}
