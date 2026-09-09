import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { AppFrame } from "@/components/app-frame";
import { frameUser } from "@/lib/frame-user";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata = { title: "Trips · Zitting HQ" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getCurrentUser();
  if (isAuthConfigured && !user) redirect("/login?redirect=/trips");
  return (
    <AppFrame user={frameUser(user)}>
      <ModulePlaceholder slug="trips" />
    </AppFrame>
  );
}
