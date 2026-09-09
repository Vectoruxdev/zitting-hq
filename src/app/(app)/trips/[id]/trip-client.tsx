"use client";
/** One trip: cover, plan by day, documents, packing list, people, settings. */
import * as React from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarStack, Badge, BottomSheet, Button, Checkbox, EmptyState, IconButton, ImageCard, Input, PhotoHero, RadioGroup, Reveal, Row, Section, Select, Stagger, Tabs, Textarea, ToastProvider, useToast } from "@/ui";
import type { TripDetail } from "@/db/trips";
import type { Photo } from "@/db/photos";
import { fmtNight } from "@/lib/dates";
import { countdownLabel, tripDates, type PersonLite } from "../trips-client";
import * as actions from "../actions";

const addDays = (iso: string, d: number) => { const x = new Date(iso + "T00:00:00"); x.setDate(x.getDate() + d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };

function Inner({ trip, people, me, isOwner, recentPhotos, initialTab, photosEnabled }: { trip: TripDetail; people: PersonLite[]; me: string | null; isOwner: boolean; recentPhotos: Photo[]; initialTab: string; photosEnabled: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = React.useState(initialTab);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [addItem, setAddItem] = React.useState<{ day: string | null } | null>(null);
  const [settings, setSettings] = React.useState(false);
  const [cover, setCover] = React.useState(false);
  const person = (id: string | null) => people.find((p) => p.id === id) || null;
  const canEdit = isOwner || trip.createdBy === me || (!!me && trip.participants.includes(me));
  const run = async (key: string, fn: () => Promise<unknown>, done?: string) => { setBusy(key); try { const r = (await fn()) as { ok?: boolean; error?: string } | undefined; if (r && r.ok === false) toast({ title: r.error || "That didn't save", tone: "negative" }); else if (done) toast({ title: done, tone: "positive" }); router.refresh(); } finally { setBusy(null); } };
  const days: (string | null)[] = trip.startsOn ? Array.from({ length: Math.max(1, Math.min(60, Math.round((Date.parse(trip.endsOn || trip.startsOn) - Date.parse(trip.startsOn)) / 86400000) + 1)) }, (_, i) => addDays(trip.startsOn!, i)) : [];
  const undated = trip.items.filter((i) => !i.day || !days.includes(i.day));
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [packLabel, setPackLabel] = React.useState(""); const [packWho, setPackWho] = React.useState("");
  return (
    <div style={{ width: "100%", maxWidth: "var(--content-max)", margin: "0 auto", padding: "8px var(--page-gutter-mobile) 64px", display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      <Reveal>
        <button type="button" onClick={() => router.push("/trips")} style={{ border: 0, background: "transparent", padding: "8px 0", cursor: "pointer", font: "var(--type-overline)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: "var(--accent)", textAlign: "left" }}>← Trips</button>
        <PhotoHero src={trip.cover} ratio="21 / 9" eyebrow={tripDates(trip)} title={trip.name} subtitle={[trip.destination, countdownLabel(trip.countdown)].filter(Boolean).join(" · ")} emptyTitle={trip.name} emptyBody={[trip.destination, tripDates(trip), countdownLabel(trip.countdown)].filter(Boolean).join(" · ") || (photosEnabled ? "Add a cover photo from the library." : "Dates and plans live below.")} emptyAction={canEdit && photosEnabled ? <Button variant="secondary" size="sm" iconLeft="image" onClick={() => setCover(true)}>Choose a cover</Button> : <span />} topRight={canEdit ? <>{photosEnabled ? <IconButton icon="image" label="Change cover" variant="onPhoto" size="sm" onClick={() => setCover(true)} /> : null}<IconButton icon="settings" label="Trip settings" variant="onPhoto" size="sm" onClick={() => setSettings(true)} /></> : undefined} />
        {!trip.cover && canEdit ? <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}><Button size="sm" variant="ghost" iconLeft="settings" onClick={() => setSettings(true)}>Settings</Button></div> : null}
      </Reveal>
      <Reveal index={1}><Tabs items={[{ key: "plan", label: "Plan", count: trip.items.length || undefined }, { key: "docs", label: "Documents", count: trip.documents.length || undefined }, { key: "packing", label: "Packing", count: trip.packing.filter((p) => !p.checked).length || undefined }, { key: "people", label: "People", count: trip.participants.length || undefined }]} value={tab} onChange={setTab} /></Reveal>

      {tab === "plan" ? (
        <Stagger gap={24} start={2}>
          {!days.length && !trip.items.length ? <EmptyState icon="map" title="No plan yet" body="Set the dates in settings and the days appear here, or add plans without a day." action={canEdit ? <Button iconLeft="plus" onClick={() => setAddItem({ day: null })}>Add a plan</Button> : undefined} /> : null}
          {days.map((d, i) => { const rows = trip.items.filter((it) => it.day === d); return (
            <Section key={d!} title={`Day ${i + 1} · ${fmtNight(d!)}`} action={canEdit ? <Button size="sm" variant="ghost" iconLeft="plus" onClick={() => setAddItem({ day: d })}>Add</Button> : undefined}>
              {rows.length ? <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{rows.map((it) => <Row key={it.id} time={it.time ?? undefined} icon={it.time ? undefined : "map-pin"} tint="sky" title={it.title} meta={[it.location, it.notes].filter(Boolean).join(" · ") || undefined} trailing={<>{it.url ? <IconButton icon="external-link" label="Open link" size="sm" onClick={() => window.open(it.url!, "_blank", "noopener")} /> : null}{canEdit ? <IconButton icon="x" label="Remove" size="sm" onClick={() => run(`it-${it.id}`, () => actions.deleteTripItemAction(trip.id, it.id))} /> : null}</>} chevron={false} />)}</div> : <span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}>Nothing planned yet</span>}
            </Section>); })}
          {undated.length ? <Section title="Anytime"><div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{undated.map((it) => <Row key={it.id} icon="map-pin" tint="sky" title={it.title} meta={[it.day ? fmtNight(it.day) : null, it.location, it.notes].filter(Boolean).join(" · ") || undefined} trailing={canEdit ? <IconButton icon="x" label="Remove" size="sm" onClick={() => run(`it-${it.id}`, () => actions.deleteTripItemAction(trip.id, it.id))} /> : undefined} chevron={false} />)}</div></Section> : null}
          {days.length && canEdit ? <Button variant="soft" iconLeft="plus" onClick={() => setAddItem({ day: null })} style={{ alignSelf: "flex-start" }}>Add a plan without a day</Button> : null}
        </Stagger>
      ) : null}

      {tab === "docs" ? (
        <Stagger gap={20} start={2}>
          <input ref={fileRef} type="file" accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" style={{ display: "none" }} onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const fd = new FormData(); fd.append("file", f); await run("doc", () => actions.uploadTripDocument(trip.id, fd), "Saved"); e.target.value = ""; }} />
          {canEdit ? <Button iconLeft="file-up" loading={busy === "doc"} onClick={() => fileRef.current?.click()} style={{ alignSelf: "flex-start" }}>Add a document</Button> : null}
          {!trip.documents.length ? <EmptyState icon="file-text" title="No documents yet" body="Confirmations, tickets, the rental agreement — PDFs and photos, private to the family." /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{trip.documents.map((d) => { const by = person(d.uploadedBy); return <Row key={d.id} icon={d.mime?.startsWith("image/") ? "image" : "file-text"} tint="lilac" title={d.name} meta={[d.sizeBytes ? `${(d.sizeBytes / 1024 / 1024).toFixed(1)} MB` : null, by ? `added by ${by.greetingName}` : null].filter(Boolean).join(" · ") || undefined} trailing={<>{d.url ? <IconButton icon="download" label="Open" size="sm" variant="outline" onClick={() => window.open(d.url!, "_blank", "noopener")} /> : null}{canEdit ? <IconButton icon="trash-2" label="Delete" size="sm" onClick={() => { if (confirm(`Delete ${d.name}?`)) run(`doc-${d.id}`, () => actions.deleteTripDocumentAction(trip.id, d.id)); }} /> : null}</>} chevron={false} />; })}</div>
          )}
        </Stagger>
      ) : null}

      {tab === "packing" ? (
        <Stagger gap={20} start={2}>
          {canEdit ? <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}><Input placeholder="Sunscreen" value={packLabel} onChange={(e) => setPackLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && packLabel.trim()) run("pack", async () => { const r = await actions.addPackingAction(trip.id, packLabel, packWho || null); if (r.ok) setPackLabel(""); return r; }); }} style={{ flex: "1 1 160px" }} /><Select size="md" value={packWho} placeholder="Anyone" options={trip.participants.map((id) => ({ value: id, label: person(id)?.greetingName ?? id }))} onChange={(e) => setPackWho(e.target.value)} style={{ flex: "0 1 140px" }} /><Button iconLeft="plus" disabled={!packLabel.trim()} loading={busy === "pack"} onClick={() => run("pack", async () => { const r = await actions.addPackingAction(trip.id, packLabel, packWho || null); if (r.ok) setPackLabel(""); return r; })}>Add</Button></div> : null}
          {!trip.packing.length ? <EmptyState icon="luggage" title="Nothing on the list" body="Add what to pack and who's bringing it. Check things off as they go in the bag." /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{trip.packing.map((p) => { const who = person(p.assigneeMemberId); return <Row key={p.id} leading={<Checkbox checked={p.checked} size="lg" onChange={(v) => run(`pk-${p.id}`, () => actions.setPackingAction(trip.id, p.id, { checked: v }))} style={{ minHeight: 0, padding: 0 }} />} title={<span style={{ textDecoration: p.checked ? "line-through" : "none", opacity: p.checked ? 0.6 : 1 }}>{p.label}</span>} meta={who ? `${who.greetingName} brings it` : undefined} trailing={<>{who ? <Avatar name={who.name} src={who.avatarUrl} person={who.hue} size="xs" /> : null}{canEdit ? <IconButton icon="x" label="Remove" size="sm" onClick={() => run(`pk-${p.id}`, () => actions.deletePackingAction(trip.id, p.id))} /> : null}</>} chevron={false} />; })}</div>
          )}
        </Stagger>
      ) : null}

      {tab === "people" ? (
        <Stagger gap={20} start={2}>
          <Section title="Who’s going" action={trip.participants.length ? <AvatarStack size="sm" people={trip.participants.map((id) => { const p = person(id); return { name: p?.name, src: p?.avatarUrl ?? undefined, person: p?.hue }; })} /> : undefined}>
            <div style={{ display: "flex", flexDirection: "column" }}>{people.map((p) => <Checkbox key={p.id} label={p.greetingName} checked={trip.participants.includes(p.id)} disabled={!canEdit} onChange={(v) => run(`pp-${p.id}`, () => actions.updateTripAction(trip.id, {}, { participants: v ? [...trip.participants, p.id] : trip.participants.filter((i) => i !== p.id) }))} />)}</div>
          </Section>
          <Section title="Who can see it"><Badge tone="neutral">{trip.visibility === "family" ? "Everyone in the family" : trip.visibility === "private" ? "Just the person who made it (and the owner)" : `Shared with ${trip.sharedWith.map((id) => person(id)?.greetingName).filter(Boolean).join(", ") || "nobody yet"}`}</Badge>{canEdit ? <Button size="sm" variant="ghost" onClick={() => setSettings(true)} style={{ alignSelf: "flex-start" }}>Change</Button> : null}</Section>
        </Stagger>
      ) : null}

      {addItem ? <ItemSheet tripId={trip.id} day={addItem.day} days={days} onClose={() => setAddItem(null)} run={run} busy={busy} /> : null}
      {settings ? <SettingsSheet trip={trip} people={people} me={me} canDelete={isOwner || trip.createdBy === me} onClose={() => setSettings(false)} run={run} busy={busy} onDeleted={() => router.push("/trips")} /> : null}
      <BottomSheet open={cover} onClose={() => setCover(false)} title="Choose a cover" footer={<Button size="lg" fullWidth variant="ghost" onClick={() => setCover(false)}>Cancel</Button>}>
        {!recentPhotos.length ? <EmptyState compact icon="image" title="No photos yet" body="Add photos to the library first, then pick one here." action={<Button size="sm" onClick={() => router.push("/photos?add=1")}>Add photos</Button>} /> : <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>{recentPhotos.map((ph) => <ImageCard key={ph.id} src={ph.thumb ?? ph.src} ratio="1 / 1" selected={trip.coverPhotoId === ph.id} onClick={() => run("cover", async () => { const r = await actions.updateTripAction(trip.id, { coverPhotoId: ph.id }); setCover(false); return r; }, "Cover set")} />)}</div>}
      </BottomSheet>
    </div>
  );
}

