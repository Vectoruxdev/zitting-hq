/**
 * Household hub data layer (Groceries / Meals / Calendar).
 *
 * Shared family spaces: every signed-in role may read and write (these are
 * the fridge list and the dinner plan, not bank data). Reads are SEQUENTIAL
 * (pooler-safe) and DEFENSIVE — a pre-migration DB degrades each module to
 * its empty state instead of erroring.
 */
import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import { db, isDbConfigured } from "./index";
import * as s from "./schema";

function requireDb() {
  if (!isDbConfigured || !db) throw new Error("Database isn't configured");
  return db!;
}

// ---- Groceries -------------------------------------------------------------

export const SHOPPING_CATEGORIES = ["produce", "dairy", "meat", "pantry", "frozen", "household", "other"] as const;

export async function getGroceriesData() {
  if (!isDbConfigured || !db) return { configured: false as const, items: [], pantry: [] };
  const items = await db
    .select()
    .from(s.shoppingItems)
    .where(isNull(s.shoppingItems.archivedAt))
    .orderBy(asc(s.shoppingItems.id))
    .catch(() => [] as (typeof s.shoppingItems.$inferSelect)[]);
  const pantry = await db
    .select()
    .from(s.pantryItems)
    .orderBy(asc(s.pantryItems.name))
    .catch(() => [] as (typeof s.pantryItems.$inferSelect)[]);
  return { configured: true as const, items, pantry };
}

export async function addShoppingItem(args: {
  name: string;
  note?: string | null;
  category?: string | null;
  addedBy?: string | null;
  source?: "manual" | "meal" | "pantry";
}) {
  const name = args.name.trim();
  if (!name) return { ok: false as const, error: "Name is required" };
  await requireDb().insert(s.shoppingItems).values({
    name,
    note: args.note?.trim() || null,
    category: args.category || "other",
    addedBy: args.addedBy ?? null,
    source: args.source ?? "manual",
  });
  return { ok: true as const };
}

export async function setShoppingChecked(id: number, checked: boolean) {
  await requireDb()
    .update(s.shoppingItems)
    .set({ checked, checkedAt: checked ? new Date() : null })
    .where(eq(s.shoppingItems.id, id));
  return { ok: true as const };
}

export async function deleteShoppingItem(id: number) {
  await requireDb().delete(s.shoppingItems).where(eq(s.shoppingItems.id, id));
  return { ok: true as const };
}

/** "Clear bought" — archive every checked, unarchived row. */
export async function archiveCheckedShoppingItems() {
  await requireDb()
    .update(s.shoppingItems)
    .set({ archivedAt: new Date() })
    .where(and(eq(s.shoppingItems.checked, true), isNull(s.shoppingItems.archivedAt)));
  return { ok: true as const };
}

export async function addPantryItem(args: { name: string; category?: string | null; staple?: boolean; level?: string }) {
  const name = args.name.trim();
  if (!name) return { ok: false as const, error: "Name is required" };
  await requireDb().insert(s.pantryItems).values({
    name,
    category: args.category || "other",
    staple: !!args.staple,
    level: args.level || "ok",
  });
  return { ok: true as const };
}

export async function setPantryLevel(id: number, level: "ok" | "low" | "out") {
  await requireDb().update(s.pantryItems).set({ level, updatedAt: new Date() }).where(eq(s.pantryItems.id, id));
  return { ok: true as const };
}

export async function setPantryStaple(id: number, staple: boolean) {
  await requireDb().update(s.pantryItems).set({ staple, updatedAt: new Date() }).where(eq(s.pantryItems.id, id));
  return { ok: true as const };
}

export async function deletePantryItem(id: number) {
  await requireDb().delete(s.pantryItems).where(eq(s.pantryItems.id, id));
  return { ok: true as const };
}

/** Low/out pantry item → shopping list (skips when an active row already matches by name). */
export async function sendPantryItemToList(id: number) {
  const database = requireDb();
  const [item] = await database.select().from(s.pantryItems).where(eq(s.pantryItems.id, id));
  if (!item) return { ok: false as const, error: "Item not found" };
  const dup = await database
    .select({ id: s.shoppingItems.id, name: s.shoppingItems.name })
    .from(s.shoppingItems)
    .where(isNull(s.shoppingItems.archivedAt));
  if (dup.some((r) => r.name.trim().toLowerCase() === item.name.trim().toLowerCase())) {
    return { ok: true as const, skipped: true as const };
  }
  await database.insert(s.shoppingItems).values({ name: item.name, category: item.category, source: "pantry" });
  return { ok: true as const };
}

// ---- Meals -----------------------------------------------------------------

