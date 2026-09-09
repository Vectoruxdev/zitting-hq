"use client";
import * as React from "react";
import { Icon } from "../core/Icon";
import { useInteract, focusRing, transition } from "../interact";

export interface TabItem { key: string; label: string; icon?: string; count?: number; disabled?: boolean }
export interface TabsProps {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (key: string) => void;
  size?: "sm" | "md";
  stretch?: boolean;
  style?: React.CSSProperties;
}

function Tab({ item, active, onSelect, size }: { item: TabItem; active: boolean; onSelect: (k: string) => void; size: "sm" | "md" }) {
  const it = useInteract(item.disabled);
  return (
    <button
      type="button" role="tab" aria-selected={active} disabled={item.disabled} onClick={() => onSelect(item.key)} {...it.bind} data-key={item.key}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, height: size === "sm" ? 36 : 44, padding: "0 4px", border: 0, background: "transparent", color: active ? "var(--text-primary)" : it.hover ? "var(--text-primary)" : "var(--text-secondary)", font: `${active ? 600 : 500} ${size === "sm" ? "var(--fs-sm)" : "var(--fs-md)"}/1 var(--font-ui)`, cursor: item.disabled ? "not-allowed" : "pointer", opacity: item.disabled ? 0.45 : 1, outline: "none", borderRadius: "var(--radius-sm)", whiteSpace: "nowrap", ...transition("color, box-shadow"), ...focusRing(it.focus) }}
    >
      {item.icon ? <Icon name={item.icon} size={16} /> : null}{item.label}
      {item.count != null ? <span style={{ font: "600 var(--fs-2xs)/16px var(--font-num)", fontVariantNumeric: "tabular-nums", minWidth: 16, padding: "0 5px", borderRadius: 8, background: active ? "var(--accent-soft)" : "var(--surface-sunken)", color: active ? "var(--accent-hover)" : "var(--text-secondary)" }}>{item.count}</span> : null}
    </button>
  );
}

/** Underline tabs with a sliding indicator. Content switches should cross-fade. */
export function Tabs({ items = [], value, defaultValue, onChange, size = "md", stretch = false, style }: TabsProps) {
  const [inner, setInner] = React.useState(defaultValue ?? items[0]?.key);
  const active = value ?? inner;
  const ref = React.useRef<HTMLDivElement>(null);
  const [ind, setInd] = React.useState({ left: 0, width: 0 });
  React.useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-key="${active}"]`);
    if (el) setInd({ left: el.offsetLeft, width: el.offsetWidth });
  }, [active, items.length]);
  const select = (k: string) => { setInner(k); onChange?.(k); };
  return (
    <div ref={ref} role="tablist" style={{ position: "relative", display: "flex", gap: stretch ? 0 : 20, borderBottom: "1px solid var(--border-hairline)", ...style }}>
      {items.map((it) => <div key={it.key} style={{ flex: stretch ? 1 : "none", display: "flex", justifyContent: stretch ? "center" : "flex-start" }}><Tab item={it} active={it.key === active} onSelect={select} size={size} /></div>)}
      <span aria-hidden style={{ position: "absolute", bottom: -1, height: 2, left: ind.left, width: ind.width, background: "var(--accent)", borderRadius: 1, transition: "left var(--dur-base) var(--ease-out), width var(--dur-base) var(--ease-out)" }} />
    </div>
  );
}
