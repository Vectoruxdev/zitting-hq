/**
 * Kicks off Nest account linking. Owner-only: redirects the browser to
 * Google's Partner Connections Manager (NOT accounts.google.com — see
 * lib/nest.ts). A random `state` in an httpOnly cookie ties the callback
 * back to this browser.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { buildNestAuthUrl, isNestConfigured } from "@/lib/nest";

export const dynamic = "force-dynamic";

export async function GET() {
  if (isAuthConfigured) {
    const u = await getCurrentUser();
    if (!u || u.role !== "owner") {
      return NextResponse.json({ error: "Owner only" }, { status: 403 });
    }
  }
  if (!isNestConfigured) {
    return NextResponse.json(
      { error: "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and NEST_PROJECT_ID first" },
      { status: 503 }
    );
  }
  const state = crypto.randomUUID();
  const jar = await cookies();
  jar.set("nest_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return NextResponse.redirect(buildNestAuthUrl(state));
}
