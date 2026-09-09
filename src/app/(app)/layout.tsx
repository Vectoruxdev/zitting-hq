import { redirect } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { frameContext } from "@/lib/frame";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";

/**
 * The app shell (nav, header, add sheet, view-as banner) lives here, once, for
 * every signed-in screen. Layouts don't re-render on client navigation, so a
 * tab tap swaps only the page — the shell stays put and the frame's reads
 * (profile, unread count, module access) aren't repeated. Each page's
 * loading.tsx renders inside this shell, so the next screen's skeleton shows
 * the instant you tap. Finance keeps its own frame (members get its bare canvas).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (isAuthConfigured && !user) redirect("/login");
  const ctx = await frameContext(user);
  return <AppFrame user={ctx}>{children}</AppFrame>;
}
