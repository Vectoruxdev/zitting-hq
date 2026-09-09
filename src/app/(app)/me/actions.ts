"use server";
/**
 * Profile & settings actions. Every action acts on the SIGNED-IN member only
 * (memberId is never taken from the client). The owner edits other people in
 * People & Permissions (Phase 6).
 */
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseServerClient, isAuthConfigured } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { AVATARS_BUCKET, avatarUrl, getPerson, setMemberNotificationPref, upsertProfile, type ThemePref } from "@/db/profiles";

async function me() {
  if (!isAuthConfigured) return null; // local dev without auth: no member row to edit
  const u = await getCurrentUser();
  if (!u) throw new Error("Not authorized");
  if (!u.memberId) throw new Error("Your login isn't linked to a family member yet");
  return u;
}

const HUES = [1, 2, 3, 4, 5, 6];
const THEMES: ThemePref[] = ["light", "dark", "system"];

export async function updateMyProfile(patch: { greetingName?: string | null; hue?: number | null; birthday?: string | null }) {
  const u = await me();
  if (!u) return { ok: false as const, error: "Sign in to edit your profile" };
  const clean: Parameters<typeof upsertProfile>[1] = {};
  if (patch.greetingName !== undefined) clean.greetingName = patch.greetingName?.trim().slice(0, 40) || null;
  if (patch.hue !== undefined) clean.hue = patch.hue != null && HUES.includes(patch.hue) ? patch.hue : null;
  if (patch.birthday !== undefined) clean.birthday = patch.birthday && /^\d{4}-\d{2}-\d{2}$/.test(patch.birthday) ? patch.birthday : null;
  await upsertProfile(u.memberId!, clean);
  revalidatePath("/"); revalidatePath("/me");
  return { ok: true as const };
}

export async function setMyTheme(theme: ThemePref) {
  const u = await me();
  if (!THEMES.includes(theme)) return { ok: false as const, error: "Unknown theme" };
  const jar = await cookies();
  // The cookie lets the server render the right theme on first paint (layout.tsx).
  if (theme === "system") jar.delete("zhq-theme");
  else jar.set("zhq-theme", theme, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  if (u) await upsertProfile(u.memberId!, { theme });
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function setMyNotificationPref(event: string, patch: { inApp?: boolean; push?: boolean; email?: boolean }) {
  const u = await me();
  if (!u) return { ok: false as const, error: "Sign in first" };
  await setMemberNotificationPref(u.memberId!, event, patch);
  revalidatePath("/me");
  return { ok: true as const };
}

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export async function uploadMyAvatar(formData: FormData) {
  const u = await me();
  if (!u) return { ok: false as const, error: "Sign in first" };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false as const, error: "No image received" };
  if (!file.type.startsWith("image/")) return { ok: false as const, error: "Avatars must be images" };
  if (file.size > AVATAR_MAX_BYTES) return { ok: false as const, error: "Image is over the 5MB limit" };
  const admin = getAdminClient();
  if (!admin) return { ok: false as const, error: "Photo storage isn't configured on this server" };
  const path = `${u.memberId}/${crypto.randomUUID()}.jpg`;
  const { error } = await admin.storage.from(AVATARS_BUCKET).upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (error) return { ok: false as const, error: `Upload failed: ${error.message}` };
  const prev = (await getPerson(u.memberId))?.avatarPath ?? null;
  await upsertProfile(u.memberId!, { avatarPath: path });
  if (prev) await admin.storage.from(AVATARS_BUCKET).remove([prev]).catch(() => {});
  revalidatePath("/", "layout");
  return { ok: true as const, url: await avatarUrl(path) };
}

export async function removeMyAvatar() {
  const u = await me();
  if (!u) return { ok: false as const, error: "Sign in first" };
  const prev = (await getPerson(u.memberId))?.avatarPath ?? null;
  await upsertProfile(u.memberId!, { avatarPath: null });
  const admin = getAdminClient();
  if (prev && admin) await admin.storage.from(AVATARS_BUCKET).remove([prev]).catch(() => {});
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Change the signed-in person's own password (needs a live session). */
export async function changeMyPassword(password: string, confirm: string) {
  if (!isAuthConfigured) return { ok: false as const, error: "Sign-in isn't configured here." };
  const u = await getCurrentUser();
  if (!u) throw new Error("Not authorized");
  if (password.length < 8) return { ok: false as const, error: "Use at least 8 characters." };
  if (password !== confirm) return { ok: false as const, error: "The two passwords don't match." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
