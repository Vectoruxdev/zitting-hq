import { EmptyState, Reveal } from "@/ui";
import { getModule } from "@/lib/modules";

/** Honest placeholder for a module that is planned but not built yet. */
export function ModulePlaceholder({ slug }: { slug: string }) {
  const m = getModule(slug);
  return (
    <div style={{ maxWidth: "var(--content-max-narrow)", margin: "0 auto", padding: "var(--space-8) var(--page-gutter-mobile) 64px" }}>
      <Reveal>
        <h1 style={{ margin: "0 0 var(--space-6)", font: "var(--type-greeting)", fontSize: "var(--fs-3xl)", letterSpacing: "var(--ls-display)" }}>{m?.name ?? slug}</h1>
        <EmptyState icon={m?.icon ?? "sparkles"} title="Not built yet" body={`${m?.description ?? ""} This part of Zitting HQ is on the way.`} />
      </Reveal>
    </div>
  );
}
