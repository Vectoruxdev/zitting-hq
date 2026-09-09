"use client";
import * as React from "react";

const reduced = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Animates a number from 0 (or the previous value) to `value` over `duration` ms with an ease-out curve. Instant under reduced motion. */
export function useCountUp(value: number, { duration = 900, from }: { duration?: number; from?: number } = {}): number {
  const [v, setV] = React.useState(from ?? 0);
  const prev = React.useRef(from ?? 0);
  React.useEffect(() => {
    const instant = reduced() || duration <= 0;
    const start = performance.now(), a = prev.current, d = value - a;
    let raf = 0;
    const tick = (t: number) => {
      const p = instant ? 1 : Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setV(a + d * e);
      if (p < 1) raf = requestAnimationFrame(tick); else prev.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return v;
}

export interface CountUpProps { value: number; duration?: number; format?: (n: number) => string; style?: React.CSSProperties }

/** Count-up number with optional formatter. */
export function CountUp({ value = 0, duration = 900, format = (n) => Math.round(n).toLocaleString("en-US"), style }: CountUpProps) {
  const v = useCountUp(value, { duration });
  return <span className="zh-num" style={{ fontVariantNumeric: "tabular-nums", ...style }}>{format(v)}</span>;
}
