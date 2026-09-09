"use client";
/**
 * Calendar — everything on one timeline: Google feeds, family events,
 * appointments, trips as spans, and dinner nights as a quiet daily row.
 * Agenda by default; week and month for planning.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { Avatar, Badge, BottomSheet, Button, EmptyState, IconButton, InlineAlert, Input, Reveal, Row, Section, SegmentedControl, Stagger, Tag, Toggle, WeekStrip, ToastProvider, useToast, type Tint } from "@/ui";
import type { CalItem, FeedInfo } from "@/db/calendar";
import { WEEKDAYS_SHORT, fmtNight } from "@/lib/dates";
import { EventSheet, type PersonLite } from "./event-sheet";
import * as actions from "./actions";

interface Props { configured: boolean; items: CalItem[]; feeds: FeedInfo[]; people: PersonLite[]; todayISO: string; fromISO: string; toISO: string; viewer: { memberId: string | null; role: "owner" | "partner" | "member" }; openEventId: number | null; initialDate: string | null; initialView: string }

const addDays = (iso: string, d: number) => { const x = new Date(iso + "T00:00:00"); x.setDate(x.getDate() + d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const KIND_ICON: Record<string, string> = { event: "calendar", appointment: "stethoscope", trip: "plane", feed: "calendar-days", dinner: "chef-hat" };
const KIND_TINT: Record<string, Tint> = { event: "coral", appointment: "lilac", trip: "sky", feed: "sky", dinner: "butter" };
const fmtTime = (t: string | null) => { if (!t) return null; const [h, m] = t.split(":").map(Number); const d = new Date(); d.setHours(h, m); return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); };

function Inner(p: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [view, setView] = React.useState(p.initialView);
  const [day, setDay] = React.useState(p.initialDate || p.todayISO);
  const [person, setPerson] = React.useState<string>("");
  const [sheet, setSheet] = React.useState<{ event?: CalItem | null; date: string; kind?: "event" | "appointment" } | null>(() => { const ev = p.openEventId ? p.items.find((i) => i.familyEventId === p.openEventId) : null; return ev ? { event: ev, date: ev.dateISO } : null; });
  const [feedsOpen, setFeedsOpen] = React.useState(false);
  const who = (id: string | null | undefined) => p.people.find((x) => x.id === id) || null;
  const items = p.items.filter((i) => !person || i.forMemberId === person || i.driverMemberId === person || i.cookMemberId === person);
  const dayItems = (d: string) => items.filter((i) => i.dateISO === d);
  const monthStart = day.slice(0, 7) + "-01";
  const monthDays = (() => { const first = new Date(monthStart + "T00:00:00"); const pad = first.getDay(); const n = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(); return [...Array(pad).fill(null), ...Array.from({ length: n }, (_, i) => addDays(monthStart, i))] as (string | null)[]; })();

  const ItemRow = ({ it }: { it: CalItem }) => {
    const forP = who(it.forMemberId), drv = who(it.driverMemberId), cook = who(it.cookMemberId);
    const mineDrive = !!drv && drv.id === p.viewer.memberId;
    const title = it.kind === "dinner" ? (cook ? `${cook.greetingName}’s night${it.title !== "Dinner" ? ` — ${it.title}` : ""}` : "Dinner") : it.kind === "trip" ? `${it.title}${it.dayOfTrip ? ` · day ${it.dayOfTrip.n} of ${it.dayOfTrip.of}` : ""}` : forP && it.kind === "appointment" ? `${it.title} — ${forP.greetingName}` : it.title;
    const meta = [it.time ? `${fmtTime(it.time)}${it.endTime ? `–${fmtTime(it.endTime)}` : ""}` : it.kind === "dinner" || it.kind === "trip" ? null : "All day", it.location, drv ? `${mineDrive ? "you're" : drv.greetingName + " is"} driving` : null, it.kind === "feed" ? it.source : null].filter(Boolean).join(" · ");
    const editable = !!it.familyEventId;
    return <Row time={it.time ? fmtTime(it.time) ?? undefined : undefined} avatar={!it.time && (forP || cook) ? { name: (forP || cook)!.name, src: (forP || cook)!.avatarUrl, person: (forP || cook)!.hue } : undefined} icon={it.time || (!forP && !cook) ? KIND_ICON[it.kind] : undefined} tint={KIND_TINT[it.kind]} tone={it.kind === "dinner" ? "default" : "default"} title={title} meta={meta || undefined} trailing={it.kind === "appointment" ? <Badge tone="info" icon="stethoscope">Appt</Badge> : it.kind === "trip" ? <Badge tone="accent" icon="plane">Trip</Badge> : mineDrive ? <Badge tone="warning" icon="car">Driving</Badge> : undefined} onClick={editable ? () => setSheet({ event: it, date: it.dateISO }) : it.kind === "trip" && it.tripId ? () => router.push(`/trips/${it.tripId}`) : it.kind === "dinner" ? () => router.push("/meals") : undefined} chevron={editable || it.kind === "trip"} style={{ opacity: it.kind === "dinner" ? 0.8 : 1 }} />;
  };

  const days = Array.from({ length: 31 }, (_, i) => addDays(p.fromISO, i)).filter((d) => d <= p.toISO);
  const agenda = days.map((d) => ({ d, rows: dayItems(d) })).filter((x) => x.rows.length);

  return (
    <div style={{ width: "100%", maxWidth: "var(--content-max)", margin: "0 auto", padding: "16px var(--page-gutter-mobile) 64px", display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      <Reveal>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div><p style={{ margin: "0 0 6px", font: "var(--type-overline)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Calendar</p><h1 style={{ margin: 0, font: "var(--type-greeting)", fontSize: "clamp(var(--fs-3xl), 5vw, var(--fs-4xl))", letterSpacing: "var(--ls-display)" }}>{view === "month" ? new Date(monthStart + "T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" }) : view === "week" ? "This week" : "Coming up"}</h1></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <SegmentedControl size="sm" items={[{ key: "agenda", label: "Agenda" }, { key: "week", label: "Week" }, { key: "month", label: "Month" }]} value={view} onChange={setView} />
            {p.viewer.role === "owner" ? <IconButton icon="link" label="Google Calendar feeds" variant="outline" onClick={() => setFeedsOpen(true)} /> : null}
            <Button iconLeft="plus" onClick={() => setSheet({ date: day })}>Add</Button>
          </div>
        </div>
      </Reveal>
      {!p.configured ? <InlineAlert tone="warning" title="The calendar tables aren’t set up yet">Run supabase-calendar.sql and supabase-phase4-calendar-trips.sql, then reload.</InlineAlert> : null}
      {p.feeds.some((f) => f.error) ? <InlineAlert tone="warning" title="A calendar feed didn’t load">{p.feeds.filter((f) => f.error).map((f) => `${f.name}: ${f.error}`).join(" · ")}</InlineAlert> : null}
      <Reveal index={1}><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><Tag selected={!person} onClick={() => setPerson("")}>Everyone</Tag>{p.people.map((x) => <Tag key={x.id} selected={person === x.id} onClick={() => setPerson(person === x.id ? "" : x.id)} color={`var(--person-${x.hue})`}>{x.greetingName}</Tag>)}</div></Reveal>

      {view === "agenda" ? (
        !agenda.length ? <Reveal index={2}><EmptyState icon="calendar" title="A quiet stretch" body={p.feeds.length ? "Nothing on the calendar for the next month. Add an event or appointment." : "Nothing planned. Add an event, or connect a Google Calendar feed to see the family's schedule here."} action={<Button iconLeft="plus" onClick={() => setSheet({ date: p.todayISO })}>Add something</Button>} /></Reveal> : (
          <Stagger gap={24} start={2}>{agenda.map(({ d, rows }) => <Section key={d} title={d === p.todayISO ? "Today" : d === addDays(p.todayISO, 1) ? "Tomorrow" : fmtNight(d)}><div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{rows.map((it) => <ItemRow key={it.key} it={it} />)}</div></Section>)}</Stagger>
        )
      ) : null}

      {view === "week" ? (
        <Stagger gap={20} start={2}>
          <WeekStrip days={Array.from({ length: 7 }, (_, i) => { const d = addDays(day, i - new Date(day + "T00:00:00").getDay()); return { date: d, dots: dayItems(d).filter((x) => x.kind !== "dinner").slice(0, 4).map((x) => x.color || "var(--accent)") }; })} value={day} onChange={(d) => setDay(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`)} />
          <Section title={day === p.todayISO ? "Today" : fmtNight(day)} action={<Button size="sm" variant="soft" iconLeft="plus" onClick={() => setSheet({ date: day })}>Add</Button>}>
            {dayItems(day).length ? <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{dayItems(day).map((it) => <ItemRow key={it.key} it={it} />)}</div> : <EmptyState compact icon="calendar" title="Nothing this day" body="Free — or not written down yet." style={{ padding: "4px 0" }} />}
          </Section>
        </Stagger>
      ) : null}

      {view === "month" ? (
        <Stagger gap={20} start={2}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconButton icon="chevron-left" label="Previous month" size="sm" variant="outline" onClick={() => { const d = new Date(monthStart + "T00:00:00"); d.setMonth(d.getMonth() - 1); setDay(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`); }} />
            <IconButton icon="chevron-right" label="Next month" size="sm" variant="outline" onClick={() => { const d = new Date(monthStart + "T00:00:00"); d.setMonth(d.getMonth() + 1); setDay(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`); }} />
            <Button size="sm" variant="ghost" onClick={() => setDay(p.todayISO)}>Today</Button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
            {WEEKDAYS_SHORT.map((w) => <span key={w} style={{ font: "var(--type-overline)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: "var(--text-tertiary)", textAlign: "center", padding: "4px 0" }}>{w[0]}</span>)}
            {monthDays.map((d, i) => d ? (
              <button key={d} type="button" onClick={() => setDay(d)} aria-pressed={d === day} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minHeight: 56, padding: "8px 2px", border: 0, borderRadius: "var(--radius-md)", background: d === day ? "var(--accent)" : d === p.todayISO ? "var(--accent-soft)" : "transparent", color: d === day ? "var(--text-on-accent)" : "var(--text-primary)", cursor: "pointer", font: "inherit" }}>
                <span className="zh-num" style={{ font: `${d === p.todayISO ? 600 : 500} var(--fs-sm)/1 var(--font-num)` }}>{Number(d.slice(8))}</span>
                <span style={{ display: "flex", gap: 2, height: 5 }}>{dayItems(d).filter((x) => x.kind !== "dinner").slice(0, 4).map((x, j) => <span key={j} style={{ width: 5, height: 5, borderRadius: 3, background: d === day ? "var(--text-on-accent)" : x.color || "var(--accent)" }} />)}</span>
              </button>
            ) : <span key={`pad-${i}`} />)}
          </div>
          <Section title={day === p.todayISO ? "Today" : fmtNight(day)} action={<Button size="sm" variant="soft" iconLeft="plus" onClick={() => setSheet({ date: day })}>Add</Button>}>
            {dayItems(day).length ? <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{dayItems(day).map((it) => <ItemRow key={it.key} it={it} />)}</div> : <EmptyState compact icon="calendar" title="Nothing this day" style={{ padding: "4px 0" }} />}
          </Section>
        </Stagger>
      ) : null}

      {sheet ? <EventSheet open onClose={() => { setSheet(null); if (p.openEventId) router.replace("/calendar", { scroll: false }); }} event={sheet.event} people={p.people} me={p.viewer.memberId} defaultDate={sheet.date} defaultKind={sheet.kind} onSaved={(m) => { toast({ title: m, tone: "positive" }); router.refresh(); }} /> : null}
      <FeedsSheet open={feedsOpen} onClose={() => setFeedsOpen(false)} feeds={p.feeds} onChanged={() => router.refresh()} />
      {p.people.length === 0 ? null : <span style={{ display: "none" }}><Avatar name="" /></span>}
    </div>
  );
}

function FeedsSheet({ open, onClose, feeds, onChanged }: { open: boolean; onClose: () => void; feeds: FeedInfo[]; onChanged: () => void }) {
  const [name, setName] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <BottomSheet open={open} onClose={onClose} title="Google Calendar feeds" footer={<Button size="lg" fullWidth variant="ghost" onClick={onClose}>Done</Button>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <p style={{ margin: 0, font: "var(--type-body-sm)", color: "var(--text-secondary)" }}>Paste a calendar’s private “Secret address in iCal format” (Google Calendar → Settings → Integrate calendar). Read-only; events appear within 15 minutes.</p>
        {feeds.map((f) => <Row key={f.id} icon="calendar-days" tint="sky" title={f.name} meta={f.error ? `Couldn’t load: ${f.error}` : f.enabled ? "On" : "Off"} trailing={<><Toggle size="sm" checked={f.enabled} onChange={async (v) => { setBusy(`f-${f.id}`); await actions.setCalendarFeedEnabled(f.id, v); setBusy(null); onChanged(); }} style={{ minHeight: 32 }} /><IconButton icon="x" label={`Remove ${f.name}`} size="sm" onClick={async () => { setBusy(`d-${f.id}`); await actions.deleteCalendarFeed(f.id); setBusy(null); onChanged(); }} /></>} chevron={false} />)}
        <Input label="Name" placeholder="Jared’s work" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Secret iCal address" type="url" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" value={url} onChange={(e) => setUrl(e.target.value)} error={error ?? undefined} />
        <Button loading={busy === "add"} disabled={!name.trim() || !url.trim()} iconLeft="plus" onClick={async () => { setBusy("add"); setError(null); const r = await actions.addCalendarFeed({ name, url }); setBusy(null); if (r.ok) { setName(""); setUrl(""); onChanged(); } else setError(r.error || "Couldn't add"); }}>Add feed</Button>
      </div>
    </BottomSheet>
  );
}

export function CalendarClient(props: Props) {
  return <ToastProvider><Inner {...props} /></ToastProvider>;
}