function ItemSheet({ tripId, day, days, onClose, run, busy }: { tripId: string; day: string | null; days: (string | null)[]; onClose: () => void; run: (k: string, fn: () => Promise<unknown>, done?: string) => Promise<void>; busy: string | null }) {
  const [title, setTitle] = React.useState(""); const [d, setD] = React.useState(day ?? ""); const [time, setTime] = React.useState(""); const [loc, setLoc] = React.useState(""); const [notes, setNotes] = React.useState(""); const [url, setUrl] = React.useState("");
  return (
    <BottomSheet open onClose={onClose} title="Add a plan" footer={<><Button size="lg" fullWidth disabled={!title.trim()} loading={busy === "item"} onClick={async () => { await run("item", () => actions.addTripItemAction({ tripId, day: d || null, time, title, location: loc, notes, url }), "Added"); onClose(); }}>Add</Button><Button size="lg" fullWidth variant="ghost" onClick={onClose}>Cancel</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Input label="What" placeholder="Snorkel at Molokini" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{days.length ? <Select label="Day" value={d} placeholder="Anytime" options={days.filter((x): x is string => !!x).map((x, i) => ({ value: x, label: `Day ${i + 1} · ${fmtNight(x)}` }))} onChange={(e) => setD(e.target.value)} /> : <Input label="Day" type="date" value={d} onChange={(e) => setD(e.target.value)} />}<Input label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
        <Input label="Where" value={loc} onChange={(e) => setLoc(e.target.value)} />
        <Input label="Link" type="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Textarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </BottomSheet>
  );
}

function SettingsSheet({ trip, people, me, canDelete, onClose, run, busy, onDeleted }: { trip: TripDetail; people: PersonLite[]; me: string | null; canDelete: boolean; onClose: () => void; run: (k: string, fn: () => Promise<unknown>, done?: string) => Promise<void>; busy: string | null; onDeleted: () => void }) {
  const [name, setName] = React.useState(trip.name); const [dest, setDest] = React.useState(trip.destination ?? ""); const [start, setStart] = React.useState(trip.startsOn ?? ""); const [end, setEnd] = React.useState(trip.endsOn ?? ""); const [notes, setNotes] = React.useState(trip.notes ?? "");
  const [visibility, setVisibility] = React.useState(trip.visibility); const [shared, setShared] = React.useState<string[]>(trip.sharedWith); const [confirm, setConfirm] = React.useState(false);
  return (
    <BottomSheet open onClose={onClose} title="Trip settings" footer={<><Button size="lg" fullWidth loading={busy === "trip"} disabled={!name.trim()} onClick={async () => { await run("trip", () => actions.updateTripAction(trip.id, { name, destination: dest, startsOn: start || null, endsOn: end || null, notes, visibility }, { sharedWith: shared }), "Saved"); onClose(); }}>Save</Button>{canDelete ? (confirm ? <Button size="lg" fullWidth variant="danger" onClick={() => run("trip", async () => { const r = await actions.deleteTripAction(trip.id); onDeleted(); return r; })}>Really delete the trip</Button> : <Button size="lg" fullWidth variant="ghost" onClick={() => setConfirm(true)}>Delete trip</Button>) : null}</>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Input label="Trip" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Where" value={dest} onChange={(e) => setDest(e.target.value)} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><Input label="From" type="date" value={start} onChange={(e) => setStart(e.target.value)} /><Input label="To" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        <Textarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <RadioGroup label="Who can see it" layout="cards" columns={3} value={visibility} onChange={setVisibility} options={[{ value: "family", label: "Family" }, { value: "custom", label: "Some people" }, { value: "private", label: "Just me" }]} />
        {visibility === "custom" ? <div style={{ display: "flex", flexWrap: "wrap", gap: "0 14px" }}>{people.filter((p) => p.id !== me).map((p) => <Checkbox key={p.id} label={p.greetingName} checked={shared.includes(p.id)} onChange={(v) => setShared((s) => (v ? [...s, p.id] : s.filter((i) => i !== p.id)))} style={{ minHeight: 36, padding: "6px 0" }} />)}</div> : null}
      </div>
    </BottomSheet>
  );
}

export function TripClient(props: React.ComponentProps<typeof Inner>) {
  return <ToastProvider><Inner {...props} /></ToastProvider>;
}
