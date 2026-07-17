import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { getNestData } from "@/db/nest";
import { NestClient } from "./nest-client";

export const metadata = { title: "Cameras · Zitting HQ" };
export const dynamic = "force-dynamic";

export default async function NestPage() {
  const user = await getCurrentUser();
  if (isAuthConfigured && !user) redirect("/login?redirect=/nest");

  // Owner-only module: members see a friendly closed door, not the controls.
  if (isAuthConfigured && user && user.role !== "owner") {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
        <SiteHeader />
        <main style={{ flex: 1, padding: "clamp(20px, 4vw, 40px) 18px 56px" }}>
          <div
            style={{
              maxWidth: 560,
              margin: "40px auto 0",
              padding: 22,
              background: "var(--surface-card)",
              border: "1px solid var(--border-hairline)",
              borderRadius: "var(--radius-lg, 18px)",
              fontSize: 14,
              lineHeight: 1.6,
              color: "var(--text-secondary)",
            }}
          >
            📷 The camera controls are owner-only for now.
          </div>
        </main>
      </div>
    );
  }

  const data = await getNestData();

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <main style={{ flex: 1, padding: "clamp(20px, 4vw, 40px) 18px 56px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <NestClient data={JSON.parse(JSON.stringify(data))} />
        </div>
      </main>
    </div>
  );
}
