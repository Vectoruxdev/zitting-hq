/**
 * Pub/Sub push receiver for Nest SDM events (motion / person / chime / sound).
 *
 * Machine-to-machine: no session. Guarded by NEST_EVENTS_TOKEN — same shared
 * secret pattern as the MCP endpoint: `?key=<token>` on the push subscription
 * URL (or an Authorization: Bearer header). 503 when the env isn't set, so an
 * unconfigured deploy is closed, not open.
 *
 * Ack policy (mirrors the Plaid webhook): after auth, ALWAYS return 200 —
 * Pub/Sub retries non-2xx responses and a poison message would otherwise
 * hammer us forever. Dedupe lives in handleNestEvent (unique event_id).
 */
import { NextResponse, type NextRequest } from "next/server";
import { parsePubSubEnvelope } from "@/lib/nest";
import { handleNestEvent } from "@/db/nest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorize(req: NextRequest): NextResponse | null {
  const token = process.env.NEST_EVENTS_TOKEN;
  if (!token) return NextResponse.json({ error: "Endpoint not configured" }, { status: 503 });
  const header = req.headers.get("authorization");
  const key = req.nextUrl.searchParams.get("key");
  if (header === `Bearer ${token}` || key === token) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: NextRequest) {
  const denied = authorize(req);
  if (denied) return denied;

  try {
    const envelope = await req.json();
    const parsed = parsePubSubEnvelope(envelope);
    if (!parsed) return NextResponse.json({ ok: true, skipped: "not_an_event" });
    const results = await handleNestEvent(parsed);
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    console.error("[nest/events]", e);
    return NextResponse.json({ ok: true, error: "handled" }); // ack anyway
  }
}
