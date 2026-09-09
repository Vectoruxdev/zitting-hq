import { Skeleton } from "@/ui";

/**
 * What a screen looks like while its data loads — rendered inside the shared
 * shell by each route's loading.tsx, so a tab tap shows this at once and the
 * nav never blinks. Title, a line of context, then cards.
 */
export function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" style={{ width: "100%", maxWidth: "var(--content-max)", margin: "0 auto", padding: "16px var(--page-gutter-mobile) 48px", display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Skeleton variant="title" width="45%" style={{ height: 32 }} />
        <Skeleton width="70%" />
      </div>
      {Array.from({ length: cards }, (_, i) => (
        <Skeleton key={i} variant="rect" height={i === 0 ? 140 : 96} delay={i * 80} style={{ borderRadius: "var(--radius-lg, 18px)" }} />
      ))}
    </div>
  );
}
