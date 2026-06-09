import { redirect } from "next/navigation";
import FinanceClient from "@/finance/FinanceClient";
import { getFinanceData } from "@/db/queries";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";

export const metadata = {
  title: "Finance · Family HQ",
};

// Read live data per request when a database is configured; falls back to the
// curated mock otherwise (so it also prerenders fine with no DB).
export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const user = await getCurrentUser();
  // When auth is configured, require a session. When it isn't (e.g. local dev
  // with no Supabase env), fall through as owner so the app stays usable.
  if (isAuthConfigured && !user) redirect("/login?redirect=/finance");

  const data = await getFinanceData({ memberId: user?.memberId ?? null, role: user?.role ?? "owner" });
  return <FinanceClient data={data} role={user?.role ?? "owner"} name={user?.name} />;
}
