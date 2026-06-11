import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { getCalendarConfig, addDaysISO, localISO } from "@/db/household";
import { expandIcs, type IcsEvent } from "@/lib/ics";
import { CalendarClient, type DayEvent } from "./calendar-client";

export const metadata = { title: "Calendar · Zitting HQ" };
export const dynamic = "force-dynamic";

const FEED_COLORS = ["var(--accent)", "var(--indigo-500)", "var(--amber-500)", "var(--data-2, #7c8cf8)", "var(--gray-500)"];

export default async function CalendarPage() {
  const user = await getCurrentUser();
  if (isAuthConfigured && !user) redirect("/login?redirect=/calendar");

  const cfg = await getCalendarConfig();
  const todayISO = localISO(new Date());
  const windowEnd = addDaysISO(todayISO, 30);

  // Fetch + expand each enabled feed. Per-feed failures degrade to a note —
  // one broken URL must not take the whole calendar down. Results cached ~15min.
  const feedEvents: DayEvent[] = [];
  const feedErrors: { name: string; error: string }[] = [];
  for (const feed of cfg.feeds.filter((f) => f.enabled)) {
    try {
      const res = await fetch(feed.url, { next: { revalidate: 900 } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const events: IcsEvent[] = expandIcs(text, todayISO, windowEnd);
      const color = feed.color || FEED_COLORS[(feed.id - 1) % FEED_COLORS.length];
      for (const ev of events) {
        feedEvents.push({
          key: `feed-${feed.id}-${ev.uid}-${ev.dateISO}-${ev.time ?? "allday"}`,
          title: ev.title,
          dateISO: ev.dateISO,
          endDateISO: ev.endDateISO,
          time: ev.time,
          location: ev.location,
          source: feed.name,
          color,
          familyEventId: null,
        });
      }
    } catch (err) {
      feedErrors.push({ name: feed.name, error: err instanceof Error ? err.message : "fetch failed" });
    }
  }

  // In-app family events within the window.
  for (const ev of cfg.events) {
    const date = String(ev.date);
    const endDate = ev.endDate ? String(ev.endDate) : null;
    if ((endDate ?? date) < todayISO || date > windowEnd) continue;
    feedEvents.push({
      key: `fam-${ev.id}`,
      title: ev.title,
      dateISO: date,
      endDateISO: endDate,
      time: ev.time,
      location: ev.note,
      source: "Family",
      color: ev.color || "var(--accent)",
      familyEventId: ev.id,
    });
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <main style={{ flex: 1, padding: "clamp(20px, 4vw, 40px) 18px 56px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <CalendarClient
            configured={cfg.configured}
            todayISO={todayISO}
            windowEnd={windowEnd}
            events={feedEvents}
            feeds={cfg.feeds.map((f) => ({ id: f.id, name: f.name, enabled: f.enabled }))}
            feedErrors={feedErrors}
          />
        </div>
      </main>
    </div>
  );
}
