/**
 * The build stamp — what "which version is this?" resolves to.
 *
 * Inlined at build time by next.config.ts. The version is the build's date
 * and time in the family's timezone plus the short commit, e.g.
 * "2026.09.09-1532 · ffc6c07": it changes on every push, sorts naturally,
 * and needs no git history (Vercel builds from a shallow clone, which made
 * the old commit-count "build number" unreliable).
 */
export const BUILD_SHA = process.env.NEXT_PUBLIC_BUILD_SHA || "dev";
export const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME || "";
const TZ = "America/Denver";

function parts(iso: string, opts: Intl.DateTimeFormatOptions) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...opts }).formatToParts(new Date(iso));
  return (t: Intl.DateTimeFormatPartTypes) => p.find((x) => x.type === t)?.value ?? "";
}

/** "2026.09.09-1532" (Mountain time), or "dev" outside a build. */
export function buildVersion(): string {
  if (!BUILD_TIME) return "dev";
  const g = parts(BUILD_TIME, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${g("year")}.${g("month")}.${g("day")}-${g("hour")}${g("minute")}`;
}

/** "Version 2026.09.09-1532 · ffc6c07" */
export function buildLabel(): string {
  return `Version ${buildVersion()} · ${BUILD_SHA}`;
}

/** Long form for a tooltip: "Built Sep 9, 2026, 3:32 PM Mountain · commit ffc6c07". */
export function buildTitle(): string {
  if (!BUILD_TIME) return "Development build";
  const g = parts(BUILD_TIME, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  return `Built ${g("month")} ${g("day")}, ${g("year")}, ${g("hour")}:${g("minute")} ${g("dayPeriod")} Mountain · commit ${BUILD_SHA}`;
}
