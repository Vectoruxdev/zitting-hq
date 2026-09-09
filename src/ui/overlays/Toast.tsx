"use client";
import * as React from "react";
import { Icon } from "../core/Icon";

export type ToastTone = "neutral" | "positive" | "negative" | "warning";
export interface ToastOptions {
  title: string;
  body?: string;
  tone?: ToastTone;
  icon?: string;
  action?: { label: string; onClick?: () => void };
  duration?: number;
}
interface ToastEntry extends ToastOptions { id: number; leaving?: boolean }
interface ToastCtx { toast: (t: ToastOptions) => number; dismiss: (id: number) => void }

const Ctx = React.createContext<ToastCtx | null>(null);

/** Wrap the app once; call `useToast()` anywhere → `toast({ title, body, tone, action, duration })`. Toasts stack bottom-center (above the tab bar on phones), auto-dismiss, and pause on hover. */
export function ToastProvider({ children, position = "bottom", offset = 76, container = "fixed" }: { children?: React.ReactNode; position?: "top" | "bottom"; offset?: number; container?: "fixed" | "absolute" }) {
  const [list, setList] = React.useState<ToastEntry[]>([]);
  const toast = React.useCallback((t: ToastOptions) => { const id = Date.now() + Math.random(); setList((l) => [...l, { id, duration: 4000, tone: "neutral", ...t }]); return id; }, []);
  const dismiss = React.useCallback((id: number) => setList((l) => l.map((t) => (t.id === id ? { ...t, leaving: true } : t))), []);
  const remove = (id: number) => setList((l) => l.filter((t) => t.id !== id));
  const value = React.useMemo(() => ({ toast, dismiss }), [toast, dismiss]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" style={{ position: container, left: 0, right: 0, [position]: offset, zIndex: "var(--z-toast)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, pointerEvents: "none", padding: "0 16px" }}>
        {list.map((t) => <Toast key={t.id} {...t} onDismiss={() => dismiss(t.id)} onGone={() => remove(t.id)} />)}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const c = React.useContext(Ctx);
  return c || { toast: () => 0, dismiss: () => {} };
}

const ICON: Record<ToastTone, string> = { neutral: "info", positive: "circle-check", negative: "circle-alert", warning: "triangle-alert" };

export function Toast({ title, body, tone = "neutral", icon, action, duration = 4000, leaving, onDismiss, onGone, style }: ToastOptions & { leaving?: boolean; onDismiss?: () => void; onGone?: () => void; style?: React.CSSProperties }) {
  const [hover, setHover] = React.useState(false);
  React.useEffect(() => {
    if (leaving) { const t = setTimeout(() => onGone?.(), 260); return () => clearTimeout(t); }
    if (hover || !duration) return;
    const t = setTimeout(() => onDismiss?.(), duration);
    return () => clearTimeout(t);
  }, [hover, leaving, duration, onDismiss, onGone]);
  const color = tone === "neutral" ? "var(--accent)" : `var(--${tone})`;
  return (
    <div role="status" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 12, minWidth: 0, maxWidth: 480, width: "100%", padding: "12px 14px 12px 16px", borderRadius: "var(--radius-lg)", background: "var(--text-primary)", color: "var(--bg-app)", boxShadow: "var(--shadow-3)", animation: `${leaving ? "zh-fade-out" : "zh-pop"} var(--dur-base) var(--ease-out) both`, ...style }}>
      <Icon name={icon || ICON[tone]} size={20} color={color} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <span style={{ font: "var(--type-label)", fontWeight: 600 }}>{title}</span>
        {body ? <span style={{ font: "var(--type-caption)", opacity: 0.75 }}>{body}</span> : null}
      </div>
      {action ? <button type="button" onClick={() => { action.onClick?.(); onDismiss?.(); }} style={{ border: 0, background: "transparent", color, font: "600 var(--fs-sm)/1 var(--font-ui)", cursor: "pointer", padding: "6px 8px", borderRadius: 8 }}>{action.label}</button> : null}
      <button type="button" aria-label="Dismiss" onClick={onDismiss} style={{ border: 0, background: "transparent", color: "inherit", opacity: 0.6, cursor: "pointer", display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: 14, padding: 0 }}><Icon name="x" size={14} /></button>
    </div>
  );
}
