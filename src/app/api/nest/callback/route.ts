/**
 * OAuth callback — Google redirects here after the owner picks which cameras
 * to share. Verifies state, exchanges the code, stores tokens (server-side
 * only), then best-effort syncs the device list and lands on /nest.
 */
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { exchangeCode, isNestConfigured, SITE_URL } from "@/lib/nest";
import { saveNestTokens, syncNestDevices } from "@/db/nest";

export const dynamic = "force-dynamic";

const back = (query: string) => NextResponse.redirect(`${SITE_URL}/nest?${query}`);

export async function GET(req: NextRequest) {
  let user = null;
  if (isAuthConfigured) {
    user = await getCurrentUser();
    if (!user || user.role !== "owner") {
      return NextResponse.json({ error: "Owner only" }, { status: 403 });
    }
  }
  if (!isNestConfigured) return back("error=not_configured");

  const params = req.nextUrl.searchParams;
  if (params.get("error")) return back(`error=${encodeURIComponent(params.get("error")!)}`);

  const code = params.get("code");
  const state = params.get("state");
  const jar = await cookies();
  const expected = jar.get("nest_oauth_state")?.value;
  jar.delete("nest_oauth_state");
  if (!code || !state || !expected || state !== expected) {
    return back("error=state_mismatch");
  }

  try {
    const t = await exchangeCode(code);
    if (!t.refresh_token) {
      // Shouldn't happen with access_type=offline&prompt=consent, but if it
      // does, storing only an access token would break in an hour — refuse.
      return back("error=no_refresh_token");
    }
    await saveNestTokens({
      refreshToken: t.refresh_token,
      accessToken: t.access_token,
      expiresInSeconds: t.expires_in,
      scope: t.scope ?? null,
      connectedBy: user?.email ?? null,
    });
    await syncNestDevices().catch(() => {}); // best-effort; page has a Sync button
    return back("connected=1");
  } catch (e) {
    console.error("[nest/callback]", e);
    return back("error=exchange_failed");
  }
}
