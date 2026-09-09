"use client";
import * as React from "react";
import { Icon } from "../core/Icon";
import { useInteract, focusRing } from "../interact";

export interface TabBarItem { key: string; label: string; icon: string; badge?: number }
export interface TabBarAction { icon?: string; label: string; onClick?: () => void }
export interface TabBarProps {
  items: TabBarItem[];
  value: string;
  onChange?: (key: string) => void;
  action?: TabBarAction;
  position?: "fixed" | "absolute" | "sticky";
  showLabels?: boolean;
  style?: React.CSSProperties;
}

function Item({ item, active, onSelect, showLabel }: { item: TabBarItem; active: boolean; onSelect: (k: string) => void; showLabel: boolean }) {
  const it = useInteract(false);
  const color = active ? "var(--accent)" : it.hover ? "var(--text-primary)" : "var(--text-tertiary)";
  return (
    <button
      type="button" aria-label={item.label} aria-current={active ? "page" : undefined} onClick={() => onSelect(item.key)} {...it.bind}
      style={{ position: "relative", flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, height: "100%", border: 0, background: "transparent", color, cursor: "pointer", outline: "none", borderRadius: "var(--radius-md)", padding: 0, transition: "color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)", transform: it.press ? "scale(.94)" : "none", ...focusRing(it.focus) }}
    >
      <span style={{ position: "relative", display: "grid", placeItems: "center", width: 28, height: 28 }}>
        <Icon name={item.icon} size={24} style={{ transform: active ? "translateY(-1px)" : "none", transition: "transform var(--dur-base) var(--ease-spring)" }} />
        {item.badge ? <span aria-label={`${item.badge} new`} style={{ position: "absolute", top: -2, right: -6, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8, background: "var(--accent)", color: "var(--text-on-accent)", font: "600 10px/16px var(--font-num)", fontVariantNumeric: "tabular-nums", border: "2px solid var(--surface-card)", boxSizing: "content-box" }}>{item.badge}</span> : null}
      </span>
      {showLabel ? <span style={{ font: `${active ? 600 : 500} var(--fs-2xs)/1 var(--font-ui)`, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{item.label}</span> : null}
    </button>
  );
}

/** Clean bottom tab bar: white, no border, soft upward shadow; the active item is coral. Max 5 items; optional center `action` is a plain coral circle inline with the items. `position="absolute"` inside a phone frame. */
export function TabBar({ items = [], value, onChange, action, position = "fixed", showLabels = true, style }: TabBarProps) {
  const ait = useInteract(false);
  const mid = Math.ceil(items.length / 2);
  return (
    <nav aria-label="Primary" style={{ position, left: 0, right: 0, bottom: 0, zIndex: "var(--z-tabbar)", height: "calc(60px + env(safe-area-inset-bottom))", paddingBottom: "env(safe-area-inset-bottom)", display: "flex", alignItems: "stretch", padding: "6px 8px", background: "var(--surface-card)", boxShadow: "0 -1px 0 var(--border-hairline), 0 -8px 24px rgba(20,20,30,0.05)", ...style }}>
      {items.map((it, i) => (
        <React.Fragment key={it.key}>
          {action && i === mid ? (
            <button type="button" aria-label={action.label} onClick={action.onClick} {...ait.bind} style={{ flex: 1, minWidth: 0, display: "grid", placeItems: "center", border: 0, background: "transparent", cursor: "pointer", outline: "none", borderRadius: "var(--radius-md)", padding: 0, ...focusRing(ait.focus) }}>
              <span style={{ width: 44, height: 44, borderRadius: 22, background: ait.press ? "var(--accent-active)" : ait.hover ? "var(--accent-hover)" : "var(--accent)", color: "var(--text-on-accent)", display: "grid", placeItems: "center", transform: ait.press ? "scale(.94)" : "none", transition: "transform var(--dur-fast) var(--ease-out), background-color var(--dur-fast)" }}><Icon name={action.icon || "plus"} size={22} /></span>
            </button>
          ) : null}
          <Item item={it} active={it.key === value} onSelect={onChange || (() => {})} showLabel={showLabels} />
        </React.Fragment>
      ))}
    </nav>
  );
}
