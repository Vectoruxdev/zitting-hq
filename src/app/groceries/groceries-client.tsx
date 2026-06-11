"use client";

/**
 * Groceries — shared shopping list + pantry. Mobile-first: big tap targets,
 * one-thumb add, check-off at the store. Anyone in the family can use it.
 */
import React from "react";
import { useRouter } from "next/navigation";
import * as actions from "./actions";

const CATEGORIES = [
  { id: "produce", label: "Produce", emoji: "🥦" },
  { id: "dairy", label: "Dairy", emoji: "🥛" },
  { id: "meat", label: "Meat", emoji: "🥩" },
  { id: "pantry", label: "Pantry", emoji: "🥫" },
  { id: "frozen", label: "Frozen", emoji: "🧊" },
  { id: "household", label: "Household", emoji: "🧻" },
  { id: "other", label: "Other", emoji: "🛒" },
];
const catOf = (id: string) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

export interface ShoppingItem {
  id: number;
  name: string;
  note: string | null;
  category: string;
  checked: boolean;
  source: string;
}
export interface PantryItem {
  id: number;
  name: string;
  category: string;
  level: string;
  staple: boolean;
}

const card: React.CSSProperties = {
  background: "var(--surface-card)",
  border: "1px solid var(--border-hairline)",
  borderRadius: "var(--radius-lg, 18px)",
};

