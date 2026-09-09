import { redirect } from "next/navigation";
import FinanceClient from "@/finance/FinanceClient";
import { AppFrame } from "@/components/app-frame";
import { frameContext } from "@/lib/frame";
import { getFinanceData } from "@/db/queries";
import { touchMemberLastSeen } from "@/db/mutations";
import { getCurrentUser } from "@/lib/auth";
import { timed } from "@/lib/timing";
import { isAuthConfigured } from "@/lib/supabase/server";

/** Sections that have their own URL (/finance/<section>). Old ids (bulk, import, allocations…) still work via FinanceApp's aliases. */
export const FINANCE_SECTIONS = ["overview", "accounts", "transactions", "budgets", "transfers", "savings", "income", "notifications", "ask", "settings"] as const;

/**
 * Shared server component behind /finance and /finance/[section]. Reads live
 * data per request when a database is configured; falls back to the curated
 * mock otherwise (so it also prerenders fine with no DB).
 */
export async function FinancePage({ section, searchParams }: { section: string | null; searchParams: { as?: string; tab?: string } }) {
  const user = await timed("/finance", getCurrentUser());
  // When auth is configured, require a session. When it isn't (e.g. local dev
  // with no Supabase env), fall through as owner so the app stays usable.
  if (isAuthConfigured && !user) redirect(`/login?redirect=${encodeURIComponent(section ? `/finance/${section}` : "/finance")}`);
  const ctx = await frameContext(user);

  // Record "last opened the app" (throttled + defensive) for the People & Access view.
  if (user?.memberId && !user.viewingAs) await touchMemberLastSeen(user.memberId);

  // ?as=<memberId> — owner's "preview as this member" (People → Preview).
  // getFinanceData only honors it for the owner role.
  const { as, tab } = searchParams;
  const data = await getFinanceData({
    memberId: user?.memberId ?? null,
    role: user?.role ?? "owner",
    previewMemberId: as ?? null,
  });
  const role = user?.role ?? "owner";
  // Members get the self-contained Spendable canvas (its own header, tabs and
  // camera); owners get finance inside the app frame with the sections as a
  // sub-nav and a URL per section.
  const bare = role === "member" || !!as;
  return (
    <AppFrame user={ctx} bare={bare}>
      <FinanceClient data={data} role={role} name={user?.name} embedded={!bare} initialRoute={section} initialTab={tab && /^[a-z-]+$/.test(tab) ? tab : null} />
    </AppFrame>
  );
}
