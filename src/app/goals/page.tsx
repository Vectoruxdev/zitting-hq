import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { AppFrame } from "@/components/app-frame";
import { frameContext } from "@/lib/frame";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata = { title: "Goals · Zitting HQ" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getCurrentUser();
  if (isAuthConfigured && !user) redirect("/login?redirect=/goals");
  const ctx = await frameContext(user);
  return (
    <AppFrame user={ctx}>
      <ModulePlaceholder slug="goals" />
    </AppFrame>
  );
}
