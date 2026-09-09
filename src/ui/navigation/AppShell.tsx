"use client";
import * as React from "react";
import { Icon } from "../core/Icon";
import { Avatar, type AvatarProps } from "../display/Avatar";
import { ModuleTile } from "../display/ModuleTile";
import { TabBar } from "./TabBar";
import { BottomSheet } from "../overlays/BottomSheet";
import { useInteract, focusRing, transition, type Tint } from "../interact";

export type ShellMode = "phone" | "tablet" | "desktop";

export interface ShellModule {
  key: string;
  label: string;
  short?: string;
  icon: string;
  tint?: Tint;
  group?: string;
  /** In the phone tab bar (first 4). */
  primary?: boolean;
  badge?: number;
  /** Planned module: shown dimmed, not navigable. */
  muted?: boolean;
}

export interface AppShellProps {
  modules: ShellModule[];
  active: string;
  onNavigate?: (key: string) => void;
  user?: Pick<AvatarProps, "src" | "name" | "person">;
  brand?: React.ReactNode;
  mode?: ShellMode;
  onAction?: () => void;
  actionIcon?: string;
  actionLabel?: string;
  /** Desktop/tablet sidebar footer slot (above the user row). */
  footer?: React.ReactNode;
  /** Tapping the user row (desktop) / avatar (phone). */
  onUser?: () => void;
  onSignOut?: () => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

/** Measures its own width so it works in a 392px frame: phone < 768, tablet < 1024, desktop otherwise. */
export function useShellMode(ref: React.RefObject<HTMLElement | null>, force?: ShellMode): ShellMode {
  const [measured, setMeasured] = React.useState<ShellMode>("desktop");
  React.useEffect(() => {
    if (force || !ref.current) return;
    const ro = new ResizeObserver(([e]) => { const w = e.contentRect.width; setMeasured(w < 768 ? "phone" : w < 1024 ? "tablet" : "desktop"); });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [force, ref]);
  return force ?? measured;
}

function NavItem({ m, active, onClick, compact }: { m: ShellModule; active: boolean; onClick: () => void; compact: boolean }) {
  const it = useInteract(false);
  const tint = m.tint || "coral";
  return (
    <button
      type="button" onClick={onClick} aria-current={active ? "page" : undefined} {...it.bind}
      style={{ display: "flex", flexDirection: compact ? "column" : "row", alignItems: "center", gap: compact ? 4 : 12, width: "100%", padding: compact ? "8px 4px" : "6px 10px 6px 6px", border: 0, borderRadius: "var(--radius-md)", background: active ? `var(--hue-${tint}-soft)` : it.hover ? "var(--surface-hover)" : "transparent", color: active ? `var(--hue-${tint})` : "var(--text-secondary)", cursor: "pointer", outline: "none", font: `${active ? 600 : 500} ${compact ? "var(--fs-2xs)" : "var(--fs-sm)"}/1.2 var(--font-ui)`, textAlign: "left", transform: it.press ? "scale(.97)" : "none", ...transition("background-color, color, transform, box-shadow"), ...focusRing(it.focus) }}
    >
      <span style={{ position: "relative", width: 34, height: 34, borderRadius: "50%", flex: "none", display: "grid", placeItems: "center", background: active ? "var(--surface-card)" : `var(--hue-${tint}-soft)`, color: `var(--hue-${tint})`, transition: "background-color var(--dur-base)" }}>
        <Icon name={m.icon} size={18} />
        {m.badge ? <span className="zh-num" style={{ position: "absolute", top: -3, right: -4, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8, background: "var(--accent)", color: "var(--text-on-accent)", font: "600 10px/16px var(--font-num)", border: "2px solid var(--bg-app)", boxSizing: "content-box" }}>{m.badge}</span> : null}
      </span>
      <span style={{ color: active ? "var(--text-primary)" : "inherit", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{compact ? (m.short || m.label) : m.label}</span>
    </button>
  );
}

export function Wordmark({ size = "var(--fs-xl)" }: { size?: string }) {
  return <span style={{ font: `500 ${size}/1 var(--font-display)`, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Zitting <span style={{ color: "var(--accent)" }}>HQ</span></span>;
}

/**
 * Responsive app frame. Phone: content + bottom TabBar (first 4 `primary` modules, camera action, More sheet with every module).
 * Tablet: 84px icon rail. Desktop: 232px sidebar grouped by `group`. Modules are data — adding a feature is one entry.
 * On phone a header (wordmark + avatar) renders above content. Content is keyed on `active` so screens fade on change.
 */
export function AppShell({ modules = [], active, onNavigate, user = {}, brand, mode: force, onAction, actionIcon = "camera", actionLabel = "Add a photo or receipt", footer, onUser, onSignOut, children, style }: AppShellProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const mode = useShellMode(ref, force);
  const [more, setMore] = React.useState(false);
  const go = (k: string) => { setMore(false); onNavigate?.(k); };
  const primary = modules.filter((m) => m.primary).slice(0, 4);
  const groups = modules.reduce<Record<string, ShellModule[]>>((a, m) => { (a[m.group || ""] = a[m.group || ""] || []).push(m); return a; }, {});
  const Brand = brand || <Wordmark />;
  const activeInBar = primary.some((m) => m.key === active) ? active : "more";
  const barItems = [...primary.map((m) => ({ key: m.key, label: m.label, icon: m.icon, badge: m.badge })), { key: "more", label: "More", icon: "layout-grid" }].slice(0, 5);
  return (
    <div ref={ref} style={{ position: "relative", display: "flex", width: "100%", height: "100%", minHeight: 0, background: "var(--bg-app)", color: "var(--text-primary)", font: "var(--type-body)", ...style }}>
      {mode !== "phone" ? (
        <aside style={{ width: mode === "tablet" ? 84 : 232, flex: "none", display: "flex", flexDirection: "column", gap: 4, padding: mode === "tablet" ? "20px 8px" : "20px 12px", borderRight: "1px solid var(--border-hairline)", overflowY: "auto", position: "sticky", top: 0, height: "100%" }}>
          <div style={{ padding: mode === "tablet" ? "0 0 16px" : "0 6px 20px", display: "flex", justifyContent: mode === "tablet" ? "center" : "flex-start" }}>
            {mode === "tablet" ? <span style={{ width: 36, height: 36, borderRadius: 12, background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", font: "500 18px/1 var(--font-display)" }}>Z</span> : Brand}
          </div>
          {Object.entries(groups).map(([g, ms]) => (
            <div key={g} style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 12 }}>
              {g && mode === "desktop" ? <span style={{ font: "var(--type-overline)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: "var(--text-tertiary)", padding: "6px 6px 6px" }}>{g}</span> : null}
              {ms.map((m) => <NavItem key={m.key} m={m} active={m.key === active} onClick={() => go(m.key)} compact={mode === "tablet"} />)}
            </div>
          ))}
          <div style={{ flex: 1 }} />
          {footer}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: mode === "tablet" ? "8px 0" : "8px 6px", justifyContent: mode === "tablet" ? "center" : "flex-start" }}>
            <Avatar {...user} size="sm" onClick={onUser} />
            {mode === "desktop" ? (
              <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={{ font: "var(--type-label)" }}>{user.name}</span>
                {onSignOut ? <button type="button" onClick={onSignOut} style={{ border: 0, background: "transparent", padding: 0, textAlign: "left", cursor: "pointer", font: "var(--type-caption)", color: "var(--text-tertiary)" }}>Sign out</button> : null}
              </span>
            ) : null}
          </div>
        </aside>
      ) : null}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", position: "relative", minHeight: 0 }}>
        {mode === "phone" ? <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", height: 56, flex: "none" }}>{Brand}<Avatar {...user} size="sm" onClick={onUser} /></header> : null}
        <main key={active} style={{ flex: 1, minHeight: 0, animation: "zh-fade-in var(--dur-base) var(--ease-out) both" }}>{children}</main>
        {mode === "phone" ? <TabBar position="sticky" value={activeInBar} onChange={(k) => (k === "more" ? setMore(true) : go(k))} items={barItems} action={onAction ? { icon: actionIcon, label: actionLabel, onClick: onAction } : undefined} /> : null}
        <BottomSheet open={more} onClose={() => setMore(false)} container="absolute" title="Everything">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "8px 0", paddingBottom: 8 }}>
            {modules.map((m, i) => <ModuleTile key={m.key} icon={m.icon} label={m.label} tint={m.tint} count={m.badge} muted={m.muted} onClick={() => go(m.key)} style={{ animation: `zh-fade-up var(--dur-base) var(--ease-out) ${i * 25}ms both` }} />)}
          </div>
        </BottomSheet>
      </div>
    </div>
  );
}
