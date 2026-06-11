"use client";

/**
 * Meals — the week's dinners + the family recipe box. Pick a recipe for a
 * night and its ingredients can be sent to the shopping list in one tap.
 */
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as actions from "./actions";

export interface Recipe {
  id: number;
  name: string;
  emoji: string | null;
  ingredients: { name: string; qty?: string }[];
  notes: string | null;
}
export interface PlanCell {
  id: number;
  date: string;
  slot: string;
  recipeId: number | null;
  title: string | null;
}

const card: React.CSSProperties = {
  background: "var(--surface-card)",
  border: "1px solid var(--border-hairline)",
  borderRadius: "var(--radius-lg, 18px)",
};
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function addDays(iso: string, d: number): string {
  const x = new Date(iso + "T00:00:00");
  x.setDate(x.getDate() + d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
function labelOf(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function MealsClient({
  configured, weekStart, prevWeek, nextWeek, todayISO, recipes, plan,
}: {
  configured: boolean;
  weekStart: string;
  prevWeek: string;
  nextWeek: string;
  todayISO: string;
  recipes: Recipe[];
  plan: PlanCell[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [picking, setPicking] = React.useState<string | null>(null); // date being assigned
  const [editing, setEditing] = React.useState<Recipe | null | "new">(null);
  const [toast, setToast] = React.useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const cellFor = (date: string) => plan.find((m) => m.date === date && m.slot === "dinner") || null;

  const sendToList = (r: Recipe) =>
    run(`send-${r.id}`, async () => {
      const res = await actions.sendRecipeToList(r.id);
      if (res && "added" in res) {
        setToast(res.added ? `${res.added} ingredient${res.added === 1 ? "" : "s"} added to the shopping list${res.skipped ? ` (${res.skipped} already on it)` : ""}` : "Everything's already on the list");
        setTimeout(() => setToast(null), 4000);
      }
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <p className="zt-eyebrow" style={{ marginBottom: 6 }}>Meals</p>
        <h1 style={{ margin: 0, fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 600, letterSpacing: "-0.015em", color: "var(--text-primary)" }}>
          What&apos;s for dinner
        </h1>
      </div>

      {!configured ? (
        <div style={{ ...card, padding: 22, fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)" }}>
          The meals tables aren&apos;t set up yet — run <code style={{ color: "var(--accent)" }}>supabase-meals.sql</code> in the Supabase SQL Editor, then reload.
        </div>
      ) : null}

      {toast ? (
        <div style={{ ...card, padding: "12px 16px", borderColor: "var(--green-tint)", fontSize: 13.5, color: "var(--text-primary)" }}>
          ✓ {toast} · <Link href="/groceries" style={{ color: "var(--accent)", fontWeight: 600 }}>Open list</Link>
        </div>
      ) : null}

      {/* week switcher */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link href={`/meals?week=${prevWeek}`} aria-label="Previous week" style={{ ...card, width: 44, height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: 18 }}>‹</Link>
        <div style={{ flex: 1, textAlign: "center", fontSize: 14.5, fontWeight: 600, color: "var(--text-primary)" }}>
          {labelOf(weekStart)} – {labelOf(addDays(weekStart, 6))}
        </div>
        <Link href={`/meals?week=${nextWeek}`} aria-label="Next week" style={{ ...card, width: 44, height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: 18 }}>›</Link>
      </div>

      {/* the week */}
      <div style={{ ...card, padding: "4px 0", overflow: "hidden" }}>
        {days.map((date, i) => {
          const cell = cellFor(date);
          const recipe = cell?.recipeId ? recipeById.get(cell.recipeId) : null;
          const isToday = date === todayISO;
          const label = recipe ? `${recipe.emoji ? recipe.emoji + " " : ""}${recipe.name}` : cell?.title || null;
          return (
            <div key={date} style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 14px", borderTop: i ? "1px solid var(--border-hairline)" : "none", background: isToday ? "var(--surface-sunken)" : "transparent" }}>
              <div style={{ flex: "none", width: 52, padding: "12px 0" }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: isToday ? "var(--accent)" : "var(--text-secondary)" }}>{DAY_NAMES[i]}</div>
                <div className="zt-num" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{labelOf(date)}</div>
              </div>
              <button
                onClick={() => setPicking(date)}
                disabled={busy === date}
                style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", cursor: "pointer", font: "inherit", padding: "14px 0", minHeight: 52 }}
              >
                {label ? (
                  <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{label}</span>
                ) : (
                  <span style={{ fontSize: 14, color: "var(--text-tertiary)" }}>+ Plan dinner</span>
                )}
              </button>
              {recipe ? (
                <button onClick={() => sendToList(recipe)} disabled={busy === `send-${recipe.id}`} title="Send ingredients to the shopping list"
                  style={{ flex: "none", border: "1px solid var(--green-tint)", background: "var(--green-glow)", color: "var(--accent)", borderRadius: 999, padding: "8px 13px", font: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer", minHeight: 38 }}>
                  🛒 List
                </button>
              ) : null}
              {label ? (
                <button onClick={() => run(date, () => actions.setMeal({ date, recipeId: null, title: null }))} disabled={busy === date} aria-label="Clear this dinner"
                  style={{ flex: "none", width: 40, height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 16 }}>
                  ×
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* recipe box */}
      <div style={{ display: "flex", alignItems: "center", marginTop: 6 }}>
        <p className="zt-eyebrow" style={{ margin: 0 }}>Recipe box · {recipes.length}</p>
        <span style={{ flex: 1 }} />
        <button onClick={() => setEditing("new")}
          style={{ border: "1px solid var(--border-hairline)", background: "var(--surface-raised)", color: "var(--text-secondary)", borderRadius: 999, padding: "9px 16px", font: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", minHeight: 40 }}>
          + New recipe
        </button>
      </div>
      {recipes.length === 0 ? (
        <div style={{ ...card, padding: 26, textAlign: "center", color: "var(--text-tertiary)", fontSize: 14, lineHeight: 1.6 }}>
          <div style={{ fontSize: 26, marginBottom: 8 }}>🍽️</div>
          Save the family favorites with their ingredients — planning a night becomes one tap, and the shopping list fills itself.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 12 }}>
          {recipes.map((r) => (
            <div key={r.id} style={{ ...card, padding: 16, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.emoji ? `${r.emoji} ` : ""}{r.name}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", flex: 1 }}>
                {r.ingredients.length ? `${r.ingredients.length} ingredient${r.ingredients.length === 1 ? "" : "s"}` : "No ingredients listed"}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setEditing(r)}
                  style={{ flex: 1, border: "1px solid var(--border-hairline)", background: "var(--surface-sunken)", color: "var(--text-secondary)", borderRadius: 999, padding: "8px 0", font: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer", minHeight: 38 }}>
                  Edit
                </button>
                <button onClick={() => sendToList(r)} disabled={busy === `send-${r.id}` || !r.ingredients.length}
                  style={{ flex: 1, border: "1px solid var(--green-tint)", background: "var(--green-glow)", color: "var(--accent)", borderRadius: 999, padding: "8px 0", font: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer", minHeight: 38, opacity: r.ingredients.length ? 1 : 0.5 }}>
                  🛒 List
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {picking ? (
        <DinnerPicker
          date={picking}
          recipes={recipes}
          onClose={() => setPicking(null)}
          onPick={(args) => { const d = picking; setPicking(null); run(d, () => actions.setMeal({ date: d, ...args })); }}
        />
      ) : null}
      {editing ? (
        <RecipeEditor
          recipe={editing === "new" ? null : editing}
          busy={busy === "recipe"}
          onClose={() => setEditing(null)}
          onSave={(args) => run("recipe", async () => { await actions.saveRecipe(args); setEditing(null); })}
          onDelete={editing !== "new" ? () => run("recipe", async () => { await actions.deleteRecipe((editing as Recipe).id); setEditing(null); }) : undefined}
        />
      ) : null}
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 520, maxHeight: "85dvh", overflowY: "auto",
        background: "var(--bg-app)", borderRadius: "var(--radius-lg, 18px) var(--radius-lg, 18px) 0 0",
        border: "1px solid var(--border-hairline)", padding: "18px 18px calc(18px + env(safe-area-inset-bottom))",
      }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>{title}</h2>
          <span style={{ flex: 1 }} />
          <button onClick={onClose} aria-label="Close" style={{ width: 40, height: 40, background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 18 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DinnerPicker({ date, recipes, onClose, onPick }: {
  date: string;
  recipes: Recipe[];
  onClose: () => void;
  onPick: (args: { recipeId?: number | null; title?: string | null }) => void;
}) {
  const [text, setText] = React.useState("");
  return (
    <Sheet title={`Dinner · ${labelOf(date)}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) onPick({ title: text }); }} style={{ display: "flex", gap: 8 }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type anything… (Pizza night)" autoFocus
            style={{ flex: 1, height: 48, padding: "0 14px", background: "var(--surface-sunken)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md, 12px)", color: "var(--text-primary)", fontSize: 15, outline: "none", minWidth: 0 }} />
          <button type="submit" disabled={!text.trim()}
            style={{ flex: "none", height: 48, padding: "0 18px", borderRadius: 999, border: "none", cursor: "pointer", background: "var(--accent)", color: "var(--text-on-accent, #06130b)", font: "inherit", fontSize: 14, fontWeight: 700, opacity: text.trim() ? 1 : 0.55 }}>
            Set
          </button>
        </form>
        {recipes.length ? <p className="zt-eyebrow" style={{ margin: "8px 0 0" }}>Or pick a recipe</p> : null}
        {recipes.map((r) => (
          <button key={r.id} onClick={() => onPick({ recipeId: r.id })}
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md, 12px)", padding: "13px 14px", font: "inherit", cursor: "pointer", minHeight: 50 }}>
            <span style={{ fontSize: 18, flex: "none" }}>{r.emoji || "🍽️"}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
            <span style={{ fontSize: 11.5, color: "var(--text-tertiary)", flex: "none" }}>{r.ingredients.length ? `${r.ingredients.length} ing.` : ""}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function RecipeEditor({ recipe, busy, onClose, onSave, onDelete }: {
  recipe: Recipe | null;
  busy: boolean;
  onClose: () => void;
  onSave: (args: { id?: number | null; name: string; emoji?: string | null; ingredients: { name: string; qty?: string }[]; notes?: string | null }) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = React.useState(recipe?.name || "");
  const [emoji, setEmoji] = React.useState(recipe?.emoji || "");
  const [notes, setNotes] = React.useState(recipe?.notes || "");
  const [ing, setIng] = React.useState<{ name: string; qty?: string }[]>(recipe?.ingredients?.length ? recipe.ingredients : [{ name: "" }]);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const setRow = (i: number, patch: Partial<{ name: string; qty: string }>) =>
    setIng((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const input: React.CSSProperties = {
    height: 46, padding: "0 13px", background: "var(--surface-sunken)", border: "1px solid var(--border-hairline)",
    borderRadius: "var(--radius-md, 12px)", color: "var(--text-primary)", fontSize: 14.5, outline: "none", minWidth: 0, width: "100%",
  };

  return (
    <Sheet title={recipe ? "Edit recipe" : "New recipe"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🍝" aria-label="Emoji" style={{ ...input, width: 64, flex: "none", textAlign: "center" }} />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Recipe name" aria-label="Recipe name" style={{ ...input, flex: 1 }} />
        </div>
        <p className="zt-eyebrow" style={{ margin: "4px 0 0" }}>Ingredients</p>
        {ing.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 8 }}>
            <input value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} placeholder="Ingredient" aria-label={`Ingredient ${i + 1}`} style={{ ...input, flex: 2 }} />
            <input value={r.qty || ""} onChange={(e) => setRow(i, { qty: e.target.value })} placeholder="Qty" aria-label={`Quantity ${i + 1}`} style={{ ...input, flex: 1, maxWidth: 110 }} />
            <button onClick={() => setIng((rows) => rows.filter((_, j) => j !== i))} aria-label="Remove ingredient"
              style={{ flex: "none", width: 42, background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 16 }}>×</button>
          </div>
        ))}
        <button onClick={() => setIng((rows) => [...rows, { name: "" }])}
          style={{ alignSelf: "flex-start", border: "1px solid var(--border-hairline)", background: "var(--surface-sunken)", color: "var(--text-secondary)", borderRadius: 999, padding: "8px 14px", font: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer", minHeight: 38 }}>
          + Ingredient
        </button>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (oven temp, the trick that makes it work…)" rows={3}
          style={{ ...input, height: "auto", padding: "11px 13px", resize: "vertical", fontFamily: "inherit" }} />
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          {onDelete ? (
            confirmDelete ? (
              <button onClick={onDelete} disabled={busy}
                style={{ border: "1px solid var(--negative)", background: "transparent", color: "var(--negative)", borderRadius: 999, padding: "11px 16px", font: "inherit", fontSize: 13.5, fontWeight: 700, cursor: "pointer", minHeight: 46 }}>
                Really delete
              </button>
            ) : (
              <button onClick={() => setConfirmDelete(true)} disabled={busy}
                style={{ border: "none", background: "none", color: "var(--text-tertiary)", font: "inherit", fontSize: 13.5, cursor: "pointer", minHeight: 46 }}>
                Delete
              </button>
            )
          ) : null}
          <span style={{ flex: 1 }} />
          <button onClick={onClose} disabled={busy}
            style={{ border: "1px solid var(--border-hairline)", background: "var(--surface-raised)", color: "var(--text-secondary)", borderRadius: 999, padding: "11px 18px", font: "inherit", fontSize: 13.5, fontWeight: 600, cursor: "pointer", minHeight: 46 }}>
            Cancel
          </button>
          <button onClick={() => onSave({ id: recipe?.id ?? null, name, emoji: emoji || null, ingredients: ing, notes: notes || null })} disabled={busy || !name.trim()}
            style={{ border: "none", background: "var(--accent)", color: "var(--text-on-accent, #06130b)", borderRadius: 999, padding: "11px 22px", font: "inherit", fontSize: 13.5, fontWeight: 700, cursor: "pointer", minHeight: 46, opacity: busy || !name.trim() ? 0.55 : 1 }}>
            Save recipe
          </button>
        </div>
      </div>
    </Sheet>
  );
}
