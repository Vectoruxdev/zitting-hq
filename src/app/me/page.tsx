import { redirect } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { frameContext } from "@/lib/frame";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { getMemberNotificationPrefs, getPerson } from "@/db/profiles";
import { MeClient } from "./me-client";

export const metadata = { title: "Profile · Zitting HQ" };
export const dynamic = "force-dynamic";

export default async function MePage() {
  const user = await getCurrentUser();
  if (isAuthConfigured && !user) redirect("/login?redirect=/me");
  const [ctx, person, prefs] = await Promise.all([
    frameContext(user),
    getPerson(user?.memberId),
    user?.memberId ? getMemberNotificationPrefs(user.memberId) : Promise.resolve([]),
  ]);
  return (
    <AppFrame user={ctx}>
      <MeClient person={person} prefs={prefs} canEdit={!!user?.memberId} />
    </AppFrame>
  );
}
