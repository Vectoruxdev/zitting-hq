"use client";
/**
 * Groceries — the shared list and the pantry. One-thumb add, big check-off at
 * the store, "who's grabbing it", and staples that nag when they run out.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { Avatar, Badge, Button, Checkbox, EmptyState, IconButton, Input, Reveal, Row, Section, SegmentedControl, Select, Stagger, Tabs, Toggle, ToastProvider, useToast } from "@/ui";
import * as actions from "./actions";

const CATEGORIES = [
  { id: "produce", label: "Produce", icon: "carrot" }, { id: "dairy", label: "Dairy", icon: "milk" }, { id: "meat", label: "Meat", icon: "beef" }, { id: "pantry", label: "Pantry", icon: "wheat" },
  { id: "frozen", label: "Frozen", icon: "ice-cream-cone" }, { id: "household", label: "Household", icon: "house" }, { id: "other", label: "Other", icon: "shopping-basket" },
];
const catOf = (id: string) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

export interface ShoppingItem { id: number; name: string; note: string | null; category: string; checked: boolean; source: string; assigneeMemberId: string | null; requestedBy: string | null }
export interface PantryItem { id: number; name: string; category: string; level: string; staple: boolean }
export interface PersonLite { id: string; name: string; greetingName: string; hue: number; avatarUrl: string | null }

function Inner({ configured, items, pantry, people, me }: { configured: boolean; items: ShoppingItem[]; pantry: PantryItem[]; people: PersonLite[]; me: string | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = React.useState("list");
  const [busy, setBusy] = React.useState<string | number | null>(null);
  const run = async (key: string | number, fn: () => Promise<unknown>, done?: string) => { setBusy(key); try { const r = (await fn()) as { ok?: boolean; error?: string } | undefined; if (r && r.ok === false) toast({ title: r.error || "That didn't save", tone: "negative" }); else if (done) toast({ title: done, tone: "positive" }); router.refresh(); } finally { setBusy(null); } };
  const open = items.filter((i) => !i.checked), done = items.filter((i) => i.checked);
  const low = pantry.filter((p) => p.level !== "ok");
  return (
    <div style={{ width: "100%", maxWidth: "var(--content-max-narrow)", margin: "0 auto", padding: "16px var(--page-gutter-mobile) 64px", display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      <Reveal>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div><p style={{ margin: "0 0 6px", font: "var(--type-overline)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Groceries</p><h1 style={{ margin: 0, font: "var(--type-greeting)", fontSize: "clamp(var(--fs-3xl), 5vw, var(--fs-4xl))", letterSpacing: "var(--ls-display)" }}>{tab === "list" ? "The list" : "The pantry"}</h1></div>
          <Tabs size="sm" items={[{ key: "list", label: "List", count: open.length || undefined }, { key: "pantry", label: "Pantry", count: low.length || undefined }]} value={tab} onChange={setTab} />
        </div>
      </Reveal>
      {!configured ? <Reveal index={1}><EmptyState tone="error" title="The grocery tables aren’t set up yet" body="Run supabase-groceries.sql in the Supabase SQL Editor, then reload." /></Reveal> : null}
      {tab === "list" ? <ShoppingList open={open} done={done} people={people} me={me} busy={busy} run={run} /> : <Pantry pantry={pantry} busy={busy} run={run} />}
    </div>
  );
}

function ShoppingList({ open, done, people, me, busy, run }: { open: ShoppingItem[]; done: ShoppingItem[]; people: PersonLite[]; me: string | null; busy: string | number | null; run: (k: string | number, fn: () => Promise<unknown>, done?: string) => Promise<void> }) {
  const [name, setName] = React.useState("");
  const [note, setNote] = React.useState("");
  const [category, setCategory] = React.useState("other");
  const [assignee, setAssignee] = React.useState("");
  const person = (id: string | null) => people.find((p) => p.id === id);
  const add = () => { if (!name.trim()) return; run("add", async () => { const r = await actions.addShoppingItem({ name, note: note || null, category, assigneeMemberId: assignee || null }); if (r.ok) { setName(""); setNote(""); } return r; }); };
  const groups = CATEGORIES.map((c) => ({ c, rows: open.filter((i) => i.category === c.id) })).filter((g) => g.rows.length);
  const ItemRow = ({ item }: { item: ShoppingItem }) => {
    const who = person(item.assigneeMemberId);
    return (
      <Row
        leading={<Checkbox checked={item.checked} size="lg" onChange={() => run(item.id, () => actions.setShoppingChecked(item.id, !item.checked))} style={{ minHeight: 0, padding: 0 }} />}
        title={<span style={{ textDecoration: item.checked ? "line-through" : "none", opacity: item.checked ? 0.6 : 1 }}>{item.name}</span>}
        meta={[item.note, item.source === "meal" ? "from a recipe" : item.source === "pantry" ? "pantry staple" : null, who ? `${who.id === me ? "you're" : who.greetingName + " is"} grabbing it` : null].filter(Boolean).join(" · ") || undefined}
        trailing={<>
          {who ? <Avatar name={who.name} src={who.avatarUrl} person={who.hue} size="xs" /> : null}
          <Select size="sm" value={item.assigneeMemberId ?? ""} placeholder="Who?" options={people.map((p) => ({ value: p.id, label: p.greetingName }))} onChange={(e) => run(`who-${item.id}`, () => actions.setShoppingAssignee(item.id, e.target.value || null))} style={{ width: 112 }} />
          <IconButton icon="x" label={`Remove ${item.name}`} size="sm" onClick={() => run(item.id, () => actions.deleteShoppingItem(item.id))} />
        </>}
        chevron={false}
      />
    );
  };
  return (
    <Stagger gap={28} start={1}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <Input placeholder="Milk, eggs, cilantro…" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} style={{ flex: 1 }} />
          <Button iconLeft="plus" onClick={add} disabled={!name.trim()} loading={busy === "add"} style={{ alignSelf: "flex-end" }}>Add</Button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Input size="sm" placeholder="2 gal · the good kind" value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: "1 1 140px" }} />
          <Select size="sm" value={category} options={CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} onChange={(e) => setCategory(e.target.value)} style={{ flex: "1 1 120px" }} />
          <Select size="sm" value={assignee} placeholder="Anyone" options={people.map((p) => ({ value: p.id, label: p.greetingName }))} onChange={(e) => setAssignee(e.target.value)} style={{ flex: "1 1 120px" }} />
        </div>
      </div>
      {!open.length && !done.length ? <EmptyState icon="shopping-cart" title="The list is empty" body="Add what you need, or send a recipe's ingredients here from Meals. Everyone sees the same list at the store." /> : null}
      {groups.map((g) => <Section key={g.c.id} title={g.c.label} action={<Badge tone="neutral">{g.rows.length}</Badge>}><div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{g.rows.map((i) => <ItemRow key={i.id} item={i} />)}</div></Section>)}
      {done.length ? <Section title="In the cart" action={<Button size="sm" variant="ghost" iconLeft="check" loading={busy === "clear"} onClick={() => run("clear", () => actions.clearBought(), "Cleared")}>Clear {done.length}</Button>}><div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{done.map((i) => <ItemRow key={i.id} item={i} />)}</div></Section> : null}
    </Stagger>
  );
}

function Pantry({ pantry, busy, run }: { pantry: PantryItem[]; busy: string | number | null; run: (k: string | number, fn: () => Promise<unknown>, done?: string) => Promise<void> }) {
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState("pantry");
  const [staple, setStaple] = React.useState(true);
  const add = () => { if (!name.trim()) return; run("add", async () => { const r = await actions.addPantryItem({ name, category, staple }); if (r.ok) setName(""); return r; }); };
  const needs = pantry.filter((p) => p.level !== "ok").sort((a, b) => (a.level === "out" ? -1 : 1) - (b.level === "out" ? -1 : 1));
  const stocked = pantry.filter((p) => p.level === "ok");
  const PRow = ({ p }: { p: PantryItem }) => (
    <Row
      icon={catOf(p.category).icon} tint={p.level === "out" ? "coral" : p.level === "low" ? "butter" : "mint"}
      title={<>{p.name}{p.staple ? <Badge size="sm" tone="neutral" style={{ marginLeft: 8, verticalAlign: "middle" }}>staple</Badge> : null}</>}
      meta={catOf(p.category).label}
      trailing={<>
        <SegmentedControl size="sm" items={[{ key: "ok", label: "OK" }, { key: "low", label: "Low" }, { key: "out", label: "Out" }]} value={p.level} onChange={(l) => run(p.id, () => actions.setPantryLevel(p.id, l as "ok" | "low" | "out"))} />
        {p.level !== "ok" ? <IconButton icon="shopping-cart" label="Add to the list" size="sm" variant="outline" onClick={() => run(`send-${p.id}`, () => actions.sendPantryItemToList(p.id), "Added to the list")} /> : null}
        <IconButton icon="x" label={`Remove ${p.name}`} size="sm" onClick={() => run(p.id, () => actions.deletePantryItem(p.id))} />
      </>}
      chevron={false}
    />
  );
  return (
    <Stagger gap={28} start={1}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <Input placeholder="Rice, olive oil, diapers…" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} style={{ flex: 1 }} />
          <Button iconLeft="plus" onClick={add} disabled={!name.trim()} loading={busy === "add"}>Add</Button>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <Select size="sm" value={category} options={CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} onChange={(e) => setCategory(e.target.value)} style={{ flex: "0 1 160px" }} />
          <Toggle size="sm" label="Staple — nag when it runs out" checked={staple} onChange={setStaple} style={{ minHeight: 36 }} />
        </div>
      </div>
      {!pantry.length ? <EmptyState icon="refrigerator" title="Nothing tracked yet" body="Keep the things you always want on hand. Tap a level when you notice it running low — staples that hit Out jump to the top and onto the list." /> : null}
      {needs.length ? <Section title="Running low" action={<Badge tone="warning">{needs.length}</Badge>}><div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{needs.map((p) => <PRow key={p.id} p={p} />)}</div></Section> : null}
      {stocked.length ? <Section title="Stocked"><div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{stocked.map((p) => <PRow key={p.id} p={p} />)}</div></Section> : null}
    </Stagger>
  );
}

export function GroceriesClient(props: React.ComponentProps<typeof Inner>) {
  return <ToastProvider><Inner {...props} /></ToastProvider>;
}
