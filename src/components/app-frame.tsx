"use client";
/**
 * The app frame: the design system's AppShell wired to Next routing and the
 * module registry. Phone → tab bar + camera action + "More" sheet; tablet →
 * icon rail; desktop → grouped sidebar. Wrap every signed-in page in it.
 */
import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell, BottomSheet, Card, type ShellModule } from "@/ui";
import { modulesFor, moduleForPath } from "@/lib/modules";
import { signOut } from "@/app/login/actions";

import type { FrameUser } from "@/lib/frame-user";
export type { FrameUser } from "@/lib/frame-user";

const ADD_ACTIONS: { icon: string; title: string; body: string; href: string }[] = [
  { icon: "receipt", title: "A receipt", body: "Matches your purchases", href: "/finance" },
  { icon: "shopping-cart", title: "To the list", body: "Groceries", href: "/groceries" },
  { icon: "utensils", title: "Plan dinner", body: "This week's meals", href: "/meals" },
  { icon: "calendar-plus", title: "An event", body: "On the family calendar", href: "/calendar" },
];

export function AppFrame({ user, children, bare = false }: { user: FrameUser; children: React.ReactNode; bare?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [add, setAdd] = React.useState(false);
  if (bare) return <>{children}</>;
  const modules: ShellModule[] = modulesFor(user.role).map((m) => ({
    key: m.slug, label: m.name, short: m.short, icon: m.icon, tint: m.tint, group: m.group, primary: m.primary, muted: m.status === "planned",
  }));
  const active = moduleForPath(pathname);
  const go = (key: string) => { const m = modulesFor(user.role).find((x) => x.slug === key); if (m) router.push(m.href); };
  return (
    <div style={{ height: "100dvh", background: "var(--bg-app)" }}>
      <AppShell modules={modules} active={active} onNavigate={go} user={{ name: user.name, person: user.person, src: user.src ?? undefined }} onAction={() => setAdd(true)} onSignOut={() => signOut()}>
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
