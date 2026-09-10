"use client";
/* eslint-disable @next/next/no-img-element -- full-bleed photo view of a signed Supabase URL */
import * as React from "react";
import { IconButton } from "../core/IconButton";
import { Avatar, type AvatarProps } from "../display/Avatar";
import { useDialog, useExit } from "../overlays/Modal";
import { inOverlayHost, useOverlayHost } from "../overlays/viewport";

export interface LightboxItem {
  id?: string | number;
  src: string;
  alt?: string;
  title?: string;
  when?: string;
  album?: string;
  person?: Pick<AvatarProps, "name" | "src" | "person">;
}
export interface LightboxProps {
  open: boolean;
  onClose?: () => void;
  items: LightboxItem[];
  index?: number;
  onIndexChange?: (i: number) => void;
  container?: "fixed" | "absolute";
  onFavorite?: (p: LightboxItem) => void;
  onShare?: (p: LightboxItem) => void;
  style?: React.CSSProperties;
}

/** Single photo view: full-bleed on ink, frosted chrome on top scrim, caption + person on bottom scrim, swipe/arrow between `items`. Focus trap and Escape. */
export function Lightbox({ open, onClose, items = [], index = 0, onIndexChange, container = "fixed", onFavorite, onShare, style }: LightboxProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const mounted = useExit(open);
  const host = useOverlayHost(container);
  useDialog(open && host !== null, onClose, ref);
  const [i, setI] = React.useState(index);
  const [seen, setSeen] = React.useState({ index, open });
  if (seen.index !== index || seen.open !== open) { setSeen({ index, open }); setI(index); }
  const go = React.useCallback((n: number) => { if (!items.length) return; const k = (n + items.length) % items.length; setI(k); onIndexChange?.(k); }, [items.length, onIndexChange]);
  const startX = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "ArrowRight") go(i + 1); if (e.key === "ArrowLeft") go(i - 1); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, i, go]);
  if (!mounted || !items.length) return null;
  const p = items[i] || items[0];
  return inOverlayHost(
    <div
      ref={ref} role="dialog" aria-modal="true" aria-label={p.alt || "Photo"} tabIndex={-1}
      onTouchStart={(e) => (startX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => { if (startX.current == null) return; const dx = e.changedTouches[0].clientX - startX.current; if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1)); startX.current = null; }}
      style={{ position: container, inset: 0, zIndex: "var(--z-modal)", background: "#0B0A0E", color: "#fff", display: "flex", flexDirection: "column", outline: "none", animation: `${open ? "zh-fade-in" : "zh-fade-out"} var(--dur-slow) var(--ease-out) both`, ...style }}
    >
      <img key={p.id ?? i} src={p.src} alt={p.alt || ""} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", animation: "zh-fade-in var(--dur-base) var(--ease-out) both" }} />
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "var(--scrim-top)", pointerEvents: "none" }} />
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "var(--scrim-bottom)", pointerEvents: "none" }} />
      <header style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: 12 }}>
        <IconButton icon="chevron-left" label="Back" variant="onPhoto" onClick={onClose} />
        <span className="zh-num" style={{ font: "var(--type-caption)", opacity: 0.85 }}>{i + 1} / {items.length}</span>
        <div style={{ display: "flex", gap: 6 }}>
          {onFavorite ? <IconButton icon="heart" label="Favorite" variant="onPhoto" onClick={() => onFavorite(p)} /> : null}
          {onShare ? <IconButton icon="share" label="Share" variant="onPhoto" onClick={() => onShare(p)} /> : null}
          <IconButton icon="ellipsis" label="More" variant="onPhoto" />
        </div>
      </header>
      <div style={{ flex: 1 }} onClick={onClose} />
      {items.length > 1 ? (
        <>
          <IconButton icon="chevron-left" label="Previous" variant="onPhoto" onClick={() => go(i - 1)} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <IconButton icon="chevron-right" label="Next" variant="onPhoto" onClick={() => go(i + 1)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }} />
        </>
      ) : null}
      <footer style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "16px 20px calc(20px + env(safe-area-inset-bottom))" }}>
        {p.person ? <Avatar {...p.person} size="sm" /> : null}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
          {p.title ? <span style={{ font: "var(--type-h3)" }}>{p.title}</span> : null}
          <span style={{ font: "var(--type-caption)", opacity: 0.85 }}>{[p.person && p.person.name && `Added by ${p.person.name}`, p.when, p.album].filter(Boolean).join(" · ")}</span>
        </div>
      </footer>
    </div>,
    host,
  );
}
