import { notFound } from "next/navigation";
import { Gallery } from "./gallery";

export const metadata = { title: "Design system · Zitting HQ" };
export const dynamic = "force-dynamic";

// Dev-only component gallery for src/ui — mirrors the Claude Design project's
// cards (ds-bundle/components/*/*.card.html) so a port can be eyeballed against
// the source of truth in both themes at phone and desktop widths. Hard-gated to
// `next dev` like /dev-preview.
export default function UiGalleryPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <Gallery />;
}
