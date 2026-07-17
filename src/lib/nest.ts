/**
 * Google Nest — Smart Device Management (SDM) API client + OAuth.
 *
 * Env (never hard-coded):
 *   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET — the OAuth client from the
 *     Google Cloud project (zitting-hq).
 *   NEST_PROJECT_ID — the Device Access project UUID from the Device Access
 *     Console. NOT the Cloud project id; they are two different consoles.
 *
 * Gotcha that costs afternoons: authorization does NOT start at
 * accounts.google.com. Nest account linking goes through the Partner
 * Connections Manager URL below — a token minted via the normal Google
 * endpoint authenticates fine and then 403s on every SDM call.
 */

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://zitting-hq.vercel.app";
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
export const NEST_PROJECT_ID = process.env.NEST_PROJECT_ID || "";

export const isNestConfigured = Boolean(CLIENT_ID && CLIENT_SECRET && NEST_PROJECT_ID);
export const NEST_REDIRECT_URI = `${SITE_URL}/api/nest/callback`;

const SDM_BASE = "https://smartdevicemanagement.googleapis.com/v1";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SDM_SCOPE = "https://www.googleapis.com/auth/sdm.service";

const FETCH_TIMEOUT = 15_000; // same "never hang a serverless fn" posture as plaid.ts

/** Partner Connections Manager authorization URL (per-Device-Access-project). */
export function buildNestAuthUrl(state: string): string {
  const params = new URLSearchParams({
    redirect_uri: NEST_REDIRECT_URI,
    client_id: CLIENT_ID,
    response_type: "code",
    scope: SDM_SCOPE,
    access_type: "offline", // → refresh token
    prompt: "consent", // force a refresh token even on re-link
    state,
  });
  return `https://nestservices.google.com/partnerconnections/${NEST_PROJECT_ID}/auth?${params}`;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number; // seconds
  scope?: string;
  token_type: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google token endpoint ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as TokenResponse;
}

export function exchangeCode(code: string): Promise<TokenResponse> {
  return tokenRequest({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: NEST_REDIRECT_URI,
  });
}

export function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  return tokenRequest({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
}

// ---- SDM API --------------------------------------------------------------

export interface SdmDevice {
  name: string; // enterprises/{project}/devices/{id}
  type?: string;
  traits?: Record<string, unknown>;
  parentRelations?: { parent?: string; displayName?: string }[];
}

export async function sdmListDevices(accessToken: string): Promise<SdmDevice[]> {
  const res = await fetch(`${SDM_BASE}/enterprises/${NEST_PROJECT_ID}/devices`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SDM devices.list ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { devices?: SdmDevice[] };
  return json.devices ?? [];
}

/** Last path segment of an SDM resource name → our stable device id. */
export function sdmDeviceId(sdmName: string): string {
  return sdmName.split("/").pop() || sdmName;
}

// ---- Quiet hours ----------------------------------------------------------

const HOUSE_TZ = "America/Denver";

/** "HH:MM" now in the house timezone. */
function localHHMM(now = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: HOUSE_TZ,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
}

/** Is `now` inside a rule's active window? Handles windows that wrap midnight. */
export function inActiveWindow(start: string | null, end: string | null, now = new Date()): boolean {
  if (!start || !end) return true;
  const t = localHHMM(now);
  return start <= end ? t >= start && t <= end : t >= start || t <= end;
}

// ---- Pub/Sub event parsing ------------------------------------------------

/** SDM trait-event key → the simple event type our rules match on. */
const EVENT_TYPE_MAP: Record<string, string> = {
  "sdm.devices.events.CameraPerson.Person": "person",
  "sdm.devices.events.CameraMotion.Motion": "motion",
  "sdm.devices.events.DoorbellChime.Chime": "chime",
  "sdm.devices.events.CameraSound.Sound": "sound",
};

export const NEST_EVENT_TYPES = ["person", "motion", "chime", "sound"] as const;

export interface ParsedNestEvent {
  /** Top-level SDM eventId — the Pub/Sub dedupe key. */
  eventId: string;
  timestamp: string | null;
  deviceSdmName: string | null;
  /** Trigger events (person/motion/chime/sound) found in this message. */
  types: string[];
  /** Clip preview URL if the message carried one (expires in minutes). */
  previewUrl: string | null;
  raw: unknown;
}

/**
 * Decode a Pub/Sub push envelope into a ParsedNestEvent, or null for
 * messages we don't act on (relation updates, trait refreshes, garbage).
 */
export function parsePubSubEnvelope(envelope: unknown): ParsedNestEvent | null {
  const data = (envelope as { message?: { data?: string } })?.message?.data;
  if (!data) return null;
  let payload: {
    eventId?: string;
    timestamp?: string;
    resourceUpdate?: { name?: string; events?: Record<string, { previewUrl?: string }> };
  };
  try {
    payload = JSON.parse(Buffer.from(data, "base64").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload?.eventId || !payload.resourceUpdate?.events) return null;

  const events = payload.resourceUpdate.events;
  const types = Object.keys(events)
    .map((k) => EVENT_TYPE_MAP[k])
    .filter(Boolean);
  const previewUrl =
    events["sdm.devices.events.CameraClipPreview.ClipPreview"]?.previewUrl ?? null;
  // Clip-preview-only messages tag along after a trigger event; nothing to fire.
  if (types.length === 0 && !previewUrl) return null;

  return {
    eventId: payload.eventId,
    timestamp: payload.timestamp ?? null,
    deviceSdmName: payload.resourceUpdate.name ?? null,
    types,
    previewUrl,
    raw: payload,
  };
}
