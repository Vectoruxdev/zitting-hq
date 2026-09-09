import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getVerifiedClaims } from "@/lib/supabase/claims";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Plaid's webhook + the nightly cron are machine-to-machine (no session) and
// carry their own guards, so they must bypass the login redirect.
const PUBLIC_PATHS = [
  "/login",
  "/auth",
  "/offline", // service-worker offline shell (static, no data)
  "/api/health/db", // DB reachability probe (no data)
  "/api/plaid/webhook",
  "/api/plaid/cron-sync",
  "/api/transfers/cron", // daily transfers job (CRON_SECRET-guarded)
  "/api/digest/cron", // email digests (CRON_SECRET-guarded)
  "/api/reminders/cron", // event/appointment reminders every 15 min (CRON_SECRET-guarded)
  "/api/push/vapid", // public VAPID key (safe to expose)
  "/api/mcp", // remote MCP server — guarded by its own MCP_TOKEN, not a session
  "/api/nest/events", // Pub/Sub push (NEST_EVENTS_TOKEN-guarded)
  "/api/sse", // MCP SSE transport (legacy clients)
  "/api/message", // MCP SSE message channel
  "/sw.js", // service worker must load without a session redirect
  "/manifest.webmanifest",
];

/**
 * Next 16 Proxy (formerly Middleware). Checks the Supabase session on every
 * request (locally, refreshing the cookie when it has expired) and does an
 * optimistic redirect to /login when there's no user.
 * Real authorization still happens in the server components/pages.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // If auth isn't configured (e.g. no Supabase env), don't lock anyone out.
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Verify the session here (signature check against Supabase's public keys)
  // instead of asking the Auth server on every request; only an expired token
  // still refreshes over the network.
  const user = await getVerifiedClaims(supabase);

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (path !== "/") url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on everything except Next internals and static asset files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
