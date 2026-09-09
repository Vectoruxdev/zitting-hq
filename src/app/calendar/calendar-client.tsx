"use client";
/**
 * Calendar — everything on one timeline: Google feeds, family events,
 * appointments, trips as spans, and dinner nights as a quiet daily row.
 * Agenda by default; week and month for planning.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { Avatar, Badge, BottomSheet, Button, Checkbox, EmptyState, IconButton, InlineAlert, Input, RadioGroup, Reveal, Row, Section, SegmentedControl, Stagger, Tag, Toggle, WeekStrip, ToastProvider, useToast, type Tint } from "@/ui";
import type { CalItem, FeedInfo } from "@/db/calendar";
import { WEEKDAYS_SHORT, fmtNight } from "@/lib/dates";
import { EventSheet, type PersonLite } from "./event-sheet";
import * as actions from "./actions";

interface Props { configured: boolean; items: CalItem[]; feeds: FeedInfo[]; people: PersonLite[]; todayISO: string; fromISO: string; toISO: string; viewer: { memberId: string | null; role: "owner" | "partner" | "member" }; viewerKind: "adult" | "child"; openEventId: number | null; initialDate: string | null; initialView: string; initialFeedsOpen: boolean }

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
  const [feedsOpen, setFeedsOpen] = React.useState(p.initialFeedsOpen);
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
            {p.viewerKind === "adult" ? <IconButton icon="link" label="Google Calendars" variant="outline" onClick={() => setFeedsOpen(true)} /> : null}
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
      <FeedsSheet open={feedsOpen} onClose={() => { setFeedsOpen(false); if (p.initialFeedsOpen) router.replace("/calendar", { scroll: false }); }} feeds={p.feeds} people={p.people} me={p.viewer.memberId} isOwner={p.viewer.role === "owner"} onChanged={() => router.refresh()} />
      {p.people.length === 0 ? null : <span style={{ display: "none" }}><Avatar name="" /></span>}
    </div>
  );
}

const VIS_LABEL: Record<string, string> = { family: "Shared with the family", private: "Just you (and the owner)", custom: "Some people" };

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span aria-hidden style={{ flex: "none", width: 26, height: 26, borderRadius: 13, background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center", font: "600 var(--fs-sm)/1 var(--font-num)" }}>{n}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}><span style={{ font: "var(--type-label)", color: "var(--text-primary)" }}>{title}</span>{children}</div>
    </div>
  );
}

interface FeedRowProps { f: FeedInfo; editable: boolean; me: string | null; people: PersonLite[]; editVis: number | null; setEditVis: (id: number | null) => void; run: (key: string, fn: () => Promise<{ ok: boolean; error?: string } | void>) => Promise<void> }
function FeedRow({ f, editable, me, people, editVis, setEditVis, run }: FeedRowProps) {
  const person = (id: string | null) => people.find((x) => x.id === id) || null;
  const othersLabel = (x: FeedInfo) => { const p = person(x.memberId); return x.memberId ? `${p?.greetingName ?? "Someone"}’s · ${x.visibility === "family" ? "shared with the family" : x.visibility === "custom" ? "shared with some people" : "private"}` : "Household calendar"; };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Row icon="calendar-days" tint="sky" title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: 5, background: f.color ?? "var(--data-2)", flex: "none" }} />{f.name}</span>} meta={f.error ? `Couldn’t load: ${f.error}` : `${f.enabled ? "On" : "Off"} · ${f.memberId === me ? VIS_LABEL[f.visibility] ?? f.visibility : othersLabel(f)}`}
        trailing={editable ? <><Toggle size="sm" checked={f.enabled} onChange={(v) => run(`f-${f.id}`, () => actions.setCalendarFeedEnabled(f.id, v))} style={{ minHeight: 32 }} />{f.memberId ? <IconButton icon="eye" label="Who can see it" size="sm" active={editVis === f.id} onClick={() => setEditVis(editVis === f.id ? null : f.id)} /> : null}<IconButton icon="x" label={`Remove ${f.name}`} size="sm" onClick={() => run(`d-${f.id}`, () => actions.deleteCalendarFeed(f.id))} /></> : undefined} chevron={false} />
      {editable && editVis === f.id && f.memberId ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 0 8px 44px" }}>
          <RadioGroup layout="cards" columns={3} value={f.visibility} onChange={(v) => run(`v-${f.id}`, () => actions.setCalendarFeedVisibility(f.id, v, f.sharedWith))} options={[{ value: "family", label: "Family" }, { value: "custom", label: "Some people" }, { value: "private", label: "Just me" }]} />
          {f.visibility === "custom" ? <div style={{ display: "flex", flexWrap: "wrap", gap: "0 14px" }}>{people.filter((x) => x.id !== f.memberId).map((x) => <Checkbox key={x.id} label={x.greetingName} checked={f.sharedWith.includes(x.id)} onChange={(v) => run(`v-${f.id}`, () => actions.setCalendarFeedVisibility(f.id, "custom", v ? [...f.sharedWith, x.id] : f.sharedWith.filter((i) => i !== x.id)))} style={{ minHeight: 36, padding: "6px 0" }} />)}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

function FeedsSheet({ open, onClose, feeds, people, me, isOwner, onChanged }: { open: boolean; onClose: () => void; feeds: FeedInfo[]; people: PersonLite[]; me: string | null; isOwner: boolean; onChanged: () => void }) {
  const [name, setName] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [visibility, setVisibility] = React.useState("family");
  const [shared, setShared] = React.useState<string[]>([]);
  const [household, setHousehold] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [editVis, setEditVis] = React.useState<number | null>(null);
  const mine = feeds.filter((f) => f.memberId && f.memberId === me);
  const others = feeds.filter((f) => !(f.memberId && f.memberId === me));
  const run = async (key: string, fn: () => Promise<{ ok: boolean; error?: string } | void>) => { setBusy(key); try { const r = await fn(); if (r && !r.ok) setError(r.error || "That didn't save"); else onChanged(); } finally { setBusy(null); } };
  const [checked, setChecked] = React.useState<{ url: string; name: string | null; upcoming: number; isPublicGoogle: boolean } | null>(null);
  const [checking, setChecking] = React.useState(false);
  const looksLikeGoogle = /calendar\.google\.com\/calendar\/ical\//i.test(url);
  const check = async () => {
    setChecking(true); setError(null); setChecked(null);
    try {
      const r = await actions.checkCalendarFeed(url);
      if (!r.ok) setError(r.error);
      else { setChecked({ url: url.trim(), name: r.name, upcoming: r.upcoming, isPublicGoogle: r.isPublicGoogle }); if (!name.trim() && r.name) setName(r.name); }
    } catch { setError("Couldn't check that address right now."); } finally { setChecking(false); }
  };
  const hint = { font: "var(--type-body-sm)", color: "var(--text-secondary)" } as React.CSSProperties;
  return (
    <BottomSheet open={open} onClose={onClose} title="Google Calendars" footer={<Button size="lg" fullWidth variant="ghost" onClick={onClose}>Done</Button>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <p style={{ margin: 0, ...hint }}>Connect your own Google Calendar and it shows up here and on Home, in your color. You decide who sees it, and you can switch it off any time. It’s read-only — nothing in Google changes.</p>
        {mine.length ? <Section title="Your calendars"><div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{mine.map((f) => <FeedRow key={f.id} f={f} editable me={me} people={people} editVis={editVis} setEditVis={setEditVis} run={run} />)}</div></Section> : null}

        <Section title={mine.length ? "Connect another calendar" : "Connect your calendar"} eyebrow="About five minutes, on a computer">
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <Step n={1} title="Open Google Calendar’s settings">
              <span style={hint}>This part isn’t in the phone app. Use a computer, or in your phone’s browser open the menu and tap “Request desktop site”.</span>
              <Button size="sm" variant="secondary" iconRight="external-link" onClick={() => window.open("https://calendar.google.com/calendar/r/settings", "_blank", "noopener")} style={{ alignSelf: "flex-start" }}>Open Google Calendar settings</Button>
            </Step>
            <Step n={2} title="Pick your calendar">
              <span style={hint}>On the left, under <b>Settings for my calendars</b>, click the calendar with your name on it (or whichever one you want to share).</span>
            </Step>
            <Step n={3} title="Copy the secret address">
              <span style={hint}>Scroll down to <b>Integrate calendar</b>. Copy the one called <b>Secret address in iCal format</b> — the long link ending in <b>basic.ics</b>. Not “Public address”; the secret one is what lets the app see your private events.</span>
              <span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}>Treat that address like a password: anyone who has it can read your calendar. It’s stored on the server only and never shown again. If it ever leaks, click <b>Reset</b> next to it in Google and paste the new one here.</span>
            </Step>
            <Step n={4} title="Paste it here and check it">
              <Input type="url" placeholder="https://calendar.google.com/calendar/ical/…/private-…/basic.ics" value={url} onChange={(e) => { setUrl(e.target.value); setChecked(null); setError(null); }} error={error ?? undefined} />
              {url.trim() && !looksLikeGoogle && !error ? <span style={{ font: "var(--type-caption)", color: "var(--warning)" }}>That doesn’t look like a Google Calendar address. Other calendars (Outlook, iCloud, a school) work too if it’s an iCal link.</span> : null}
              <Button size="sm" variant={checked ? "ghost" : "secondary"} iconLeft={checked ? "circle-check" : "search"} loading={checking} disabled={!url.trim()} onClick={check} style={{ alignSelf: "flex-start" }}>{checked ? "Checked" : "Check the address"}</Button>
              {checked ? (
                <InlineAlert tone={checked.isPublicGoogle ? "warning" : "positive"} title={checked.isPublicGoogle ? "That’s the public address" : `Found ${checked.name ? `“${checked.name}”` : "your calendar"}`}>
                  {checked.isPublicGoogle ? "It works, but Google hides your private events on the public one. Go back to step 3 and copy the Secret address instead." : checked.upcoming ? `${checked.upcoming} event${checked.upcoming === 1 ? "" : "s"} in the next 60 days. You’re good.` : "It loads, though there’s nothing in the next 60 days yet."}
                </InlineAlert>
              ) : null}
            </Step>
            <Step n={5} title="Name it and choose who sees it">
              <Input label="What to call it" placeholder={checked?.name || "Work"} value={name} onChange={(e) => setName(e.target.value)} />
              {!household ? <RadioGroup label="Who can see it" layout="cards" columns={3} value={visibility} onChange={setVisibility} options={[{ value: "family", label: "Family" }, { value: "custom", label: "Some people" }, { value: "private", label: "Just me" }]} /> : null}
              {!household && visibility === "custom" ? <div style={{ display: "flex", flexWrap: "wrap", gap: "0 14px" }}>{people.filter((x) => x.id !== me).map((x) => <Checkbox key={x.id} label={x.greetingName} checked={shared.includes(x.id)} onChange={(v) => setShared((s) => (v ? [...s, x.id] : s.filter((i) => i !== x.id)))} style={{ minHeight: 36, padding: "6px 0" }} />)}</div> : null}
              {isOwner ? <Checkbox label="This is a household calendar, not anyone’s own" checked={household} onChange={setHousehold} /> : null}
              <span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}>{household ? "Household calendars are shared with everyone." : visibility === "private" ? "Only you see these events on the calendar and Home. The owner can see everything, as always." : visibility === "custom" ? "Only the people you pick see these events." : "Everyone in the family sees these events, in your color."}</span>
              <Button loading={busy === "add"} disabled={!name.trim() || !url.trim()} iconLeft="plus" onClick={() => run("add", async () => { setError(null); const r = await actions.addCalendarFeed({ name, url, visibility, sharedWith: shared, household }); if (r.ok) { setName(""); setUrl(""); setShared([]); setHousehold(false); setChecked(null); } return r; })}>Connect</Button>
              <span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}>Events appear within about 15 minutes, and new ones you add in Google keep flowing in. You can switch the calendar off or change who sees it any time from this sheet.</span>
            </Step>
          </div>
        </Section>

        {others.length ? <Section title={isOwner ? "Everyone’s calendars" : "Shared with you"}><div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{others.map((f) => <FeedRow key={f.id} f={f} editable={isOwner} me={me} people={people} editVis={editVis} setEditVis={setEditVis} run={run} />)}</div>{isOwner ? <span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}>Switch anyone’s calendar off here and it disappears for everyone until it’s switched back on.</span> : null}</Section> : null}

        <Section title="If something’s off" eyebrow="Help">
          <div style={{ display: "flex", flexDirection: "column", gap: 8, ...hint }}>
            <span><b>I can’t find “Integrate calendar”.</b> You’re probably in the Google Calendar phone app — it isn’t there. Open calendar.google.com in a browser on a computer, or use “Request desktop site” on your phone.</span>
            <span><b>The secret address is greyed out.</b> That calendar is shared publicly in Google; the public address works the same for it.</span>
            <span><b>An event is missing.</b> Give it 15 minutes. If it’s still missing, it may be on a different calendar in Google (each one has its own address) — connect that one too.</span>
            <span><b>I want to disconnect.</b> Tap the × next to the calendar above. Resetting the address in Google also disconnects it.</span>
          </div>
        </Section>
      </div>
    </BottomSheet>
  );
}

export function CalendarClient(props: Props) {
  return <ToastProvider><Inner {...props} /></ToastProvider>;
}
