"use client";

/**
 * Calendar — the next 30 days as a clean agenda: Google Calendar feeds
 * (read-only ICS) merged with lightweight in-app family events.
 */
import React from "react";
import { useRouter } from "next/navigation";
import * as actions from "./actions";

export interface DayEvent {
  key: string;
  title: string;
  dateISO: string;
  endDateISO: string | null;
  time: string | null; // "18:30" | null = all-day
  location: string | null;
  source: string;
  color: string;
  familyEventId: number | null; // deletable when ours
}

const card: React.CSSProperties = {
  background: "var(--surface-card)",
  border: "1px solid var(--border-hairline)",
  borderRadius: "var(--radius-lg, 18px)",
};

function dayLabel(iso: string, todayISO: string): string {
  if (iso === todayISO) return "Today";
  const d = new Date(iso + "T00:00:00");
  const t = new Date(todayISO + "T00:00:00");
  if (d.getTime() - t.getTime() === 86400000) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function timeLabel(t: string | null): string {
  if (!t) return "all day";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const hr = h % 12 || 12;
  return m ? `${hr}:${String(m).padStart(2, "0")}${ampm}` : `${hr}${ampm}`;
}

export function CalendarClient({
  configured, todayISO, windowEnd, events, feeds, feedErrors,
}: {
  configured: boolean;
  todayISO: string;
  windowEnd: string;
  events: DayEvent[];
  feeds: { id: number; name: string; enabled: boolean }[];
  feedErrors: { name: string; error: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [managing, setManaging] = React.useState(false);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  // group events by day (multi-day all-day events appear on each day in range)
  const byDay = new Map<string, DayEvent[]>();
  for (const ev of events) {
    const last = ev.endDateISO ?? ev.dateISO;
    let d = ev.dateISO < todayISO ? todayISO : ev.dateISO;
    let guard = 0;
    while (d <= last && d <= windowEnd && guard++ < 62) {
      const arr = byDay.get(d) || [];
      arr.push(ev);
      byDay.set(d, arr);
      const x = new Date(d + "T00:00:00");
      x.setDate(x.getDate() + 1);
      d = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    }
  }
  const days = [...byDay.keys()].sort();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <p className="zt-eyebrow" style={{ marginBottom: 6 }}>Calendar</p>
          <h1 style={{ margin: 0, fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 600, letterSpacing: "-0.015em", color: "var(--text-primary)" }}>
            The next 30 days
          </h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setManaging(true)}
            style={{ border: "1px solid var(--border-hairline)", background: "var(--surface-raised)", color: "var(--text-secondary)", borderRadius: 999, padding: "10px 16px", font: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", minHeight: 44 }}>
            Feeds{feeds.length ? ` · ${feeds.length}` : ""}
          </button>
          <button onClick={() => setAdding(true)}
            style={{ border: "none", background: "var(--accent)", color: "var(--text-on-accent, #06130b)", borderRadius: 999, padding: "10px 18px", font: "inherit", fontSize: 13.5, fontWeight: 700, cursor: "pointer", minHeight: 44 }}>
            + Event
          </button>
        </div>
      </div>

      {!configured ? (
        <div style={{ ...card, padding: 22, fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)" }}>
          The calendar tables aren&apos;t set up yet — run <code style={{ color: "var(--accent)" }}>supabase-calendar.sql</code> in the Supabase SQL Editor, then reload.
        </div>
      ) : null}

      {feedErrors.length ? (
        <div style={{ ...card, padding: "12px 16px", borderColor: "var(--warning)", fontSize: 13, color: "var(--text-secondary)" }}>
          {feedErrors.map((e) => <div key={e.name}>⚠️ Couldn&apos;t load &quot;{e.name}&quot; ({e.error})</div>)}
        </div>
      ) : null}

      {days.length === 0 ? (
        <div style={{ ...card, padding: 28, textAlign: "center", color: "var(--text-tertiary)", fontSize: 14, lineHeight: 1.6 }}>
          <div style={{ fontSize: 26, marginBottom: 8 }}>📅</div>
          Nothing on the calendar yet. Connect a Google Calendar under <b>Feeds</b>{" "}
          (Settings → &quot;Secret address in iCal format&quot;) or add a family event.
        </div>
      ) : (
        days.map((d) => {
          const rows = (byDay.get(d) || []).slice().sort((a, b) => ((a.time ?? "") < (b.time ?? "") ? -1 : 1));
          const isToday = d === todayISO;
          return (
            <div key={d} style={{ ...card, padding: "8px 0", overflow: "hidden", borderColor: isToday ? "var(--green-tint)" : undefined }}>
              <div className="zt-eyebrow" style={{ padding: "8px 16px 4px", color: isToday ? "var(--accent)" : undefined }}>{dayLabel(d, todayISO)}</div>
              {rows.map((ev) => (
                <div key={ev.key + d} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px" }}>
                  <span style={{ flex: "none", width: 4, alignSelf: "stretch", borderRadius: 999, background: ev.color }} />
                  <span className="zt-num" style={{ flex: "none", width: 64, fontSize: 12, color: "var(--text-tertiary)" }}>{timeLabel(ev.time)}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</span>
                    <span style={{ display: "block", fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {[ev.source, ev.location].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {ev.familyEventId != null ? (
                    <button onClick={() => run(ev.key, () => actions.deleteFamilyEvent(ev.familyEventId!))} disabled={busy === ev.key} aria-label={`Delete ${ev.title}`}
                      style={{ flex: "none", width: 40, height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 16 }}>
                      ×
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          );
        })
      )}

      {adding ? (
        <EventSheet
          todayISO={todayISO}
          busy={busy === "addEvent"}
          onClose={() => setAdding(false)}
          onSave={(args) => run("addEvent", async () => { await actions.addFamilyEvent(args); setAdding(false); })}
        />
      ) : null}
      {managing ? (
        <FeedsSheet feeds={feeds} busy={busy} run={run} onClose={() => setManaging(false)} />
      ) : null}
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 520, maxHeight: "85dvh", overflowY: "auto",
        background: "var(--bg-app)", borderRadius: "var(--radius-lg, 18px) var(--radius-lg, 18px) 0 0",
        border: "1px solid var(--border-hairline)", padding: "18px 18px calc(18px + env(safe-area-inset-bottom))",
      }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>{title}</h2>
          <span style={{ flex: 1 }} />
          <button onClick={onClose} aria-label="Close" style={{ width: 40, height: 40, background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 18 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const input: React.CSSProperties = {
  height: 46, padding: "0 13px", background: "var(--surface-sunken)", border: "1px solid var(--border-hairline)",
  borderRadius: "var(--radius-md, 12px)", color: "var(--text-primary)", fontSize: 14.5, outline: "none", minWidth: 0, width: "100%",
  colorScheme: "dark",
};

function EventSheet({ todayISO, busy, onClose, onSave }: {
  todayISO: string;
  busy: boolean;
  onClose: () => void;
  onSave: (args: { title: string; date: string; time?: string | null; note?: string | null }) => void;
}) {
  const [title, setTitle] = React.useState("");
  const [date, setDate] = React.useState(todayISO);
  const [time, setTime] = React.useState("");
  const [note, setNote] = React.useState("");
  return (
    <Sheet title="New family event" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's happening? (Grandma's birthday)" autoFocus style={input} aria-label="Event title" />
        <div style={{ display: "flex", gap: 10 }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...input, flex: 1 }} aria-label="Date" />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ ...input, flex: 1 }} aria-label="Time (optional)" />
        </div>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" style={input} aria-label="Note" />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} disabled={busy}
            style={{ border: "1px solid var(--border-hairline)", background: "var(--surface-raised)", color: "var(--text-secondary)", borderRadius: 999, padding: "11px 18px", font: "inherit", fontSize: 13.5, fontWeight: 600, cursor: "pointer", minHeight: 46 }}>
            Cancel
          </button>
          <button onClick={() => onSave({ title, date, time: time || null, note: note || null })} disabled={busy || !title.trim() || !date}
            style={{ border: "none", background: "var(--accent)", color: "var(--text-on-accent, #06130b)", borderRadius: 999, padding: "11px 22px", font: "inherit", fontSize: 13.5, fontWeight: 700, cursor: "pointer", minHeight: 46, opacity: busy || !title.trim() || !date ? 0.55 : 1 }}>
            Add event
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function FeedsSheet({ feeds, busy, run, onClose }: {
  feeds: { id: number; name: string; enabled: boolean }[];
  busy: string | null;
  run: (k: string, fn: () => Promise<unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = React.useState("");
  const [url, setUrl] = React.useState("");
  return (
    <Sheet title="Calendar feeds" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: "var(--text-tertiary)" }}>
          In Google Calendar: Settings → your calendar → <b>Integrate calendar</b> → copy the
          <b> Secret address in iCal format</b> and paste it here. Read-only — Zitting HQ never changes your Google Calendar.
        </p>
        {feeds.map((f) => (
          <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md, 12px)", padding: "10px 12px" }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
            <button onClick={() => run(`feed-${f.id}`, () => actions.setCalendarFeedEnabled(f.id, !f.enabled))} disabled={busy === `feed-${f.id}`}
              style={{ flex: "none", border: "1px solid var(--border-hairline)", background: f.enabled ? "var(--green-glow)" : "var(--surface-sunken)", color: f.enabled ? "var(--accent)" : "var(--text-tertiary)", borderRadius: 999, padding: "7px 13px", font: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer", minHeight: 36 }}>
              {f.enabled ? "On" : "Off"}
            </button>
            <button onClick={() => run(`feeddel-${f.id}`, () => actions.deleteCalendarFeed(f.id))} disabled={busy === `feeddel-${f.id}`} aria-label={`Remove ${f.name}`}
              style={{ flex: "none", width: 36, height: 36, background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 15 }}>
              ×
            </button>
          </div>
        ))}
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim() && url.trim()) run("addFeed", async () => { await actions.addCalendarFeed({ name, url }); setName(""); setUrl(""); }); }}
          style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (Jared's calendar)" style={input} aria-label="Feed name" />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" style={input} aria-label="Feed URL" />
          <button type="submit" disabled={!name.trim() || !url.trim() || busy === "addFeed"}
            style={{ alignSelf: "flex-end", border: "none", background: "var(--accent)", color: "var(--text-on-accent, #06130b)", borderRadius: 999, padding: "11px 20px", font: "inherit", fontSize: 13.5, fontWeight: 700, cursor: "pointer", minHeight: 46, opacity: !name.trim() || !url.trim() || busy === "addFeed" ? 0.55 : 1 }}>
            Add feed
          </button>
        </form>
      </div>
    </Sheet>
  );
}
