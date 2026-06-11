"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import * as h from "@/db/household";

/** Shared family space: any signed-in family member may read/write. */
async function ensureFamily() {
  if (!isAuthConfigured) return null;
  const u = await getCurrentUser();
  if (!u) throw new Error("Not signed in");
  return u;
}

const refresh = () => {
  revalidatePath("/meals");
  revalidatePath("/groceries"); // send-to-list lands there
};

export async function saveRecipe(args: Parameters<typeof h.saveRecipe>[0]) {
  await ensureFamily();
  const res = await h.saveRecipe(args);
  refresh();
  return res;
}
export async function deleteRecipe(id: number) {
  await ensureFamily();
  const res = await h.deleteRecipe(id);
  refresh();
  return res;
}
export async function setMeal(args: Parameters<typeof h.setMeal>[0]) {
  await ensureFamily();
  const res = await h.setMeal(args);
  refresh();
  return res;
}
export async function sendRecipeToList(recipeId: number) {
  await ensureFamily();
  const res = await h.sendRecipeToList(recipeId);
  refresh();
  return res;
}
