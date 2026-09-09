import { redirect } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { frameContext } from "@/lib/frame";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { listNotifications } from "@/db/notifications";
import { NotificationsClient } from "./notifications-client";

export const metadata = { title: "Notifications · Zitting HQ" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (isAuthConfigured && !user) redirect("/login?redirect=/notifications");
  const viewer = { memberId: user?.memberId ?? null, role: (user?.role ?? "owner") as "owner" | "partner" | "member" };
  const [ctx, items] = await Promise.all([frameContext(user), listNotifications(viewer)]);
  return (
    <AppFrame user={ctx}>
      <NotificationsClient items={items} />
    </AppFrame>
  );
}
