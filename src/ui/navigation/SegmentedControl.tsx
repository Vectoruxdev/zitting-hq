"use client";
import * as React from "react";
import { Icon } from "../core/Icon";
import { useInteract, focusRing } from "../interact";

export interface SegmentItem { key: string; label: string; icon?: string; disabled?: boolean }
export interface SegmentedControlProps {
  items: SegmentItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (key: string) => void;
  size?: "sm" | "md";
  style?: React.CSSProperties;
}

function Seg({ item, active, onSelect, size }: { item: SegmentItem; active: boolean; onSelect: (k: string) => void; size: "sm" | "md" }) {
  const it = useInteract(item.disabled);
  return (
    <button
      type="button" role="radio" aria-checked={active} disabled={item.disabled} onClick={() => onSelect(item.key)} {...it.bind} data-key={item.key}
      style={{ position: "relative", zIndex: 1, flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, height: size === "sm" ? 28 : 36, padding: "0 12px", border: 0, background: "transparent", color: active ? "var(--text-primary)" : it.hover ? "var(--text-primary)" : "var(--text-secondary)", font: `${active ? 600 : 500} ${size === "sm" ? "var(--fs-xs)" : "var(--fs-sm)"}/1 var(--font-ui)`, cursor: item.disabled ? "not-allowed" : "pointer", opacity: item.disabled ? 0.45 : 1, outline: "none", borderRadius: "var(--radius-pill)", whiteSpace: "nowrap", transition: "color var(--dur-fast) var(--ease-out)", ...focusRing(it.focus) }}
    >
      {item.icon ? <Icon name={item.icon} size={14} /> : null}{item.label}
    </button>
  );
}

/** Pill segmented control with a sliding thumb. Only for 2–4 exclusive views that all DO something. */
export function SegmentedControl({ items = [], value, defaultValue, onChange, size = "md", style }: SegmentedControlProps) {
  const [inner, setInner] = React.useState(defaultValue ?? items[0]?.key);
  const active = value ?? inner;
  const ref = React.useRef<HTMLDivElement>(null);
  const [th, setTh] = React.useState({ left: 0, width: 0 });
  React.useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-key="${active}"]`);
    if (el) setTh({ left: el.offsetLeft, width: el.offsetWidth });
  }, [active, items.length]);
  const select = (k: string) => { setInner(k); onChange?.(k); };
  return (
    <div ref={ref} role="radiogroup" style={{ position: "relative", display: "inline-flex", padding: 3, gap: 2, borderRadius: "var(--radius-pill)", background: "var(--surface-sunken)", ...style }}>
      <span aria-hidden style={{ position: "absolute", top: 3, bottom: 3, left: th.left, width: th.width, borderRadius: "var(--radius-pill)", background: "var(--surface-raised)", boxShadow: "var(--shadow-1)", transition: "left var(--dur-base) var(--ease-out), width var(--dur-base) var(--ease-out)" }} />
      {items.map((it) => <Seg key={it.key} item={it} active={it.key === active} onSelect={select} size={size} />)}
    </div>
  );
}
