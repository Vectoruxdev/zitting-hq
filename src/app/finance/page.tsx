import { redirect } from "next/navigation";
import FinanceClient from "@/finance/FinanceClient";
import { AppFrame } from "@/components/app-frame";
import { frameContext } from "@/lib/frame";
import { getFinanceData } from "@/db/queries";
import { touchMemberLastSeen } from "@/db/mutations";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";

// Server actions inherit this segment config — the manual "Sync now" action
// needs the same headroom as the cron sync (slow bank pulls).
export const maxDuration = 300;

export const metadata = {
  title: "Finance · Zitting HQ",
};

// Read live data per request when a database is configured; falls back to the
// curated mock otherwise (so it also prerenders fine with no DB).
export const dynamic = "force-dynamic";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const user = await getCurrentUser();
  // When auth is configured, require a session. When it isn't (e.g. local dev
  // with no Supabase env), fall through as owner so the app stays usable.
  if (isAuthConfigured && !user) redirect("/login?redirect=/finance");
  const ctx = await frameContext(user);

  // Record "last opened the app" (throttled + defensive) for the People & Access view.
  if (user?.memberId) await touchMemberLastSeen(user.memberId);

  // ?as=<memberId> — owner's "preview as this member" (Access → Preview).
  // getFinanceData only honors it for the owner role.
  const { as } = await searchParams;
  const data = await getFinanceData({
    memberId: user?.memberId ?? null,
    role: user?.role ?? "owner",
    previewMemberId: as ?? null,
  });
  const role = user?.role ?? "owner";
  // Members get the self-contained Spendable canvas (its own header, tabs and
  // camera) until Phase 6 ports it into the frame; owners get finance inside
  // the app frame with the sections as a sub-nav.
  const bare = role === "member" || !!as;
  return (
    <AppFrame user={ctx} bare={bare}>
      <FinanceClient data={data} role={role} name={user?.name} embedded={!bare} />
    </AppFrame>
  );
}
