"use client";
/** Add / edit an event or appointment — shared by Calendar, Appointments, Home. */
import * as React from "react";
import { BottomSheet, Button, Checkbox, Input, RadioGroup, SegmentedControl, Select, Tag, Textarea } from "@/ui";
import type { CalItem } from "@/db/calendar";
import * as actions from "./actions";

export interface PersonLite { id: string; name: string; greetingName: string; hue: number; avatarUrl: string | null; kind: "adult" | "child" }
const REMINDERS = [{ m: 15, label: "15 min" }, { m: 60, label: "1 hour" }, { m: 1440, label: "1 day" }, { m: 10080, label: "1 week" }];

export function EventSheet({ open, onClose, event, people, me, defaultDate, defaultKind, onSaved }: { open: boolean; onClose: () => void; event?: CalItem | null; people: PersonLite[]; me: string | null; defaultDate: string; defaultKind?: "event" | "appointment"; onSaved: (msg: string) => void }) {
  const editing = !!event?.familyEventId;
  const [kind, setKind] = React.useState<"event" | "appointment">(event ? (event.kind === "appointment" ? "appointment" : "event") : defaultKind ?? "event");
  const [title, setTitle] = React.useState(event?.title ?? "");
  const [date, setDate] = React.useState(event?.dateISO ?? defaultDate);
  const [endDate, setEndDate] = React.useState(event?.endDateISO ?? "");
  const [time, setTime] = React.useState(event?.time ?? "");
  const [endTime, setEndTime] = React.useState(event?.endTime ?? "");
  const [location, setLocation] = React.useState(event?.location ?? "");
  const [note, setNote] = React.useState(event?.note ?? "");
  const [prep, setPrep] = React.useState(event?.prepNotes ?? "");
  const [forId, setForId] = React.useState(event?.forMemberId ?? "");
  const [driver, setDriver] = React.useState(event?.driverMemberId ?? "");
  const [reminders, setReminders] = React.useState<number[]>(event?.reminders ?? (defaultKind === "appointment" ? [1440, 60] : []));
  const [visibility, setVisibility] = React.useState(event?.visibility ?? "family");
  const [shared, setShared] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState(false);
  const adults = people.filter((p) => p.kind === "adult");
  const save = async () => {
    setBusy(true); setError(null);
    const payload = { kind, title, date, endDate: endDate || null, time: time || null, endTime: endTime || null, location, note, prepNotes: kind === "appointment" ? prep : null, forMemberId: forId || null, driverMemberId: kind === "appointment" ? driver || null : null, visibility, sharedWith: shared, reminders };
    const r = editing ? await actions.updateEventAction(event!.familyEventId!, payload) : await actions.createEventAction(payload);
    setBusy(false);
    if (r.ok) { onSaved(editing ? "Saved" : kind === "appointment" ? "Appointment added" : "Added to the calendar"); onClose(); } else setError(r.error || "That didn't save");
  };
  return (
    <BottomSheet open={open} onClose={onClose} title={editing ? (kind === "appointment" ? "Edit appointment" : "Edit event") : kind === "appointment" ? "New appointment" : "New event"} footer={<><Button size="lg" fullWidth loading={busy} disabled={!title.trim()} onClick={save}>{editing ? "Save" : "Add"}</Button>{editing ? (confirm ? <Button size="lg" fullWidth variant="danger" onClick={async () => { setBusy(true); await actions.deleteEventAction(event!.familyEventId!); setBusy(false); onSaved("Removed"); onClose(); }}>Really delete</Button> : <Button size="lg" fullWidth variant="ghost" onClick={() => setConfirm(true)}>Delete</Button>) : <Button size="lg" fullWidth variant="ghost" onClick={onClose}>Cancel</Button>}</>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {!editing ? <SegmentedControl items={[{ key: "event", label: "Event", icon: "calendar" }, { key: "appointment", label: "Appointment", icon: "stethoscope" }]} value={kind} onChange={(k) => setKind(k as "event" | "appointment")} style={{ alignSelf: "flex-start" }} /> : null}
        <Input label={kind === "appointment" ? "What" : "Title"} placeholder={kind === "appointment" ? "Dentist" : "School drop-off"} value={title} onChange={(e) => setTitle(e.target.value)} error={error ?? undefined} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /><Input label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} hint="Leave empty for all day" /></div>
        {kind === "event" ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><Input label="Ends on (optional)" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /><Input label="Ends at" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div> : null}
        <Select label={kind === "appointment" ? "Who it's for" : "Who's it about (optional)"} value={forId} placeholder={kind === "appointment" ? "Choose…" : "The whole family"} options={people.map((p) => ({ value: p.id, label: p.greetingName }))} onChange={(e) => setForId(e.target.value)} />
        {kind === "appointment" ? <Select label="Who's driving" value={driver} placeholder="Not set" options={adults.map((p) => ({ value: p.id, label: p.greetingName }))} onChange={(e) => setDriver(e.target.value)} /> : null}
        <Input label="Where" placeholder={kind === "appointment" ? "Sunrise Pediatric Dental" : "Grandma's"} value={location} onChange={(e) => setLocation(e.target.value)} />
        {kind === "appointment" ? <Textarea label="Before it" placeholder="Bring the insurance card · no food after 8" rows={2} value={prep} onChange={(e) => setPrep(e.target.value)} /> : <Input label="Note" value={note} onChange={(e) => setNote(e.target.value)} />}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}><span style={{ font: "var(--type-label)", color: "var(--text-secondary)" }}>Remind</span><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{REMINDERS.map((r) => <Tag key={r.m} selected={reminders.includes(r.m)} onClick={() => setReminders((rs) => (rs.includes(r.m) ? rs.filter((x) => x !== r.m) : [...rs, r.m]))} icon="bell">{r.label}</Tag>)}</div><span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}>{kind === "appointment" ? "Goes to the person it's for and the driver." : "Goes to everyone."}</span></div>
        <RadioGroup label="Who can see it" layout="cards" columns={3} value={visibility} onChange={setVisibility} options={[{ value: "family", label: "Family" }, { value: "custom", label: "Some people" }, { value: "private", label: "Just me" }]} />
        {visibility === "custom" ? <div style={{ display: "flex", flexWrap: "wrap", gap: "0 14px" }}>{people.filter((p) => p.id !== me).map((p) => <Checkbox key={p.id} label={p.greetingName} checked={shared.includes(p.id)} onChange={(v) => setShared((s) => (v ? [...s, p.id] : s.filter((i) => i !== p.id)))} style={{ minHeight: 36, padding: "6px 0" }} />)}</div> : null}
      </div>
    </BottomSheet>
  );
}
