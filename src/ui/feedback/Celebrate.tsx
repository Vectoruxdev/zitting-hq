"use client";
import * as React from "react";

const HUES = ["--hue-coral", "--hue-sky", "--hue-mint", "--hue-butter", "--hue-lilac", "--hue-rose"];

export interface CelebrateProps { fire: unknown; count?: number; origin?: "center" | "top"; duration?: number; style?: React.CSSProperties }
interface Piece { i: number; dx: number; dy: number; rot: number; hue: string; w: number; h: number; d: number; round: boolean }

/** Confetti burst in the family hues for finishing a goal, clearing the list, or an all-clear. Renders nothing until `fire` changes to a truthy value; cleans itself up. Respects reduced motion (renders nothing). */
export function Celebrate({ fire, count = 48, origin = "center", duration = 1400, style }: CelebrateProps) {
  const [burst, setBurst] = React.useState<{ id: number; pieces: Piece[] } | null>(null);
  React.useEffect(() => {
    if (!fire) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const pieces: Piece[] = Array.from({ length: count }, (_, i) => {
      const a = Math.random() * Math.PI * 2, r = 80 + Math.random() * 160;
      return { i, dx: Math.cos(a) * r, dy: Math.sin(a) * r * 0.8 + 120, rot: (Math.random() - 0.5) * 720, hue: HUES[i % HUES.length], w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, d: Math.random() * 120, round: Math.random() > 0.5 };
    });
    const raf = requestAnimationFrame(() => setBurst({ id: Date.now(), pieces }));
    const t = setTimeout(() => setBurst(null), duration + 200);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires only when `fire` changes, by design
  }, [fire]);
  if (!burst) return null;
  const pos: React.CSSProperties = origin === "top" ? { top: "10%", left: "50%" } : { top: "45%", left: "50%" };
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: "var(--z-toast)", ...style }}>
      {burst.pieces.map((p) => (
        <span key={p.i} style={{ position: "absolute", ...pos, width: p.w, height: p.h, borderRadius: p.round ? "50%" : 2, background: `var(${p.hue})`, ["--dx" as string]: `${p.dx}px`, ["--dy" as string]: `${p.dy}px`, ["--rot" as string]: `${p.rot}deg`, animation: `zh-confetti ${duration}ms cubic-bezier(.2,.7,.3,1) ${p.d}ms both` } as React.CSSProperties} />
      ))}
    </div>
  );
}
