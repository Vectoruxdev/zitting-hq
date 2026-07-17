/**
 * Govee light control (cloud API v1). Key from the Govee Home app
 * (Profile → Settings → Apply for API Key) in GOVEE_API_KEY.
 *
 * Rate limit reality: ~10 requests/min per device. A "flash" isn't an API
 * primitive — it's a sequence of brightness writes, so one flash action costs
 * several requests. Rules carry a cooldownSeconds precisely so back-to-back
 * camera events can't rapid-fire us past the limit.
 */

const API_KEY = process.env.GOVEE_API_KEY || "";
const BASE = process.env.GOVEE_API_BASE || "https://developer-api.govee.com";

export const isGoveeConfigured = Boolean(API_KEY);

const FETCH_TIMEOUT = 15_000;

export interface GoveeDeviceInfo {
  device: string;
  model: string;
  deviceName: string;
  controllable: boolean;
  retrievable: boolean;
  supportCmds: string[];
}

type GoveeCmd =
  | { name: "turn"; value: "on" | "off" }
  | { name: "brightness"; value: number }
  | { name: "color"; value: { r: number; g: number; b: number } };

async function goveeFetch(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Govee-API-Key": API_KEY,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`Govee ${path} ${res.status}: ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export async function goveeListDevices(): Promise<GoveeDeviceInfo[]> {
  const json = (await goveeFetch("/v1/devices")) as {
    data?: { devices?: GoveeDeviceInfo[] };
  };
  return json.data?.devices ?? [];
}

async function goveeControl(device: string, model: string, cmd: GoveeCmd): Promise<void> {
  await goveeFetch("/v1/devices/control", {
    method: "PUT",
    body: JSON.stringify({ device, model, cmd }),
  });
}

/** Best-effort current state (power/brightness/color) for restore-after-flash. */
async function goveeGetState(
  device: string,
  model: string
): Promise<{ powerState?: string; brightness?: number; color?: { r: number; g: number; b: number } }> {
  try {
    const json = (await goveeFetch(
      `/v1/devices/state?device=${encodeURIComponent(device)}&model=${encodeURIComponent(model)}`
    )) as { data?: { properties?: Record<string, unknown>[] } };
    const out: { powerState?: string; brightness?: number; color?: { r: number; g: number; b: number } } = {};
    for (const p of json.data?.properties ?? []) {
      if ("powerState" in p) out.powerState = p.powerState as string;
      if ("brightness" in p) out.brightness = p.brightness as number;
      if ("color" in p) out.color = p.color as { r: number; g: number; b: number };
    }
    return out;
  } catch {
    return {};
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

import type { NestRuleAction } from "@/db/schema";

/**
 * Execute a rule action against one light. Runs inside the webhook handler,
 * so total wall time stays well under the route's maxDuration.
 */
export async function executeGoveeAction(
  target: { device: string; model: string },
  action: NestRuleAction
): Promise<void> {
  const { device, model } = target;
  const color = action.color ?? { r: 255, g: 80, b: 0 };
  const brightness = Math.min(100, Math.max(1, action.brightness ?? 100));

  if (action.kind === "off") {
    await goveeControl(device, model, { name: "turn", value: "off" });
    return;
  }

  if (action.kind === "color") {
    await goveeControl(device, model, { name: "turn", value: "on" });
    await goveeControl(device, model, { name: "color", value: color });
    await goveeControl(device, model, { name: "brightness", value: brightness });
    return;
  }

  // flash: capture state → alternate bright/dim on the rule color → restore.
  const prev = await goveeGetState(device, model);
  const flashes = Math.min(5, Math.max(1, action.flashes ?? 3));
  await goveeControl(device, model, { name: "turn", value: "on" });
  await goveeControl(device, model, { name: "color", value: color });
  for (let i = 0; i < flashes; i++) {
    await goveeControl(device, model, { name: "brightness", value: brightness });
    await sleep(400);
    await goveeControl(device, model, { name: "brightness", value: 1 });
    await sleep(400);
  }
  // Restore what we found (default: back off if it was off).
  if (prev.powerState === "on") {
    if (prev.color) await goveeControl(device, model, { name: "color", value: prev.color });
    await goveeControl(device, model, { name: "brightness", value: prev.brightness ?? 100 });
  } else {
    await goveeControl(device, model, { name: "turn", value: "off" });
  }
}
