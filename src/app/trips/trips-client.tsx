"use client";
/** Trips & plans — the list, with a countdown to the next one, and the "new trip" sheet. */
import * as React from "react";
import { useRouter } from "next/navigation";
import { AvatarStack, Badge, BottomSheet, Button, Card, Checkbox, EmptyState, Input, RadioGroup, Reveal, Stagger, Textarea, ToastProvider, useToast } from "@/ui";
import type { Trip } from "@/db/trips";
import { fmtShort } from "@/lib/dates";
import * as actions from "./actions";

export interface PersonLite { id: string; name: string; greetingName: string; hue: number; avatarUrl: string | null; kind: "adult" | "child" }

export function tripDates(t: { startsOn: string | null; endsOn: string | null }): string {
  if (!t.startsOn) return "Dates to be decided";
  if (!t.endsOn || t.endsOn === t.startsOn) return fmtShort(t.startsOn);
  return `${fmtShort(t.startsOn)} – ${fmtShort(t.endsOn)}`;
}
export function countdownLabel(n: number | null): string | null {
  if (n == null) return null;
  if (n === 0) return "Today";
  if (n < 0) return "Happening now";
  if (n === 1) return "Tomorrow";
  return `In ${n} days`;
}

function Inner({ trips, people, me, addOpen }: { trips: Trip[]; people: PersonLite[]; me: string | null; addOpen: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(addOpen);
  const upcoming = trips.filter((t) => t.countdown == null ? !t.startsOn : t.countdown >= -365);
  const past = trips.filter((t) => t.startsOn && t.countdown == null);
  const person = (id: string) => people.find((p) => p.id === id);
  const TripCard = ({ t }: { t: Trip }) => (
    <Card media={t.cover ?? <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "var(--hue-sky-soft)", color: "var(--hue-sky)" }}><span style={{ font: "var(--type-h2)" }}>{t.destination || t.name}</span></div>} mediaRatio="21 / 9" title={t.name} eyebrow={tripDates(t)} onClick={() => router.push(`/trips/${t.id}`)} action={countdownLabel(t.countdown) ? <Badge tone={t.countdown != null && t.countdown <= 7 ? "accent" : "neutral"} icon="plane">{countdownLabel(t.countdown)}</Badge> : undefined}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {t.participants.length ? <AvatarStack size="sm" people={t.participants.map((id) => { const p = person(id); return { name: p?.name, src: p?.avatarUrl ?? undefined, person: p?.hue }; })} /> : null}
        <span style={{ font: "var(--type-caption)", color: "var(--text-secondary)" }}>{[t.destination, t.itemCount ? `${t.itemCount} plan${t.itemCount === 1 ? "" : "s"}` : null, t.docCount ? `${t.docCount} doc${t.docCount === 1 ? "" : "s"}` : null, t.packedOf.total ? `packed ${t.packedOf.done}/${t.packedOf.total}` : null].filter(Boolean).join(" · ")}</span>
      </div>
    </Card>
  );
  return (
    <div style={{ width: "100%", maxWidth: "var(--content-max)", margin: "0 auto", padding: "16px var(--page-gutter-mobile) 64px", display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      <Reveal>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div><p style={{ margin: "0 0 6px", font: "var(--type-overline)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Trips & plans</p><h1 style={{ margin: 0, font: "var(--type-greeting)", fontSize: "clamp(var(--fs-3xl), 5vw, var(--fs-4xl))", letterSpacing: "var(--ls-display)" }}>Where we’re going</h1></div>
          <Button iconLeft="plus" onClick={() => setOpen(true)}>New trip</Button>
        </div>
      </Reveal>
      {!trips.length ? <Reveal index={1}><EmptyState icon="plane" title="No trips planned" body="A trip keeps the itinerary, the confirmations, the packing list and the people all in one place — and shows up on the calendar and Home." action={<Button iconLeft="plus" onClick={() => setOpen(true)}>Plan the first one</Button>} /></Reveal> : (
        <Stagger gap={16} start={1}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))", gap: 16 }}>{upcoming.map((t) => <TripCard key={t.id} t={t} />)}</div>
          {past.length ? <><h2 style={{ margin: "16px 0 0", font: "var(--type-h2)" }}>Past</h2><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))", gap: 16, opacity: 0.8 }}>{past.map((t) => <TripCard key={t.id} t={t} />)}</div></> : null}
        </Stagger>
      )}
      <NewTripSheet open={open} onClose={() => { setOpen(false); if (addOpen) router.replace("/trips"); }} people={people} me={me} onCreated={(id) => { toast({ title: "Trip started", tone: "positive" }); router.push(`/trips/${id}`); }} />
    </div>
  );
}

export function NewTripSheet({ open, onClose, people, me, onCreated }: { open: boolean; onClose: () => void; people: PersonLite[]; me: string | null; onCreated: (id: string) => void }) {
  const [name, setName] = React.useState(""); const [dest, setDest] = React.useState(""); const [start, setStart] = React.useState(""); const [end, setEnd] = React.useState(""); const [notes, setNotes] = React.useState("");
  const [parts, setParts] = React.useState<string[]>(people.map((p) => p.id));
  const [visibility, setVisibility] = React.useState("family"); const [shared, setShared] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false); const [error, setError] = React.useState<string | null>(null);
  return (
    <BottomSheet open={open} onClose={onClose} title="New trip" footer={<><Button size="lg" fullWidth disabled={!name.trim()} loading={busy} onClick={async () => { setBusy(true); setError(null); const r = await actions.createTripAction({ name, destination: dest, startsOn: start || null, endsOn: end || null, notes, visibility, sharedWith: shared, participants: parts }); setBusy(false); if (r.ok) onCreated(r.id); else setError(r.error || "Couldn't save"); }}>Start planning</Button><Button size="lg" fullWidth variant="ghost" onClick={onClose}>Cancel</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Input label="Trip" placeholder="Hawaii, spring break" value={name} onChange={(e) => setName(e.target.value)} error={error ?? undefined} />
        <Input label="Where" placeholder="Maui" value={dest} onChange={(e) => setDest(e.target.value)} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><Input label="From" type="date" value={start} onChange={(e) => setStart(e.target.value)} /><Input label="To" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        <div><span style={{ font: "var(--type-label)", color: "var(--text-secondary)" }}>Who’s going</span><div style={{ display: "flex", flexWrap: "wrap", gap: "0 14px" }}>{people.map((p) => <Checkbox key={p.id} label={p.greetingName} checked={parts.includes(p.id)} onChange={(v) => setParts((s) => (v ? [...s, p.id] : s.filter((i) => i !== p.id)))} style={{ minHeight: 36, padding: "6px 0" }} />)}</div></div>
        <Textarea label="Notes" rows={2} placeholder="Flights booked · need a sitter for the dog" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <RadioGroup label="Who can see it" layout="cards" columns={3} value={visibility} onChange={setVisibility} options={[{ value: "family", label: "Family" }, { value: "custom", label: "Some people" }, { value: "private", label: "Just me" }]} />
        {visibility === "custom" ? <div style={{ display: "flex", flexWrap: "wrap", gap: "0 14px" }}>{people.filter((p) => p.id !== me).map((p) => <Checkbox key={p.id} label={p.greetingName} checked={shared.includes(p.id)} onChange={(v) => setShared((s) => (v ? [...s, p.id] : s.filter((i) => i !== p.id)))} style={{ minHeight: 36, padding: "6px 0" }} />)}</div> : null}
      </div>
    </BottomSheet>
  );
}

export function TripsClient(props: React.ComponentProps<typeof Inner>) {
  return <ToastProvider><Inner {...props} /></ToastProvider>;
}
