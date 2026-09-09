import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { timed } from "@/lib/timing";
import { isAuthConfigured } from "@/lib/supabase/server";
import { getHomeCore, getHomeSlow } from "@/db/home";
import { HomeScreen } from "./home-screen";

export const metadata = { title: "Zitting HQ" };
export const dynamic = "force-dynamic";

/* Home — the per-person dashboard. Owner sees the household; a wife sees her
   Spendable; everyone sees the family, today, and what needs them. */
export default async function Home() {
  const user = await getCurrentUser();
  if (isAuthConfigured && !user) redirect("/login");
  const role = (user?.role ?? "owner") as "owner" | "partner" | "member";
  const viewer = { memberId: user?.memberId ?? null, role };
  // While the owner is "viewing as" someone, `user` is that person — but the
  // family row should still work as the owner's switcher.
  const core = await timed("/", getHomeCore(viewer, user?.name ?? "there", {
    actingOwner: role === "owner" || !!user?.viewingAs,
    realMemberId: user?.viewingAs ? user.viewingAs.ownerMemberId : (user?.memberId ?? null),
  }));
  // Not awaited: React streams this to the client, and the money, calendar,
  // chores and goals sections fill in behind their skeletons.
  const slow = getHomeSlow(viewer, core);
  // Phones start in one column, everything else in two — decided here so the
  // first paint is already the right layout (a later switch remounts the hero).
  const ua = (await headers()).get("user-agent") ?? "";
  const initialNarrow = /Mobi|Android|iPhone|iPod/i.test(ua);
  return <HomeScreen data={core} slow={slow} initialNarrow={initialNarrow} />;
}
