"use client";
/* eslint-disable @next/next/no-img-element -- album covers are signed Supabase URLs */
import * as React from "react";
import { Icon } from "../core/Icon";
import { useInteract, focusRing, transition } from "../interact";

export interface AlbumTileProps {
  cover?: string | null;
  title: string;
  count?: number;
  subtitle?: string;
  onClick?: () => void;
  size?: string | number;
  style?: React.CSSProperties;
}

/** Album / moment tile: square cover with a stacked-paper hint, title and count. Empty album shows a dashed frame with "Add the first photo". */
export function AlbumTile({ cover, title, count = 0, subtitle, onClick, size, style }: AlbumTileProps) {
  const it = useInteract(!onClick);
  const [err, setErr] = React.useState(false);
  const has = !!cover && !err;
  return (
    <button type="button" onClick={onClick} {...it.bind} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 0, border: 0, background: "transparent", textAlign: "left", cursor: onClick ? "pointer" : "default", outline: "none", borderRadius: "var(--radius-photo)", width: size || "100%", minWidth: 0, color: "var(--text-primary)", font: "inherit", ...style }}>
      <div style={{ position: "relative", paddingTop: 6 }}>
        <div aria-hidden style={{ position: "absolute", top: 0, left: 10, right: 10, height: 20, borderRadius: "var(--radius-photo-sm) var(--radius-photo-sm) 0 0", background: "var(--surface-sunken)", boxShadow: "var(--photo-ring)", transform: it.hover ? "translateY(-3px)" : "none", transition: "transform var(--dur-base) var(--ease-out)" }} />
        <div className="zh-photo" style={{ position: "relative", aspectRatio: "1 / 1", borderRadius: "var(--radius-photo)", overflow: "hidden", background: "var(--photo-placeholder)", boxShadow: it.hover ? "var(--shadow-photo)" : "var(--shadow-1), var(--photo-ring)", transform: it.press ? "scale(var(--press-scale))" : "none", ...transition("box-shadow, transform", "var(--dur-base)"), ...focusRing(it.focus) }}>
          {has ? <img src={cover as string} alt="" loading="lazy" onError={() => setErr(true)} />
            : <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, color: "var(--text-tertiary)", border: "1.5px dashed var(--border-strong)", borderRadius: "inherit", font: "var(--type-caption)" }}><Icon name="plus" size={22} /><span>Add the first photo</span></div>}
          {has ? <span style={{ position: "absolute", right: 10, bottom: 10, padding: "3px 8px", borderRadius: "var(--radius-pill)", background: "rgba(20,14,6,.55)", backdropFilter: "blur(8px)", color: "#fff", font: "600 var(--fs-2xs)/1.2 var(--font-num)", fontVariantNumeric: "tabular-nums" }}>{count}</span> : null}
        </div>
      </div>
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ font: "var(--type-label)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
        <span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}>{subtitle || (count ? `${count} photo${count === 1 ? "" : "s"}` : "Empty")}</span>
      </span>
    </button>
  );
}
