/**
 * Pure photo helpers shared by the server data layer and client screens.
 * No database imports — safe for the browser bundle.
 */

/** Deterministic pick for a date (same photo for everyone all day). */
export function pickForDay<T>(items: T[], dateISO: string): T | null {
  if (!items.length) return null;
  let h = 0;
  for (let i = 0; i < dateISO.length; i++) h = (h * 31 + dateISO.charCodeAt(i)) >>> 0;
  return items[h % items.length];
}

export function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftISO(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return localDay(d.toISOString());
}

/** Group a newest-first list by calendar day (local) for the stream's headers. */
export function groupByDay<T extends { takenAt: string | null }>(items: T[], todayISO: string): { key: string; label: string; items: T[] }[] {
  const out: { key: string; label: string; items: T[] }[] = [];
  const yesterday = shiftISO(todayISO, -1);
  for (const it of items) {
    const key = it.takenAt ? localDay(it.takenAt) : "unknown";
    const last = out[out.length - 1];
    if (last && last.key === key) { last.items.push(it); continue; }
    const label = key === todayISO ? "Today" : key === yesterday ? "Yesterday" : key === "unknown" ? "Undated" : new Date(key + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: key.slice(0, 4) === todayISO.slice(0, 4) ? undefined : "numeric" });
    out.push({ key, label, items: [it] });
  }
  return out;
}
