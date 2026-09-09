"use client";
/* eslint-disable @next/next/no-img-element -- photo sources are signed Supabase URLs cropped by aspect-ratio tokens */
import * as React from "react";
import { Icon } from "../core/Icon";
import { Avatar } from "../display/Avatar";
import { useInteract, focusRing, transition } from "../interact";

export interface ImageCardProps {
  src?: string | null;
  alt?: string;
  ratio?: string;
  title?: string;
  caption?: string;
  overlayTitle?: boolean;
  person?: number;
  personName?: string;
  badge?: string;
  onClick?: () => void;
  selected?: boolean;
  favorite?: boolean;
  onFavorite?: (v: boolean) => void;
  style?: React.CSSProperties;
}

/** A photo with a caption row. Ratio from the media tokens, radius-lg, cover crop, optional bottom-scrim title for text ON the photo. Broken/missing src shows the dashed photo placeholder. */
export function ImageCard({ src, alt = "", ratio = "var(--ratio-card)", title, caption, overlayTitle = false, person, personName, badge, onClick, selected = false, favorite, onFavorite, style }: ImageCardProps) {
  const it = useInteract(!onClick);
  const [err, setErr] = React.useState(false);
  const El: React.ElementType = onClick ? "button" : "figure";
  const has = !!src && !err;
  return (
    <El
      type={onClick ? "button" : undefined} onClick={onClick} aria-pressed={onClick && selected ? true : undefined} {...(onClick ? it.bind : {})}
      style={{ display: "flex", flexDirection: "column", gap: 8, margin: 0, padding: 0, border: 0, background: "transparent", textAlign: "left", color: "var(--text-primary)", cursor: onClick ? "pointer" : "default", outline: "none", borderRadius: "var(--radius-photo)", width: "100%", minWidth: 0, font: "inherit", ...style }}
    >
      <div className="zh-photo" style={{ position: "relative", aspectRatio: ratio, borderRadius: "var(--radius-photo)", overflow: "hidden", background: "var(--photo-placeholder)", boxShadow: selected ? "0 0 0 3px var(--accent)" : it.hover ? "var(--shadow-photo)" : "var(--photo-ring)", transform: it.press ? "scale(var(--press-scale))" : it.hover ? "scale(1.01)" : "none", ...transition("box-shadow, transform", "var(--dur-base)"), ...focusRing(it.focus) }}>
        {has ? <img src={src as string} alt={alt} loading="lazy" onError={() => setErr(true)} style={{ transform: it.hover ? "scale(1.03)" : "none", transition: "transform var(--dur-slow) var(--ease-out)" }} />
          : <div aria-hidden style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--text-tertiary)", border: "1.5px dashed var(--border-strong)", borderRadius: "inherit" }}><Icon name="image" size={28} /></div>}
        {has ? <div aria-hidden style={{ position: "absolute", inset: 0, background: "var(--photo-tint)", mixBlendMode: "multiply", pointerEvents: "none" }} /> : null}
        {overlayTitle && (title || caption) ? (
          <div style={{ position: "absolute", inset: 0, background: "var(--scrim-bottom)", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 14, color: "#fff" }}>
            {title ? <span style={{ font: "var(--type-h3)" }}>{title}</span> : null}
            {caption ? <span style={{ font: "var(--type-caption)", opacity: 0.9 }}>{caption}</span> : null}
          </div>
        ) : null}
        {badge ? <span style={{ position: "absolute", top: 10, left: 10, padding: "3px 8px", borderRadius: "var(--radius-pill)", background: "rgba(20,14,6,.55)", backdropFilter: "blur(8px)", color: "#fff", font: "600 var(--fs-2xs)/1.2 var(--font-ui)" }}>{badge}</span> : null}
        {onFavorite ? (
          <span
            role="button" tabIndex={0} aria-label={favorite ? "Unfavorite" : "Favorite"} aria-pressed={favorite}
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); onFavorite(!favorite); }}
            onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onFavorite(!favorite); } }}
            style={{ position: "absolute", top: 8, right: 8, width: 32, height: 32, borderRadius: 16, display: "grid", placeItems: "center", background: "rgba(20,14,6,.45)", backdropFilter: "blur(8px)", color: favorite ? "var(--negative)" : "#fff", cursor: "pointer", opacity: favorite || it.hover ? 1 : 0, transition: "opacity var(--dur-fast)" }}
          >
            <Icon name="heart" size={16} />
          </span>
        ) : null}
        {selected ? <span aria-hidden style={{ position: "absolute", bottom: 8, right: 8, width: 24, height: 24, borderRadius: 12, background: "var(--accent)", color: "var(--text-on-accent)", display: "grid", placeItems: "center" }}><Icon name="check" size={14} /></span> : null}
      </div>
      {!overlayTitle && (title || caption || personName) ? (
        <figcaption style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {personName ? <Avatar name={personName} person={person} size="xs" /> : null}
          <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            {title ? <span style={{ font: "var(--type-label)", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span> : null}
            {caption ? <span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{caption}</span> : null}
          </span>
        </figcaption>
      ) : null}
    </El>
  );
}
