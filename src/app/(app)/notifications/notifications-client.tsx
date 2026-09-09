"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, EmptyState, Reveal, Row, Section, Tabs, type Tint } from "@/ui";
import type { HubNotification } from "@/db/notifications";
import { markRead } from "./actions";

const MODULE_TINT: Record<string, Tint> = { finance: "sky", meals: "butter", groceries: "mint", calendar: "sky", photos: "rose", quotes: "rose", goals: "mint", trips: "sky", chores: "butter", family: "coral" };
const TONE_ICON: Record<string, string> = { negative: "circle-alert", warning: "triangle-alert", accent: "sparkles", info: "info" };

function when(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso), now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NotificationsClient({ items }: { items: HubNotification[] }) {
  const router = useRouter();
  const [filter, setFilter] = React.useState("all");
  const modules = Array.from(new Set(items.map((n) => n.module)));
  const shown = items.filter((n) => filter === "all" || n.module === filter);
  const today = new Date().toDateString();
  const groups: { label: string; rows: HubNotification[] }[] = [
    { label: "Today", rows: shown.filter((n) => n.createdAt && new Date(n.createdAt).toDateString() === today) },
    { label: "Earlier", rows: shown.filter((n) => !n.createdAt || new Date(n.createdAt).toDateString() !== today) },
  ].filter((g) => g.rows.length);
  const unread = items.filter((n) => n.unread).length;
  const open = async (n: HubNotification) => { if (n.unread) await markRead([n.id]); router.push(n.href); };
  return (
    <div style={{ width: "100%", maxWidth: "var(--content-max-narrow)", margin: "0 auto", padding: "16px var(--page-gutter-mobile) 64px", display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      <Reveal>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div><h1 style={{ margin: 0, font: "var(--type-greeting)", fontSize: "var(--fs-3xl)", letterSpacing: "var(--ls-display)" }}>Notifications</h1>{unread ? <p style={{ margin: "4px 0 0", font: "var(--type-body-sm)", color: "var(--text-secondary)" }}>{unread} unread</p> : null}</div>
          {unread ? <Button size="sm" variant="secondary" iconLeft="check" onClick={async () => { await markRead(); router.refresh(); }}>Mark all read</Button> : null}
        </div>
      </Reveal>
      {modules.length > 1 ? <Reveal index={1}><Tabs size="sm" items={[{ key: "all", label: "All", count: items.length }, ...modules.map((m) => ({ key: m, label: m[0].toUpperCase() + m.slice(1), count: items.filter((n) => n.module === m).length }))]} value={filter} onChange={setFilter} /></Reveal> : null}
      {!shown.length ? <Reveal index={2}><EmptyState icon="bell" title="All quiet" body="Nothing needs you right now. New alerts from money, meals, photos and the rest land here." /></Reveal> : null}
      {groups.map((g, gi) => (
        <Reveal key={g.label} index={gi + 2}>
          <Section title={g.label}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {g.rows.map((n) => (
                <Row key={n.id} icon={TONE_ICON[n.tone] || "bell"} tint={MODULE_TINT[n.module] || "coral"} tone={n.unread ? "soft" : "default"} title={n.title} meta={<>{when(n.createdAt)}{n.body ? ` · ${n.body}` : ""}</>} trailing={n.unread ? <Badge tone="accent" dot /> : undefined} onClick={() => open(n)} chevron style={n.unread ? { margin: 0, boxSizing: "border-box", padding: "8px 12px" } : undefined} />
              ))}
            </div>
          </Section>
        </Reveal>
      ))}
    </div>
  );
}
