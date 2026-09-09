import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { getHomeData } from "@/db/home";
import { HomeScreen } from "./home-screen";

export const metadata = { title: "Zitting HQ" };
export const dynamic = "force-dynamic";

/* Home — the per-person dashboard. Owner sees the household; a wife sees her
   Spendable; everyone sees the family, today, and what needs them. */
export default async function Home() {
  const user = await getCurrentUser();
  if (isAuthConfigured && !user) redirect("/login");
  const role = (user?.role ?? "owner") as "owner" | "partner" | "member";
  const data = await getHomeData({ memberId: user?.memberId ?? null, role }, user?.name ?? "there");
  return (
    <>
      <HomeScreen data={data} />
    </>
  );
}
