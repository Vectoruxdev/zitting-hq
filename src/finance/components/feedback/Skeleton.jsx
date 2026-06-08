import React from 'react';

/**
 * Skeleton — a shimmering placeholder block for loading states. Size it with
 * `width`/`height` (number = px, or any CSS length). `circle` makes it round;
 * `radius` overrides the corner. Compose several to mock a card/row/chart.
 */
export function Skeleton({ width = '100%', height = 14, radius, circle = false, style, ...rest }) {
  return (
    <div
      className="zt-skeleton"
      style={{
        width: typeof width === 'number' ? width + 'px' : width,
        height: typeof height === 'number' ? height + 'px' : height,
        borderRadius: circle ? '999px' : (radius != null ? radius : undefined),
        flex: 'none',
        ...style,
      }}
      {...rest}
    />
  );
}

/** SkeletonText — a stack of shimmer lines; the last is shortened. */
export function SkeletonText({ lines = 3, gap = 9, lastWidth = '60%', height = 11, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, ...style }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={height} width={i === lines - 1 ? lastWidth : '100%'} />
      ))}
    </div>
  );
}

/** Spinner — a small circular indeterminate spinner using the accent color. */
export function Spinner({ size = 20, stroke = 2.5, color = 'var(--accent)', style }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      style={{
        display: 'inline-block', width: size, height: size,
        border: `${stroke}px solid var(--border-hairline)`,
        borderTopColor: color,
        borderRadius: '999px',
        animation: 'zt-spin 0.7s linear infinite',
        ...style,
      }}
    />
  );
}

/**
 * LoadingBar — a thin indeterminate progress bar (the "page is loading" cue).
 * Render it fixed to the top of a surface; remove it when content is ready.
 */
export function LoadingBar({ height = 2, color = 'var(--accent)', style }) {
  return (
    <div style={{ position: 'relative', width: '100%', height, overflow: 'hidden', background: 'var(--paper-tint)', ...style }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: color,
        transformOrigin: 'left center',
        animation: 'zt-indeterminate 1.15s var(--ease-in-out) infinite',
      }} />
    </div>
  );
}
