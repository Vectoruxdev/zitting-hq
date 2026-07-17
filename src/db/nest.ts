/**
 * Nest module data layer + rules engine.
 *
 * Owner-only module (enforced in actions/routes, not here). Reads are
 * DEFENSIVE like household.ts — a pre-migration DB degrades to "not set up"
 * instead of erroring. The engine runs inside the Pub/Sub webhook, so every
 * external call is best-effort and the handler always acks.
 */
import { and, desc, eq } from "drizzle-orm";
import { db, isDbConfigured } from "./index";
import * as s from "./schema";
import type { NestRuleAction } from "./schema";
import {
  isNestConfigured,
  refreshAccessToken,
  sdmListDevices,
  sdmDeviceId,
  inActiveWindow,
  type ParsedNestEvent,
} from "@/lib/nest";
import { isGoveeConfigured, goveeListDevices, executeGoveeAction } from "@/lib/govee";

function requireDb() {
  if (!isDbConfigured || !db) throw new Error("Database isn't configured");
  return db!;
}

// ---- Tokens ---------------------------------------------------------------

export async function saveNestTokens(args: {
  refreshToken: string;
  accessToken: string;
  expiresInSeconds: number;
  scope?: string | null;
  connectedBy?: string | null;
}) {
  const expiresAt = new Date(Date.now() + args.expiresInSeconds * 1000);
  await requireDb()
    .insert(s.nestTokens)
    .values({
      id: "household",
      refreshToken: args.refreshToken,
      accessToken: args.accessToken,
      accessTokenExpiresAt: expiresAt,
      scope: args.scope ?? null,
      connectedBy: args.connectedBy ?? null,
    })
    .onConflictDoUpdate({
      target: s.nestTokens.id,
      set: {
        refreshToken: args.refreshToken,
        accessToken: args.accessToken,
        accessTokenExpiresAt: expiresAt,
        scope: args.scope ?? null,
        connectedBy: args.connectedBy ?? null,
        updatedAt: new Date(),
      },
    });
}

