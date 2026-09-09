import * as React from "react";
import { ImageCard } from "./ImageCard";
import { EmptyState } from "../feedback/EmptyState";
import { Skeleton } from "../feedback/Skeleton";

export interface PhotoItem { id: string | number; src?: string | null; alt?: string; badge?: string }
export interface PhotoGridProps {
  items: PhotoItem[];
  columns?: number;
  gap?: number;
  hero?: boolean;
  loading?: boolean;
  onSelect?: (p: PhotoItem) => void;
  selectedIds?: (string | number)[];
  emptyTitle?: string;
  emptyBody?: string;
  emptyAction?: React.ReactNode;
  style?: React.CSSProperties;
}

/** Responsive square grid for the photo stream. `hero` makes the first item span 2×2. Tiles stagger in. Handles loading and empty itself. */
export function PhotoGrid({ items = [], columns = 3, gap = 6, hero = false, loading = false, onSelect, selectedIds = [], emptyTitle = "No photos yet", emptyBody = "Add the first one from your phone and it will show up here for everyone.", emptyAction, style }: PhotoGridProps) {
  const span = (i: number): React.CSSProperties => (hero && i === 0 ? { gridColumn: "span 2", gridRow: "span 2" } : {});
  if (loading) return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap, ...style }}>
      {Array.from({ length: columns * 3 }).map((_, i) => <Skeleton key={i} variant="photo" ratio="1 / 1" delay={i * 40} style={{ borderRadius: "var(--radius-photo-sm)", ...span(i) }} />)}
    </div>
  );
  if (!items.length) return <EmptyState icon="camera" title={emptyTitle} body={emptyBody} action={emptyAction} ratio="1 / 1" style={style} />;
  return (
    <div role="list" style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap, ...style }}>
      {items.map((p, i) => (
        <div role="listitem" key={p.id ?? i} style={{ ...span(i), animation: `zh-fade-up var(--dur-base) var(--ease-out) calc(var(--stagger) * ${Math.min(i, 12)}) both`, minWidth: 0 }}>
          <ImageCard src={p.src} alt={p.alt || ""} ratio="1 / 1" badge={p.badge} selected={selectedIds.includes(p.id)} onClick={onSelect ? () => onSelect(p) : undefined} style={{ borderRadius: "var(--radius-photo-sm)" }} />
        </div>
      ))}
    </div>
  );
}
