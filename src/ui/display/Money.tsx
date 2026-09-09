"use client";
import * as React from "react";
import { money } from "../interact";
import { useCountUp } from "./CountUp";

export interface MoneyProps {
  value: number;
  size?: "sm" | "md" | "lg" | "xl";
  cents?: boolean;
  sign?: boolean;
  tone?: "auto" | "muted" | "positive" | "negative" | "inherit";
  weight?: number;
  /** Count up from 0 on mount (900ms ease-out; instant under reduced motion). */
  animate?: boolean;
  duration?: number;
  style?: React.CSSProperties;
}

/** Formatted money. Always tabular, lining, cents de-emphasized. Sign carries the color, never the label. */
export function Money({ value = 0, size = "md", cents = true, sign = false, tone = "auto", weight, animate = false, duration = 900, style }: MoneyProps) {
  const shown = useCountUp(value, { duration: animate ? duration : 0 });
  const s = money(animate ? shown : value, { cents, sign });
  const [whole, frac] = s.split(".");
  const font = size === "lg" ? "var(--type-money-lg)" : size === "sm" ? "var(--type-money-sm)" : size === "xl" ? "600 var(--fs-5xl)/1 var(--font-num)" : "var(--type-money)";
  const color = tone === "auto" ? (value < 0 ? "var(--negative)" : sign && value > 0 ? "var(--positive)" : "inherit") : tone === "muted" ? "var(--text-secondary)" : tone === "positive" ? "var(--positive)" : tone === "negative" ? "var(--negative)" : "inherit";
  const big = size === "lg" || size === "xl";
  return (
    <span className="zh-money" style={{ font, fontWeight: weight, fontVariantNumeric: "tabular-nums lining-nums", color, whiteSpace: "nowrap", ...style }}>
      {whole}{frac != null ? <span style={{ fontSize: big ? "0.55em" : "0.85em", opacity: big ? 0.7 : 1 }}>.{frac}</span> : null}
    </span>
  );
}
