import { Wordmark } from "@/ui";
import { RetryButton } from "./retry-button";

export const metadata = { title: "Offline · Zitting HQ" };

/** Served by the service worker when a navigation fails with no network. No data, no auth — just a calm place to wait. */
export default function OfflinePage() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "var(--bg-app)", color: "var(--text-primary)" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, textAlign: "center", maxWidth: 360 }}>
        <Wordmark />
        <h1 style={{ margin: "8px 0 0", font: "var(--type-h1)" }}>You’re offline</h1>
        <p style={{ margin: 0, font: "var(--type-body)", color: "var(--text-secondary)" }}>Zitting HQ needs a connection for the live stuff — money, photos, tonight’s dinner. It’ll be right here when you’re back on.</p>
        <RetryButton />
      </div>
    </main>
  );
}
