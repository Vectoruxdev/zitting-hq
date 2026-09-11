/**
 * Runs once per server instance (Next instrumentation hook). The Node-only
 * part lives in its own module behind the runtime check so the Edge bundle
 * never sees `process.on`.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./instrumentation.node");
}
