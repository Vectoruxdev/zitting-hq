/**
 * Zitting HQ — remote MCP server (Streamable HTTP) for connecting the finance
 * data to Claude. Served at `/api/mcp` (the `[transport]` segment resolves to
 * "mcp"). Reuses the app's own DB layer: reads via getFinanceData() (owner
 * scope — full household, no member scrubbing), writes via the owner-authority
 * mutations in src/db/mutations.ts. Tools live in src/mcp/ (see register.ts).
 *
 * Auth: two shared secrets.
 *   - MCP_TOKEN          → full read + write (incl. irreversible ops, which gate on confirm:true)
 *   - MCP_READONLY_TOKEN → read-only (write tools aren't even registered)
 * Pass either as `Authorization: Bearer <token>` or `?key=<token>`. The token is
 * the ONLY boundary — it has full owner authority over the whole household.
 * If neither token is set the endpoint is closed (503).
 */
import { createMcpHandler } from "mcp-handler";
import { registerAllTools } from "@/mcp/register";

export const dynamic = "force-dynamic";
// 300s so the sync_now tool (slow bank pulls) fits; reads return well under 60.
export const maxDuration = 300;

const opts = { basePath: "/api", maxDuration: 300 };
// Two handlers: the read-only one never registers write tools, so a read-only
// token literally cannot see (or call) any mutation.
const fullHandler = createMcpHandler((server) => registerAllTools(server, "full"), {}, opts);
const readonlyHandler = createMcpHandler((server) => registerAllTools(server, "readonly"), {}, opts);

/** Resolve the bearer/key to a tier, or a short-circuit Response. */
function authorize(req: Request): { tier: "full" | "readonly" } | Response {
  const full = process.env.MCP_TOKEN;
  const readonly = process.env.MCP_READONLY_TOKEN;
  if (!full && !readonly) {
    return Response.json({ error: "MCP server not configured: set MCP_TOKEN (and optionally MCP_READONLY_TOKEN)." }, { status: 503 });
  }
  const url = new URL(req.url);
  const provided =
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim() ||
    url.searchParams.get("key") ||
    "";
  if (full && provided === full) return { tier: "full" };
  if (readonly && provided === readonly) return { tier: "readonly" };
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

async function handler(req: Request): Promise<Response> {
  const auth = authorize(req);
  if (auth instanceof Response) return auth;
  return auth.tier === "readonly" ? readonlyHandler(req) : fullHandler(req);
}

export { handler as GET, handler as POST, handler as DELETE };
