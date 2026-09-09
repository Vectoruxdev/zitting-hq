"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import type { NestRuleAction } from "@/db/schema";
import * as n from "@/db/nest";

/** Cameras + lights are owner-only — this controls the house. */
async function ensureOwner() {
  if (!isAuthConfigured) return null; // local dev / no auth → allow
  const u = await getCurrentUser();
  if (!u || u.role !== "owner") throw new Error("Not authorized");
  return u;
}

const refresh = () => revalidatePath("/nest");

const result = async (fn: () => Promise<unknown>) => {
  try {
    const data = await fn();
    refresh();
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
  }
};

export async function syncNestDevices() {
  await ensureOwner();
  return result(() => n.syncNestDevices());
}

export async function syncGoveeDevices() {
  await ensureOwner();
  return result(() => n.syncGoveeDevices());
}

export async function createRule(args: {
  nestDeviceId: string;
  eventType: string;
  goveeDevice: string;
  action: NestRuleAction;
  activeStart?: string | null;
  activeEnd?: string | null;
  cooldownSeconds?: number;
}) {
  await ensureOwner();
  return result(() => n.createNestRule(args));
}

export async function setRuleEnabled(id: number, enabled: boolean) {
  await ensureOwner();
  return result(() => n.setNestRuleEnabled(id, enabled));
}

export async function deleteRule(id: number) {
  await ensureOwner();
  return result(() => n.deleteNestRule(id));
}

export async function testRule(id: number) {
  await ensureOwner();
  return result(() => n.testNestRule(id));
}

export async function disconnect() {
  await ensureOwner();
  return result(() => n.disconnectNest());
}
