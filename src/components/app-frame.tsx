"use client";
/**
 * The app frame: the design system's AppShell wired to Next routing and the
 * module registry. Phone → tab bar + camera action + "More" sheet; tablet →
 * icon rail; desktop → grouped sidebar. Wrap every signed-in page in it.
 */
import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell, BottomSheet, Card, IconButton, type ShellModule } from "@/ui";
import { modulesFor, moduleForPath } from "@/lib/modules";
import type { FrameUser } from "@/lib/frame-user";
import { signOut } from "@/app/login/actions";
import { tickRemindersAction } from "@/app/actions/reminders";

export type { FrameUser } from "@/lib/frame-user";

export interface FrameProps extends FrameUser {
  unread?: number;
  theme?: "light" | "dark" | "system";
  /** Allowed module slugs (Phase 6 People & permissions); undefined/empty = all. */
  modules?: string[];
}

const ADD_ACTIONS: { icon: string; title: string; body: string; href: string }[] = [
  { icon: "receipt", title: "A receipt", body: "Matches your purchases", href: "/finance" },
  { icon: "quote", title: "A quote", body: "Something someone said", href: "/quotes?add=1" },
  { icon: "shopping-cart", title: "To the list", body: "Groceries", href: "/groceries" },
  { icon: "utensils", title: "Plan dinner", body: "This week's meals", href: "/meals" },
  { icon: "calendar-plus", title: "An event", body: "On the family calendar", href: "/calendar" },
];

/** Apply a saved theme preference on the client (mirrors what the server did from the cookie). */
function useThemeSync(theme?: "light" | "dark" | "system") {
  React.useEffect(() => {
    if (!theme || theme === "system") return;
    try {
      localStorage.setItem("zhq-theme", theme);
      if (theme === "dark") document.documentElement.setAttribute("data-zh-theme", "dark");
      else document.documentElement.removeAttribute("data-zh-theme");
      const m = document.querySelector('meta[name="theme-color"]');
      if (m) m.setAttribute("content", theme === "dark" ? "#15141A" : "#FBFAF7");
    } catch { /* storage blocked */ }
  }, [theme]);
}

/** Fire the reminder tick once per app open (at most every 5 minutes per device); never blocks anything. */
function useReminderTick() {
  React.useEffect(() => {
    try {
      const last = Number(sessionStorage.getItem("zhq-reminder-tick") || 0);
      if (Date.now() - last < 5 * 60 * 1000) return;
      sessionStorage.setItem("zhq-reminder-tick", String(Date.now()));
    } catch { /* storage blocked — tick anyway */ }
    tickRemindersAction().catch(() => {});
  }, []);
}

export function AppFrame({ user, children, bare = false }: { user: FrameProps; children: React.ReactNode; bare?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [add, setAdd] = React.useState(false);
  useThemeSync(user.theme);
  useReminderTick();
  if (bare) return <>{children}</>;
  const allowed = user.modules?.length ? new Set(user.modules) : null;
  const modules: ShellModule[] = modulesFor(user.role).filter((m) => !allowed || allowed.has(m.slug)).map((m) => ({
    key: m.slug, label: m.name, short: m.short, icon: m.icon, tint: m.tint, group: m.group, primary: m.primary, muted: m.status === "planned",
  }));
  const active = moduleForPath(pathname);
  const go = (key: string) => { const m = modulesFor(user.role).find((x) => x.slug === key); if (m) router.push(m.href); };
  const bell = <IconButton icon="bell" label="Notifications" badge={user.unread ? (user.unread > 9 ? "9+" : user.unread) : undefined} active={pathname.startsWith("/notifications")} onClick={() => router.push("/notifications")} />;
  return (
    <div style={{ height: "100dvh", background: "var(--bg-app)" }}>
      <AppShell
        modules={modules} active={active} onNavigate={go}
        user={{ name: user.name, person: user.person, src: user.src ?? undefined }}
        onAction={() => setAdd(true)} actionIcon="plus" actionLabel="Add something" onSignOut={() => signOut()} onUser={() => router.push("/me")} headerActions={bell}
      >
        <div style={{ height: "100%", overflow: "auto", minWidth: 0 }}>{children}</div>
      </AppShell>
      <BottomSheet open={add} onClose={() => setAdd(false)} title="Add">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, paddingBottom: 8 }}>
          {ADD_ACTIONS.map((a) => (
            <Card key={a.title} icon={a.icon} title={a.title} intensity="finance" onClick={() => { setAdd(false); router.push(a.href); }}>
              <span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}>{a.body}</span>
            </Card>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}
