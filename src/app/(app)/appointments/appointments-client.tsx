"use client";
/** Appointments — per person, soonest first, with who's driving and what to do before. */
import * as React from "react";
import { useRouter } from "next/navigation";
import { Avatar, Badge, Button, EmptyState, Reveal, Row, Section, Stagger, Tag, ToastProvider, useToast } from "@/ui";
import type { CalItem } from "@/db/calendar";
import { fmtNight } from "@/lib/dates";
import { EventSheet, type PersonLite } from "@/app/(app)/calendar/event-sheet";

function Inner({ items, people, todayISO, viewer, openEventId }: { items: CalItem[]; people: PersonLite[]; todayISO: string; viewer: { memberId: string | null; role: string }; openEventId: number | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [sheet, setSheet] = React.useState<{ event?: CalItem | null } | null>(() => { const ev = openEventId ? items.find((i) => i.familyEventId === openEventId) : null; return ev ? { event: ev } : null; });
  const [person, setPerson] = React.useState("");
  const who = (id: string | null) => people.find((x) => x.id === id) || null;
  const shown = items.filter((i) => !person || i.forMemberId === person);
  const byPerson = people.map((x) => ({ x, rows: shown.filter((i) => i.forMemberId === x.id) })).filter((g) => g.rows.length);
  const unassigned = shown.filter((i) => !i.forMemberId);
  const fmtTime = (t: string | null) => { if (!t) return "All day"; const [h, m] = t.split(":").map(Number); const d = new Date(); d.setHours(h, m); return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); };
  const Item = ({ it }: { it: CalItem }) => { const drv = who(it.driverMemberId); const mine = !!drv && drv.id === viewer.memberId; return <Row icon="stethoscope" tint="lilac" title={it.title} meta={[it.dateISO === todayISO ? "Today" : fmtNight(it.dateISO), fmtTime(it.time), it.location, drv ? `${mine ? "you're" : drv.greetingName + " is"} driving` : null].filter(Boolean).join(" · ")} trailing={<>{it.prepNotes ? <Badge tone="warning" icon="list-checks">Prep</Badge> : null}{mine ? <Badge tone="info" icon="car">Driving</Badge> : null}</>} onClick={() => setSheet({ event: it })} />; };
  return (
    <div style={{ width: "100%", maxWidth: "var(--content-max-narrow)", margin: "0 auto", padding: "16px var(--page-gutter-mobile) 64px", display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      <Reveal>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div><p style={{ margin: "0 0 6px", font: "var(--type-overline)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Doctor, dentist, school</p><h1 style={{ margin: 0, font: "var(--type-greeting)", fontSize: "clamp(var(--fs-3xl), 5vw, var(--fs-4xl))", letterSpacing: "var(--ls-display)" }}>Appointments</h1></div>
          <Button iconLeft="plus" onClick={() => setSheet({})}>Add</Button>
        </div>
      </Reveal>
      <Reveal index={1}><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><Tag selected={!person} onClick={() => setPerson("")}>Everyone</Tag>{people.map((x) => <Tag key={x.id} selected={person === x.id} onClick={() => setPerson(person === x.id ? "" : x.id)} color={`var(--person-${x.hue})`}>{x.greetingName}</Tag>)}</div></Reveal>
      {!shown.length ? <Reveal index={2}><EmptyState icon="stethoscope" title="Nothing booked" body="Appointments live here with who they're for, who's driving, and what needs to happen before. Reminders go to the right people." action={<Button iconLeft="plus" onClick={() => setSheet({})}>Add an appointment</Button>} /></Reveal> : (
        <Stagger gap={24} start={2}>
          {byPerson.map(({ x, rows }) => <Section key={x.id} title={x.greetingName} action={<Avatar name={x.name} src={x.avatarUrl} person={x.hue} size="sm" />}><div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{rows.map((it) => <Item key={it.key} it={it} />)}</div></Section>)}
          {unassigned.length ? <Section title="Family"><div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{unassigned.map((it) => <Item key={it.key} it={it} />)}</div></Section> : null}
        </Stagger>
      )}
      {sheet ? <EventSheet open onClose={() => { setSheet(null); if (openEventId) router.replace("/appointments", { scroll: false }); }} event={sheet.event} people={people} me={viewer.memberId} defaultDate={todayISO} defaultKind="appointment" onSaved={(m) => { toast({ title: m, tone: "positive" }); router.refresh(); }} /> : null}
    </div>
  );
}

export function AppointmentsClient(props: React.ComponentProps<typeof Inner>) {
  return <ToastProvider><Inner {...props} /></ToastProvider>;
}
