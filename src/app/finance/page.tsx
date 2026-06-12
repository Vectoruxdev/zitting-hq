import { redirect } from "next/navigation";
import FinanceClient from "@/finance/FinanceClient";
import { getFinanceData } from "@/db/queries";
import { touchMemberLastSeen } from "@/db/mutations";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";

// Server actions inherit this segment config — the manual "Sync now" action
// needs the same headroom as the cron sync (slow bank pulls).
export const maxDuration = 300;

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

  // Record "last opened the app" (throttled + defensive) for the People & Access view.
  if (user?.memberId) await touchMemberLastSeen(user.memberId);

  const data = await getFinanceData({ memberId: user?.memberId ?? null, role: user?.role ?? "owner" });
  return <FinanceClient data={data} role={user?.role ?? "owner"} name={user?.name} />;
}