function SegTabs({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { id: string; label: string; badge?: number }[] }) {
  return (
    <div style={{ display: "flex", gap: 6, padding: 4, background: "var(--surface-sunken)", borderRadius: 999 }}>
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          style={{
            flex: 1, padding: "11px 0", borderRadius: 999, border: "none", cursor: "pointer",
            font: "inherit", fontSize: 14, fontWeight: 600, minHeight: 44,
            background: value === o.id ? "var(--surface-card)" : "transparent",
            color: value === o.id ? "var(--text-primary)" : "var(--text-tertiary)",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
          }}
        >
          {o.label}
          {o.badge ? (
            <span className="zt-num" style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 999, background: "var(--green-glow)", color: "var(--accent)" }}>{o.badge}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function GroceriesClient({ configured, items, pantry }: { configured: boolean; items: ShoppingItem[]; pantry: PantryItem[] }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<"list" | "pantry">("list");
  const [busy, setBusy] = React.useState<number | string | null>(null);

  const run = async (key: number | string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const open = items.filter((i) => !i.checked);
  const done = items.filter((i) => i.checked);
  const lowCount = pantry.filter((p) => p.level !== "ok").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <p className="zt-eyebrow" style={{ marginBottom: 6 }}>Groceries</p>
        <h1 style={{ margin: 0, fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 600, letterSpacing: "-0.015em", color: "var(--text-primary)" }}>
          Shopping list & pantry
        </h1>
      </div>

      {!configured ? (
        <div style={{ ...card, padding: 22, fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)" }}>
          The groceries tables aren&apos;t set up yet — run <code style={{ color: "var(--accent)" }}>supabase-groceries.sql</code> in the Supabase SQL Editor, then reload.
        </div>
      ) : null}

      <SegTabs
        value={tab}
        onChange={(v) => setTab(v as "list" | "pantry")}
        options={[
          { id: "list", label: "Shopping list", badge: open.length },
          { id: "pantry", label: "Pantry", badge: lowCount },
        ]}
      />

      {tab === "list" ? (
        <ShoppingList open={open} done={done} busy={busy} run={run} />
      ) : (
        <Pantry pantry={pantry} busy={busy} run={run} />
      )}
    </div>
  );
}

function ShoppingList({ open, done, busy, run }: { open: ShoppingItem[]; done: ShoppingItem[]; busy: number | string | null; run: (k: number | string, fn: () => Promise<unknown>) => Promise<void> }) {
  const [name, setName] = React.useState("");
  const [note, setNote] = React.useState("");
  const [category, setCategory] = React.useState("other");

  const add = () =>
    name.trim() &&
    run("add", async () => {
      await actions.addShoppingItem({ name, note: note || null, category });
      setName("");
      setNote("");
    });

  // group open items by category for store-order scanning
  const groups = CATEGORIES.map((c) => ({ c, rows: open.filter((i) => i.category === c.id) })).filter((g) => g.rows.length);

  const input: React.CSSProperties = {
    height: 48, padding: "0 14px", background: "var(--surface-sunken)", border: "1px solid var(--border-hairline)",
    borderRadius: "var(--radius-md, 12px)", color: "var(--text-primary)", fontSize: 15, outline: "none", minWidth: 0,
  };

  return (
    <>
      {/* add row */}
      <div style={{ ...card, padding: 14 }}>
        <form
          onSubmit={(e) => { e.preventDefault(); add(); }}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <div style={{ display: "flex", gap: 10 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add something… (milk)" style={{ ...input, flex: 2 }} aria-label="Item name" />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Qty" style={{ ...input, flex: 1, maxWidth: 110 }} aria-label="Quantity" />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", flex: 1, paddingBottom: 2 }}>
              {CATEGORIES.map((c) => (
                <button key={c.id} type="button" onClick={() => setCategory(c.id)}
                  style={{
                    flex: "none", padding: "8px 12px", borderRadius: 999, border: "1px solid var(--border-hairline)",
                    background: category === c.id ? "var(--green-glow)" : "var(--surface-sunken)",
                    color: category === c.id ? "var(--accent)" : "var(--text-tertiary)",
                    font: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer", minHeight: 38,
                  }}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
            <button type="submit" disabled={!name.trim() || busy === "add"}
              style={{
                flex: "none", height: 44, padding: "0 22px", borderRadius: 999, border: "none", cursor: "pointer",
                background: "var(--accent)", color: "var(--text-on-accent, #06130b)", font: "inherit", fontSize: 14.5, fontWeight: 700,
                opacity: !name.trim() || busy === "add" ? 0.55 : 1,
              }}>
              Add
            </button>
          </div>
        </form>
      </div>

      {/* open items, grouped by aisle */}
      {groups.length === 0 && done.length === 0 ? (
        <div style={{ ...card, padding: 28, textAlign: "center", color: "var(--text-tertiary)", fontSize: 14, lineHeight: 1.6 }}>
          <div style={{ fontSize: 26, marginBottom: 8 }}>🛒</div>
          List&apos;s empty. Add what you need — everyone in the family sees the same list.
        </div>
      ) : (
        <>
          {groups.map(({ c, rows }) => (
            <div key={c.id} style={{ ...card, padding: "6px 0", overflow: "hidden" }}>
              <div className="zt-eyebrow" style={{ padding: "10px 16px 6px" }}>{c.emoji} {c.label}</div>
              {rows.map((i) => (
                <Row key={i.id} item={i} busy={busy} run={run} />
              ))}
            </div>
          ))}

          {done.length ? (
            <div style={{ ...card, padding: "6px 0", overflow: "hidden", opacity: 0.75 }}>
              <div style={{ display: "flex", alignItems: "center", padding: "10px 16px 6px" }}>
                <span className="zt-eyebrow">In the cart · {done.length}</span>
                <span style={{ flex: 1 }} />
                <button onClick={() => run("clear", () => actions.clearBought())} disabled={busy === "clear"}
                  style={{ border: "1px solid var(--border-hairline)", background: "var(--surface-raised)", color: "var(--text-secondary)", borderRadius: 999, padding: "7px 14px", font: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer", minHeight: 36 }}>
                  Clear bought
                </button>
              </div>
              {done.map((i) => (
                <Row key={i.id} item={i} busy={busy} run={run} />
              ))}
            </div>
          ) : null}
        </>
      )}
    </>
  );
}

function Row({ item, busy, run }: { item: ShoppingItem; busy: number | string | null; run: (k: number | string, fn: () => Promise<unknown>) => Promise<void> }) {
  const b = busy === item.id;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 8px 4px 6px", opacity: b ? 0.5 : 1 }}>
      <button
        onClick={() => run(item.id, () => actions.setShoppingChecked(item.id, !item.checked))}
        disabled={b}
        aria-label={item.checked ? `Uncheck ${item.name}` : `Check off ${item.name}`}
        style={{ flex: "none", width: 48, height: 48, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer" }}
      >
        <span style={{
          width: 26, height: 26, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center",
          border: `2px solid ${item.checked ? "var(--accent)" : "var(--border-strong, var(--border-hairline))"}`,
          background: item.checked ? "var(--accent)" : "transparent",
          color: "var(--text-on-accent, #06130b)", fontSize: 14, fontWeight: 800,
        }}>
          {item.checked ? "✓" : ""}
        </span>
      </button>
      <button
        onClick={() => run(item.id, () => actions.setShoppingChecked(item.id, !item.checked))}
        disabled={b}
        style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", cursor: "pointer", font: "inherit", padding: "12px 0" }}
      >
        <span style={{ display: "block", fontSize: 15.5, fontWeight: 600, color: item.checked ? "var(--text-tertiary)" : "var(--text-primary)", textDecoration: item.checked ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.name}
        </span>
        {(item.note || item.source !== "manual") && (
          <span style={{ display: "block", fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
            {[item.note, item.source === "meal" ? "from meal plan" : item.source === "pantry" ? "running low" : null].filter(Boolean).join(" · ")}
          </span>
        )}
      </button>
      <button
        onClick={() => run(item.id, () => actions.deleteShoppingItem(item.id))}
        disabled={b}
        aria-label={`Remove ${item.name}`}
        style={{ flex: "none", width: 44, height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 16 }}
      >
        ×
      </button>
    </div>
  );
}

const LEVELS = [
  { id: "ok", label: "Stocked", color: "var(--accent)" },
  { id: "low", label: "Low", color: "var(--warning)" },
  { id: "out", label: "Out", color: "var(--negative)" },
] as const;

function Pantry({ pantry, busy, run }: { pantry: PantryItem[]; busy: number | string | null; run: (k: number | string, fn: () => Promise<unknown>) => Promise<void> }) {
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState("pantry");
  const [staple, setStaple] = React.useState(true);

  const add = () =>
    name.trim() &&
    run("addP", async () => {
      await actions.addPantryItem({ name, category, staple });
      setName("");
    });

  const needs = pantry.filter((p) => p.level !== "ok").sort((a, b) => (a.level === "out" ? -1 : 1) - (b.level === "out" ? -1 : 1));
  const stocked = pantry.filter((p) => p.level === "ok");

  const input: React.CSSProperties = {
    height: 48, padding: "0 14px", background: "var(--surface-sunken)", border: "1px solid var(--border-hairline)",
    borderRadius: "var(--radius-md, 12px)", color: "var(--text-primary)", fontSize: 15, outline: "none", minWidth: 0,
  };

  return (
    <>
      <div style={{ ...card, padding: 14 }}>
        <form onSubmit={(e) => { e.preventDefault(); add(); }} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Track something… (flour)" style={{ ...input, flex: 1 }} aria-label="Pantry item name" />
            <button type="submit" disabled={!name.trim() || busy === "addP"}
              style={{
                flex: "none", height: 48, padding: "0 22px", borderRadius: 999, border: "none", cursor: "pointer",
                background: "var(--accent)", color: "var(--text-on-accent, #06130b)", font: "inherit", fontSize: 14.5, fontWeight: 700,
                opacity: !name.trim() || busy === "addP" ? 0.55 : 1,
              }}>
              Add
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", flex: 1, paddingBottom: 2 }}>
              {CATEGORIES.map((c) => (
                <button key={c.id} type="button" onClick={() => setCategory(c.id)}
                  style={{
                    flex: "none", padding: "8px 12px", borderRadius: 999, border: "1px solid var(--border-hairline)",
                    background: category === c.id ? "var(--green-glow)" : "var(--surface-sunken)",
                    color: category === c.id ? "var(--accent)" : "var(--text-tertiary)",
                    font: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer", minHeight: 38,
                  }}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer", minHeight: 38 }}>
              <input type="checkbox" checked={staple} onChange={(e) => setStaple(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--accent)" }} />
              Staple
            </label>
          </div>
        </form>
      </div>

      {pantry.length === 0 ? (
        <div style={{ ...card, padding: 28, textAlign: "center", color: "var(--text-tertiary)", fontSize: 14, lineHeight: 1.6 }}>
          <div style={{ fontSize: 26, marginBottom: 8 }}>🥫</div>
          Track what you keep on hand. Tap an item&apos;s level when you notice it running low — staples that hit &quot;Out&quot; jump to the top.
        </div>
      ) : (
        <>
          {needs.length ? (
            <div style={{ ...card, padding: "6px 0", overflow: "hidden", borderColor: "var(--warning)" }}>
              <div className="zt-eyebrow" style={{ padding: "10px 16px 6px" }}>⚠️ Running low</div>
              {needs.map((p) => <PantryRow key={p.id} p={p} busy={busy} run={run} showSend />)}
            </div>
          ) : null}
          {stocked.length ? (
            <div style={{ ...card, padding: "6px 0", overflow: "hidden" }}>
              <div className="zt-eyebrow" style={{ padding: "10px 16px 6px" }}>Stocked</div>
              {stocked.map((p) => <PantryRow key={p.id} p={p} busy={busy} run={run} />)}
            </div>
          ) : null}
        </>
      )}
    </>
  );
}

function PantryRow({ p, busy, run, showSend }: { p: PantryItem; busy: number | string | null; run: (k: number | string, fn: () => Promise<unknown>) => Promise<void>; showSend?: boolean }) {
  const b = busy === p.id;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px 8px 16px", opacity: b ? 0.5 : 1, flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 140 }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {catOf(p.category).emoji} {p.name}{p.staple ? <span title="Staple" style={{ marginLeft: 6, fontSize: 11, color: "var(--text-tertiary)" }}>★ staple</span> : null}
        </span>
      </div>
      <div style={{ display: "inline-flex", gap: 4, padding: 3, background: "var(--surface-sunken)", borderRadius: 999, flex: "none" }}>
        {LEVELS.map((l) => (
          <button key={l.id} onClick={() => run(p.id, () => actions.setPantryLevel(p.id, l.id))} disabled={b}
            style={{
              padding: "7px 12px", borderRadius: 999, border: "none", cursor: "pointer", font: "inherit",
              fontSize: 12, fontWeight: 700, minHeight: 36,
              background: p.level === l.id ? "var(--surface-card)" : "transparent",
              color: p.level === l.id ? l.color : "var(--text-tertiary)",
            }}>
            {l.label}
          </button>
        ))}
      </div>
      {showSend ? (
        <button onClick={() => run(`send-${p.id}`, () => actions.sendPantryItemToList(p.id))} disabled={busy === `send-${p.id}`}
          style={{ flex: "none", border: "1px solid var(--green-tint)", background: "var(--green-glow)", color: "var(--accent)", borderRadius: 999, padding: "8px 14px", font: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer", minHeight: 38 }}>
          + List
        </button>
      ) : null}
      <button onClick={() => run(p.id, () => actions.deletePantryItem(p.id))} disabled={b} aria-label={`Remove ${p.name}`}
        style={{ flex: "none", width: 40, height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 16 }}>
        ×
      </button>
    </div>
  );
}
