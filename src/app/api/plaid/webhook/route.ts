import { NextResponse } from "next/server";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq } from "drizzle-orm";
import { syncItem } from "@/db/plaid";

export const dynamic = "force-dynamic";

/**
 * Plaid transactions webhook. Plaid pings this when new transactions are
 * available; we trigger an incremental sync for that item. We only act on
 * item_ids that exist in our DB (a spoofed call for an unknown item is a
 * no-op), and we always 200 quickly so Plaid doesn't retry-storm.
 *
 * NOTE: full JWT signature verification (Plaid-Verification header) is a
 * future hardening — the webhook only triggers a read-only sync, so the blast
 * radius of a spoofed call is at worst an extra sync of one of our own items.
 */
export async function POST(req: Request) {
  let body: { webhook_type?: string; webhook_code?: string; item_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { webhook_type, webhook_code, item_id } = body;
  if (webhook_type !== "TRANSACTIONS" || !item_id || !db) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Only sync codes that mean "new data is ready".
  const actionable = ["SYNC_UPDATES_AVAILABLE", "INITIAL_UPDATE", "HISTORICAL_UPDATE", "DEFAULT_UPDATE"];
  if (!actionable.includes(webhook_code || "")) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    // Confirm the item is one of ours before doing any work. (Inside the try so
    // a transient DB error acks 200 instead of 500-ing into a Plaid retry storm.)
    const [item] = await db.select({ id: s.plaidItems.id }).from(s.plaidItems).where(eq(s.plaidItems.itemId, item_id));
    if (!item) return NextResponse.json({ ok: true, unknown: true });
    const res = await syncItem(item_id);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    // Don't 500 — Plaid would retry. Log and ack.
    console.error("[plaid webhook] sync failed", e);
    return NextResponse.json({ ok: true, error: true });
  }
}