export async function disconnectNest() {
  const d = requireDb();
  const [row] = await d.select().from(s.nestTokens).limit(1).catch(() => []);
  // Best-effort revoke so the grant disappears from the Google account too.
  if (row?.refreshToken) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(row.refreshToken)}`, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
    }).catch(() => {});
  }
  await d.delete(s.nestTokens);
}

/** Valid access token, refreshing (and persisting) when within 60s of expiry. */
export async function getNestAccessToken(): Promise<string> {
  const d = requireDb();
  const [row] = await d.select().from(s.nestTokens).limit(1);
  if (!row) throw new Error("Nest isn't connected yet");
  const fresh =
    row.accessToken &&
    row.accessTokenExpiresAt &&
    row.accessTokenExpiresAt.getTime() - Date.now() > 60_000;
  if (fresh) return row.accessToken!;
  const t = await refreshAccessToken(row.refreshToken);
  await d
    .update(s.nestTokens)
    .set({
      accessToken: t.access_token,
      accessTokenExpiresAt: new Date(Date.now() + t.expires_in * 1000),
      // Google only re-issues refresh_token sometimes; keep the old one otherwise.
      ...(t.refresh_token ? { refreshToken: t.refresh_token } : {}),
      updatedAt: new Date(),
    })
    .where(eq(s.nestTokens.id, row.id));
  return t.access_token;
}

// ---- Device sync ----------------------------------------------------------

export async function syncNestDevices(): Promise<{ count: number }> {
  const d = requireDb();
  const token = await getNestAccessToken();
  const devices = await sdmListDevices(token);
  for (const dev of devices) {
    const traits = (dev.traits ?? {}) as Record<string, { customName?: string }>;
    const room = dev.parentRelations?.[0]?.displayName ?? null;
    const displayName = traits["sdm.devices.traits.Info"]?.customName || room || "Camera";
    await d
      .insert(s.nestDevices)
      .values({
        id: sdmDeviceId(dev.name),
        sdmName: dev.name,
        type: dev.type ?? null,
        displayName,
        room,
        traits: dev.traits ?? null,
      })
      .onConflictDoUpdate({
        target: s.nestDevices.id,
        set: { sdmName: dev.name, type: dev.type ?? null, displayName, room, traits: dev.traits ?? null },
      });
  }
  return { count: devices.length };
}

export async function syncGoveeDevices(): Promise<{ count: number }> {
  const d = requireDb();
  const devices = await goveeListDevices();
  for (const dev of devices) {
    await d
      .insert(s.goveeDevices)
      .values({
        device: dev.device,
        model: dev.model,
        name: dev.deviceName,
        controllable: dev.controllable ?? true,
        supportsColor: (dev.supportCmds ?? []).includes("color"),
        raw: dev,
      })
      .onConflictDoUpdate({
        target: s.goveeDevices.device,
        set: {
          model: dev.model,
          name: dev.deviceName,
          controllable: dev.controllable ?? true,
          supportsColor: (dev.supportCmds ?? []).includes("color"),
          raw: dev,
        },
      });
  }
  return { count: devices.length };
}

// ---- Rules CRUD -----------------------------------------------------------

export async function createNestRule(args: {
  nestDeviceId: string;
  eventType: string;
  goveeDevice: string;
  action: NestRuleAction;
  activeStart?: string | null;
  activeEnd?: string | null;
  cooldownSeconds?: number;
}) {
  await requireDb().insert(s.nestRules).values({
    nestDeviceId: args.nestDeviceId,
    eventType: args.eventType,
    goveeDevice: args.goveeDevice,
    action: args.action,
    activeStart: args.activeStart || null,
    activeEnd: args.activeEnd || null,
    cooldownSeconds: args.cooldownSeconds ?? 120,
  });
}

export async function setNestRuleEnabled(id: number, enabled: boolean) {
  await requireDb().update(s.nestRules).set({ enabled }).where(eq(s.nestRules.id, id));
}

export async function deleteNestRule(id: number) {
  await requireDb().delete(s.nestRules).where(eq(s.nestRules.id, id));
}

/** Fire a rule's action right now (the "Test" button). */
export async function testNestRule(id: number) {
  const d = requireDb();
  const [rule] = await d.select().from(s.nestRules).where(eq(s.nestRules.id, id));
  if (!rule) throw new Error("Rule not found");
  const [light] = await d.select().from(s.goveeDevices).where(eq(s.goveeDevices.device, rule.goveeDevice));
  if (!light) throw new Error("Govee device not found — sync lights first");
  await executeGoveeAction({ device: light.device, model: light.model }, rule.action);
}

// ---- Page data ------------------------------------------------------------

export async function getNestData() {
  const empty = {
    configured: false as const,
    nestConfigured: isNestConfigured,
    goveeConfigured: isGoveeConfigured,
    connected: false,
    connectedBy: null as string | null,
    devices: [] as (typeof s.nestDevices.$inferSelect)[],
    goveeDevices: [] as (typeof s.goveeDevices.$inferSelect)[],
    rules: [] as (typeof s.nestRules.$inferSelect)[],
    events: [] as (typeof s.nestEvents.$inferSelect)[],
  };
  if (!isDbConfigured || !db) return empty;

  // Sequential + defensive (pooler-safe; pre-migration DB → "not set up").
  const tokens = await db.select().from(s.nestTokens).limit(1).catch(() => null);
  if (tokens === null) return empty; // tables missing
  const devices = await db.select().from(s.nestDevices).orderBy(s.nestDevices.displayName).catch(() => []);
  const govee = await db.select().from(s.goveeDevices).orderBy(s.goveeDevices.name).catch(() => []);
  const rules = await db.select().from(s.nestRules).orderBy(s.nestRules.id).catch(() => []);
  const events = await db
    .select()
    .from(s.nestEvents)
    .orderBy(desc(s.nestEvents.id))
    .limit(50)
    .catch(() => []);

  return {
    ...empty,
    configured: true as const,
    connected: tokens.length > 0,
    connectedBy: tokens[0]?.connectedBy ?? null,
    devices,
    goveeDevices: govee,
    rules,
    events,
  };
}

// ---- Rules engine (runs in the Pub/Sub webhook) ---------------------------

export interface HandledEvent {
  eventType: string;
  status: string;
  ruleId: number | null;
}

/**
 * Process one parsed Pub/Sub message: dedupe, log, match rules, fire lights.
 * Dedupe happens BEFORE any light fires — the event-log insert doubles as the
 * at-least-once-delivery lock (unique event_id, conflict → someone already
 * handled it).
 */
export async function handleNestEvent(parsed: ParsedNestEvent): Promise<HandledEvent[]> {
  const d = requireDb();
  const results: HandledEvent[] = [];

  const [device] = parsed.deviceSdmName
    ? await d.select().from(s.nestDevices).where(eq(s.nestDevices.sdmName, parsed.deviceSdmName))
    : [];
  if (device) {
    await d
      .update(s.nestDevices)
      .set({ lastEventAt: new Date() })
      .where(eq(s.nestDevices.id, device.id))
      .catch(() => {});
  }

  const eventAt = parsed.timestamp ? new Date(parsed.timestamp) : new Date();
  const media = parsed.previewUrl ? { previewUrl: parsed.previewUrl } : null;

  // A clip-preview-only message: log it against the thread for phase 2, no rules.
  const types = parsed.types.length > 0 ? parsed.types : ["clip"];

  for (const eventType of types) {
    const inserted = await d
      .insert(s.nestEvents)
      .values({
        eventId: `${parsed.eventId}:${eventType}`,
        nestDeviceId: device?.id ?? null,
        eventType,
        eventAt,
        media,
        raw: parsed.raw,
      })
      .onConflictDoNothing({ target: s.nestEvents.eventId })
      .returning({ id: s.nestEvents.id });
    if (inserted.length === 0) continue; // Pub/Sub redelivery — already handled
    const logId = inserted[0].id;

    if (eventType === "clip" || !device) {
      results.push({ eventType, status: "none", ruleId: null });
      continue;
    }
    if (!device.enabled) {
      await d.update(s.nestEvents).set({ actionStatus: "disabled" }).where(eq(s.nestEvents.id, logId));
      results.push({ eventType, status: "disabled", ruleId: null });
      continue;
    }

    const rules = await d
      .select()
      .from(s.nestRules)
      .where(and(eq(s.nestRules.nestDeviceId, device.id), eq(s.nestRules.enabled, true)));
    const matching = rules.filter((r) => r.eventType === eventType || r.eventType === "any");

    let status = "no_rule";
    let firedRuleId: number | null = null;
    let error: string | null = null;

    for (const rule of matching) {
      if (!inActiveWindow(rule.activeStart, rule.activeEnd)) {
        if (status === "no_rule") status = "quiet_hours";
        continue;
      }
      const cooledDown =
        !rule.lastFiredAt ||
        Date.now() - rule.lastFiredAt.getTime() >= rule.cooldownSeconds * 1000;
      if (!cooledDown) {
        if (status === "no_rule") status = "cooldown";
        continue;
      }
      const [light] = await d
        .select()
        .from(s.goveeDevices)
        .where(eq(s.goveeDevices.device, rule.goveeDevice));
      if (!light) {
        status = "error";
        error = `Govee device ${rule.goveeDevice} not in DB`;
        continue;
      }
      try {
        await executeGoveeAction({ device: light.device, model: light.model }, rule.action);
        await d.update(s.nestRules).set({ lastFiredAt: new Date() }).where(eq(s.nestRules.id, rule.id));
        status = "fired";
        firedRuleId = rule.id;
      } catch (e) {
        status = "error";
        error = e instanceof Error ? e.message : String(e);
      }
    }

    await d
      .update(s.nestEvents)
      .set({ actionStatus: status, ruleId: firedRuleId, actionError: error })
      .where(eq(s.nestEvents.id, logId));
    results.push({ eventType, status, ruleId: firedRuleId });
  }

  return results;
}
