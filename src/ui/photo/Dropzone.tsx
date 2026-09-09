"use client";
/* eslint-disable @next/next/no-img-element -- local object URLs of files being uploaded */
import * as React from "react";
import { Icon } from "../core/Icon";
import { Button } from "../core/Button";
import { useInteract, focusRing, transition } from "../interact";

export interface DropFile { name?: string; url?: string; src?: string }
export interface DropzoneProps {
  onFiles?: (files: File[]) => void;
  files?: DropFile[];
  progress?: Record<string, number>;
  multiple?: boolean;
  accept?: string;
  compact?: boolean;
  style?: React.CSSProperties;
}

/** Upload target: on phones a big camera/library button pair; on desktop a dashed drop zone. Shows selected files as thumbnails with per-file progress. Purely presentational — wire `onFiles`. */
export function Dropzone({ onFiles, files = [], progress = {}, multiple = true, accept = "image/*", compact = false, style }: DropzoneProps) {
  const it = useInteract(false);
  const [over, setOver] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);
  const pick = () => input.current?.click();
  const handle = (list: FileList | null) => onFiles?.(Array.from(list || []));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, ...style }}>
      <input ref={input} type="file" accept={accept} multiple={multiple} onChange={(e) => handle(e.target.files)} style={{ display: "none" }} />
      <div
        role="button" tabIndex={0} onClick={pick}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files); }} {...it.bind}
        style={{ display: "flex", flexDirection: compact ? "row" : "column", alignItems: "center", justifyContent: "center", gap: compact ? 14 : 10, padding: compact ? 16 : "32px 24px", borderRadius: "var(--radius-card)", border: `1.5px dashed ${over ? "var(--accent)" : it.hover ? "var(--border-strong)" : "var(--border-hairline)"}`, background: over ? "var(--accent-soft)" : it.hover ? "var(--surface-hover)" : "var(--surface-card)", cursor: "pointer", outline: "none", textAlign: compact ? "left" : "center", ...transition("background-color, border-color, box-shadow"), ...focusRing(it.focus) }}
      >
        <span style={{ width: 56, height: 56, borderRadius: 28, background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center", flex: "none", transform: over ? "scale(1.08)" : "none", transition: "transform var(--dur-base) var(--ease-spring)" }}><Icon name="image" size={26} /></span>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ font: "var(--type-h3)" }}>{over ? "Drop to add" : "Add photos"}</span>
          <span style={{ font: "var(--type-body-sm)", color: "var(--text-secondary)" }}>Drop them here, or choose from your library.</span>
        </div>
        {!compact ? <div style={{ display: "flex", gap: 8, marginTop: 6 }} onClick={(e) => e.stopPropagation()}><Button size="sm" iconLeft="camera" onClick={pick}>Camera</Button><Button size="sm" variant="secondary" iconLeft="image" onClick={pick}>Library</Button></div> : null}
      </div>
      {files.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 8 }}>
          {files.map((f, i) => {
            const p = progress[f.name ?? String(i)];
            const done = p != null && p >= 1;
            const src = f.url || f.src;
            return (
              <div key={f.name ?? i} style={{ position: "relative", aspectRatio: "1 / 1", borderRadius: "var(--radius-photo-sm)", overflow: "hidden", background: "var(--photo-placeholder)", animation: `zh-pop var(--dur-base) var(--ease-out) ${i * 40}ms both` }}>
                {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: done || p == null ? 1 : 0.6 }} /> : null}
                {p != null && !done ? <div style={{ position: "absolute", left: 6, right: 6, bottom: 6, height: 4, borderRadius: 2, background: "rgba(255,255,255,.4)" }}><div style={{ width: `${Math.round(p * 100)}%`, height: "100%", borderRadius: 2, background: "#fff", transition: "width var(--dur-base)" }} /></div> : null}
                {done ? <span style={{ position: "absolute", right: 4, top: 4, width: 20, height: 20, borderRadius: 10, background: "var(--positive)", color: "#fff", display: "grid", placeItems: "center" }}><Icon name="check" size={12} /></span> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