export async function getMealsData(weekStartISO: string) {
  if (!isDbConfigured || !db) return { configured: false as const, recipes: [], plan: [] };
  const weekEnd = addDaysISO(weekStartISO, 6);
  const recipeRows = await db
    .select()
    .from(s.recipes)
    .orderBy(asc(s.recipes.name))
    .catch(() => [] as (typeof s.recipes.$inferSelect)[]);
  const planRows = await db
    .select()
    .from(s.mealPlan)
    .where(and(gte(s.mealPlan.date, weekStartISO), lte(s.mealPlan.date, weekEnd)))
    .catch(() => [] as (typeof s.mealPlan.$inferSelect)[]);
  return { configured: true as const, recipes: recipeRows, plan: planRows };
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function saveRecipe(args: {
  id?: number | null;
  name: string;
  emoji?: string | null;
  ingredients: { name: string; qty?: string }[];
  notes?: string | null;
}) {
  const database = requireDb();
  const name = args.name.trim();
  if (!name) return { ok: false as const, error: "Name is required" };
  const ingredients = (args.ingredients || []).map((i) => ({ name: i.name.trim(), qty: i.qty?.trim() || undefined })).filter((i) => i.name);
  if (args.id) {
    await database
      .update(s.recipes)
      .set({ name, emoji: args.emoji?.trim() || null, ingredients, notes: args.notes?.trim() || null })
      .where(eq(s.recipes.id, args.id));
    return { ok: true as const, id: args.id };
  }
  const [row] = await database
    .insert(s.recipes)
    .values({ name, emoji: args.emoji?.trim() || null, ingredients, notes: args.notes?.trim() || null })
    .returning({ id: s.recipes.id });
  return { ok: true as const, id: row.id };
}

export async function deleteRecipe(id: number) {
  await requireDb().delete(s.recipes).where(eq(s.recipes.id, id));
  return { ok: true as const };
}

/** Set (or clear, with recipeId+title null) a date+slot cell. Upsert on (date, slot). */
export async function setMeal(args: { date: string; slot?: string; recipeId?: number | null; title?: string | null; note?: string | null }) {
  const database = requireDb();
  const slot = args.slot || "dinner";
  const empty = args.recipeId == null && !(args.title && args.title.trim());
  const [existing] = await database
    .select({ id: s.mealPlan.id })
    .from(s.mealPlan)
    .where(and(eq(s.mealPlan.date, args.date), eq(s.mealPlan.slot, slot)));
  if (empty) {
    if (existing) await database.delete(s.mealPlan).where(eq(s.mealPlan.id, existing.id));
    return { ok: true as const };
  }
  const values = {
    recipeId: args.recipeId ?? null,
    title: args.title?.trim() || null,
    note: args.note?.trim() || null,
  };
  if (existing) await database.update(s.mealPlan).set(values).where(eq(s.mealPlan.id, existing.id));
  else await database.insert(s.mealPlan).values({ date: args.date, slot, ...values });
  return { ok: true as const };
}

/** A recipe's ingredients → the shopping list (deduped against active rows by name). */
export async function sendRecipeToList(recipeId: number) {
  const database = requireDb();
  const [recipe] = await database.select().from(s.recipes).where(eq(s.recipes.id, recipeId));
  if (!recipe) return { ok: false as const, error: "Recipe not found" };
  const active = await database
    .select({ name: s.shoppingItems.name })
    .from(s.shoppingItems)
    .where(isNull(s.shoppingItems.archivedAt));
  const have = new Set(active.map((r) => r.name.trim().toLowerCase()));
  const toAdd = (recipe.ingredients || []).filter((i) => i.name && !have.has(i.name.trim().toLowerCase()));
  if (toAdd.length) {
    await database.insert(s.shoppingItems).values(
      toAdd.map((i) => ({ name: i.name.trim(), note: i.qty || null, category: "other", source: "meal" as const }))
    );
  }
  return { ok: true as const, added: toAdd.length, skipped: (recipe.ingredients || []).length - toAdd.length };
}

// ---- Calendar ----------------------------------------------------------------

export async function getCalendarConfig() {
  if (!isDbConfigured || !db) return { configured: false as const, feeds: [], events: [] };
  const feeds = await db
    .select()
    .from(s.calendarFeeds)
    .orderBy(asc(s.calendarFeeds.id))
    .catch(() => [] as (typeof s.calendarFeeds.$inferSelect)[]);
  const events = await db
    .select()
    .from(s.familyEvents)
    .orderBy(asc(s.familyEvents.date))
    .catch(() => [] as (typeof s.familyEvents.$inferSelect)[]);
  return { configured: true as const, feeds, events };
}

export async function addCalendarFeed(args: { name: string; url: string; color?: string | null }) {
  const name = args.name.trim();
  const url = args.url.trim();
  if (!name || !url) return { ok: false as const, error: "Name and URL are required" };
  if (!/^https:\/\//i.test(url)) return { ok: false as const, error: "Feed URL must start with https://" };
  await requireDb().insert(s.calendarFeeds).values({ name, url, color: args.color || null });
  return { ok: true as const };
}

export async function setCalendarFeedEnabled(id: number, enabled: boolean) {
  await requireDb().update(s.calendarFeeds).set({ enabled }).where(eq(s.calendarFeeds.id, id));
  return { ok: true as const };
}

export async function deleteCalendarFeed(id: number) {
  await requireDb().delete(s.calendarFeeds).where(eq(s.calendarFeeds.id, id));
  return { ok: true as const };
}

export async function addFamilyEvent(args: {
  title: string;
  date: string;
  endDate?: string | null;
  time?: string | null;
  note?: string | null;
  createdBy?: string | null;
}) {
  const title = args.title.trim();
  if (!title || !args.date) return { ok: false as const, error: "Title and date are required" };
  await requireDb().insert(s.familyEvents).values({
    title,
    date: args.date,
    endDate: args.endDate || null,
    time: args.time?.trim() || null,
    note: args.note?.trim() || null,
    createdBy: args.createdBy ?? null,
  });
  return { ok: true as const };
}

export async function deleteFamilyEvent(id: number) {
  await requireDb().delete(s.familyEvents).where(eq(s.familyEvents.id, id));
  return { ok: true as const };
}
