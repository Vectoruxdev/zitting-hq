"use client";
import * as React from "react";
import { Icon } from "../core/Icon";
import { Money } from "./Money";
import { useInteract, focusRing, transition } from "../interact";

export interface StatTileProps {
  label: string;
  value: number | string;
  delta?: number;
  deltaLabel?: string;
  chart?: React.ReactNode;
  icon?: string;
  loading?: boolean;
  onClick?: () => void;
  size?: "md" | "lg";
  style?: React.CSSProperties;
}

/** Finance stat tile: label, money value, delta and an optional sparkline slot. Loading renders a skeleton in place. */
export function StatTile({ label, value, delta, deltaLabel = "vs last month", chart, icon, loading = false, onClick, size = "md", style }: StatTileProps) {
  const it = useInteract(!onClick);
  const El: React.ElementType = onClick ? "button" : "div";
  const up = typeof delta === "number" && delta > 0, down = typeof delta === "number" && delta < 0;
  const big = size === "lg";
  return (
    <El
      type={onClick ? "button" : undefined} onClick={onClick} {...(onClick ? it.bind : {})}
      style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "left", minWidth: 0, padding: "var(--pad-card-finance)", border: "var(--card-border)", borderRadius: "var(--radius-card)", background: it.hover ? "var(--surface-hover)" : "var(--surface-card)", color: "var(--text-primary)", boxShadow: "var(--shadow-1)", cursor: onClick ? "pointer" : "default", outline: "none", font: "inherit", ...transition(), ...focusRing(it.focus), ...style }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", font: "var(--type-label)" }}>
        {icon ? <Icon name={icon} size={16} color="var(--text-tertiary)" /> : null}<span style={{ flex: 1 }}>{label}</span>
      </div>
      {loading ? (
        <span aria-busy style={{ display: "block", height: big ? 34 : 26, width: "60%", borderRadius: 6, background: "linear-gradient(90deg, var(--skeleton-base) 25%, var(--skeleton-shine) 50%, var(--skeleton-base) 75%)", backgroundSize: "200% 100%", animation: "zh-shimmer 1.4s linear infinite" }} />
      ) : (
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            {typeof value === "number"
              ? <Money value={value} size="lg" style={{ fontSize: big ? "var(--fs-4xl)" : "var(--fs-2xl)" }} />
              : <span className="zh-num" style={{ font: "var(--type-money-lg)", fontSize: big ? "var(--fs-4xl)" : "var(--fs-2xl)" }}>{value}</span>}
            {typeof delta === "number" ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, font: "var(--type-caption)", color: up ? "var(--positive)" : down ? "var(--negative)" : "var(--text-tertiary)" }}>
                <Icon name={up ? "arrow-up-right" : down ? "arrow-down-right" : "minus"} size={12} />
                <span className="zh-num" style={{ fontWeight: 600 }}>{Math.abs(delta)}%</span>
                <span style={{ color: "var(--text-tertiary)" }}>{deltaLabel}</span>
              </span>
            ) : null}
          </div>
          {chart ? <div style={{ flex: "none", width: 88, height: 32 }}>{chart}</div> : null}
        </div>
      )}
    </El>
  );
}
