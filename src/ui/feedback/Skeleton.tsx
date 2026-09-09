import * as React from "react";

const shimmer = (delay = 0): React.CSSProperties => ({ background: "linear-gradient(90deg, var(--skeleton-base) 25%, var(--skeleton-shine) 50%, var(--skeleton-base) 75%)", backgroundSize: "200% 100%", animation: `zh-shimmer 1.4s linear ${delay}ms infinite` });

export interface SkeletonProps {
  variant?: "text" | "title" | "circle" | "rect" | "photo";
  width?: string | number;
  height?: string | number;
  lines?: number;
  ratio?: string;
  delay?: number;
  style?: React.CSSProperties;
}

/** Readiness-based loading: render the real layout with Skeletons in place of content, never a timed splash. */
export function Skeleton({ variant = "text", width, height, lines = 1, ratio, delay = 0, style }: SkeletonProps) {
  if (variant === "text" || variant === "title") return (
    <div aria-busy="true" aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 8, width: width || "100%", ...style }}>
      {Array.from({ length: lines }).map((_, i) => <span key={i} style={{ display: "block", height: variant === "title" ? 20 : 12, borderRadius: 6, width: i === lines - 1 && lines > 1 ? "60%" : "100%", ...shimmer(delay + i * 60) }} />)}
    </div>
  );
  if (variant === "circle") { const d = width || 40; return <span aria-busy="true" style={{ display: "inline-block", width: d, height: d, borderRadius: "50%", flex: "none", ...shimmer(delay), ...style }} />; }
  return <span aria-busy="true" style={{ display: "block", width: width || "100%", height: variant === "photo" ? undefined : height || 80, aspectRatio: variant === "photo" ? ratio || "var(--ratio-card)" : undefined, borderRadius: variant === "photo" ? "var(--radius-photo)" : "var(--radius-md)", ...shimmer(delay), ...style }} />;
}

export interface SkeletonCardProps { photo?: boolean; avatar?: boolean; intensity?: "family" | "finance"; style?: React.CSSProperties }

/** Card-shaped skeleton preset: optional photo, avatar row, title and two lines. */
export function SkeletonCard({ photo = false, avatar = true, intensity = "family", style }: SkeletonCardProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "var(--radius-card)", border: "1px solid var(--border-hairline)", background: "var(--surface-card)", boxShadow: "var(--shadow-1)", ...style }}>
      {photo ? <Skeleton variant="photo" style={{ borderRadius: 0 }} /> : null}
      <div style={{ padding: intensity === "finance" ? "var(--pad-card-finance)" : "var(--pad-card-family)", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>{avatar ? <Skeleton variant="circle" width={32} /> : null}<Skeleton variant="title" width="55%" delay={80} /></div>
        <Skeleton lines={2} delay={160} />
      </div>
    </div>
  );
}
