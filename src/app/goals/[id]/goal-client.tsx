"use client";
/** One goal: the ring, the check-in, the history, the people. */
import * as React from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarStack, Badge, BottomSheet, Button, Celebrate, CountUp, EmptyState, Icon, IconButton, ImageCard, Input, PhotoHero, ProgressRing, Reveal, Row, Section, Stagger, Stepper, ToastProvider, useToast, money } from "@/ui";
import type { GoalDetail } from "@/db/goals";
import type { Photo } from "@/db/photos";
import { fmtNight, fmtShort } from "@/lib/dates";
import { GoalSheet, KIND_LABEL, type PersonLite, type SavingsOption } from "../goal-sheet";
import { progressLine } from "../goals-client";
import * as actions from "../actions";

function Inner({ goal, people, me, isOwner, todayISO, savingsOptions, recentPhotos }: { goal: GoalDetail; people: PersonLite[]; me: string | null; isOwner: boolean; todayISO: string; savingsOptions: SavingsOption[]; recentPhotos: Photo[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [fire, setFire] = React.useState(0);
  const [amount, setAmount] = React.useState(1);
  const [note, setNote] = React.useState("");
  const [settings, setSettings] = React.useState(false);
  const [cover, setCover] = React.useState(false);
  const person = (id: string | null) => people.find((p) => p.id === id) || null;
  const canEdit = isOwner || goal.createdBy === me || (!!me && goal.participants.includes(me));
  const canCheck = goal.kind === "family" || canEdit;
  const p = goal.progress;
  const run = async (key: string, fn: () => Promise<{ ok: boolean; error?: string; completed?: boolean } | undefined>, done?: string) => {
    setBusy(key);
    try { const r = await fn(); if (r && !r.ok) toast({ title: r.error || "That didn't save", tone: "negative" }); else { if (r?.completed) { setFire((f) => f + 1); toast({ title: "Goal reached", tone: "positive" }); } else if (done) toast({ title: done, tone: "positive" }); router.refresh(); } } finally { setBusy(null); }
  };
  const due = goal.dueOn ? Math.round((Date.parse(goal.dueOn) - Date.parse(todayISO)) / 86400000) : null;
  const eyebrow = [goal.kind === "family" ? "Family goal" : "Personal goal", KIND_LABEL[goal.progressKind].label, due != null && !goal.completedAt ? (due < 0 ? `${-due} days overdue` : due === 0 ? "due today" : `${due} days left`) : null].filter(Boolean).join(" · ");
  const ringTone = p.done ? "positive" : goal.hue ? `var(--person-${goal.hue})` : "accent";
  const center = goal.progressKind === "savings" ? <span className="zh-money" style={{ font: "var(--type-money-lg)", fontSize: "var(--fs-xl)" }}><CountUp value={p.current} format={(n) => money(n, { cents: false })} /></span> : goal.progressKind === "checkoff" ? <Icon name={p.done ? "circle-check" : "circle"} size={40} color={p.done ? "var(--positive)" : "var(--text-tertiary)"} /> : <span style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1 }}><span className="zh-num" style={{ font: "var(--type-money-lg)", fontSize: "var(--fs-3xl)" }}><CountUp value={p.current} /></span><span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}>of {p.target ?? "?"}{goal.progressKind === "count" && p.unit ? ` ${p.unit}` : goal.progressKind === "streak" ? " days" : ""}</span></span>;
  return (
    <div style={{ position: "relative", width: "100%", maxWidth: "var(--content-max-narrow)", margin: "0 auto", padding: "8px var(--page-gutter-mobile) 64px", display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      <Celebrate fire={fire} origin="top" />
      <Reveal>
        <button type="button" onClick={() => router.push("/goals")} style={{ border: 0, background: "transparent", padding: "8px 0", cursor: "pointer", font: "var(--type-overline)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: "var(--accent)", textAlign: "left" }}>← Goals</button>
        {goal.cover ? <PhotoHero src={goal.cover} ratio="21 / 9" eyebrow={eyebrow} title={goal.title} subtitle={goal.description ?? undefined} topRight={canEdit ? <><IconButton icon="image" label="Change cover" variant="onPhoto" size="sm" onClick={() => setCover(true)} /><IconButton icon="settings" label="Goal settings" variant="onPhoto" size="sm" onClick={() => setSettings(true)} /></> : undefined} /> : (
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div style={{ minWidth: 0 }}><p style={{ margin: "0 0 6px", font: "var(--type-overline)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: "var(--text-tertiary)" }}>{eyebrow}</p><h1 style={{ margin: 0, font: "var(--type-greeting)", fontSize: "clamp(var(--fs-2xl), 5vw, var(--fs-4xl))", letterSpacing: "var(--ls-display)" }}>{goal.title}</h1>{goal.description ? <p style={{ margin: "8px 0 0", font: "var(--type-body)", color: "var(--text-secondary)" }}>{goal.description}</p> : null}</div>
            {canEdit ? <div style={{ display: "flex", gap: 6, flex: "none" }}><IconButton icon="image" label="Add a cover" variant="outline" size="sm" onClick={() => setCover(true)} /><IconButton icon="settings" label="Goal settings" variant="outline" size="sm" onClick={() => setSettings(true)} /></div> : null}
          </div>
        )}
      </Reveal>

      <Reveal index={1}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, padding: "8px 0" }}>
          <ProgressRing value={p.value} size={172} thickness={12} tone={ringTone} label={goal.title}>{center}</ProgressRing>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span style={{ font: "var(--type-body)", color: "var(--text-secondary)" }}>{progressLine(goal)}</span>
            {goal.completedAt ? <Badge tone="positive" icon="party-popper">Finished {fmtShort(goal.completedAt.slice(0, 10))}{person(goal.completedBy) ? ` · ${person(goal.completedBy)!.greetingName}` : ""}</Badge> : goal.progressKind === "streak" && p.streak > 0 ? <Badge tone="accent" icon="sparkles">{p.streak}-day streak</Badge> : null}
          </div>
          {!goal.completedAt && canCheck ? (
            goal.progressKind === "checkoff" ? <Button size="lg" iconLeft="circle-check" loading={busy === "done"} onClick={() => run("done", async () => ({ ...(await actions.completeGoalAction(goal.id)), completed: true }))}>Mark it done</Button>
            : goal.progressKind === "streak" ? (p.doneToday ? <Button size="lg" variant="soft" iconLeft="check" disabled>Done today</Button> : <Button size="lg" iconLeft="check" loading={busy === "in"} onClick={() => run("in", () => actions.checkInAction(goal.id), "Nice — logged for today")}>Did it today</Button>)
            : goal.progressKind === "count" ? <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}><div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}><Stepper value={amount} min={1} max={999} onChange={setAmount} label="Amount" /><Button size="lg" iconLeft="plus" loading={busy === "in"} onClick={() => run("in", async () => { const r = await actions.checkInAction(goal.id, { amount, note }); if (r.ok) { setNote(""); setAmount(1); } return r; }, "Added")}>Add {amount}{p.unit ? ` ${p.unit}` : ""}</Button></div><Input placeholder="A note (optional)" value={note} onChange={(e) => setNote(e.target.value)} style={{ maxWidth: 320 }} /></div>
            : <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}><span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}>Follows “{goal.savingsGoalName ?? "a savings goal"}” — money moves in Finance.</span>{isOwner ? <Button size="sm" variant="secondary" iconRight="arrow-up-right" onClick={() => router.push("/finance?section=savings")}>Open in Finance</Button> : null}</div>
          ) : goal.completedAt && canEdit ? <Button size="sm" variant="ghost" iconLeft="rotate-ccw" loading={busy === "reopen"} onClick={() => run("reopen", () => actions.reopenGoalAction(goal.id), "Reopened")}>Reopen</Button> : null}
        </div>
      </Reveal>

      <Stagger gap={24} start={2}>
        <Section title="Who’s in" action={goal.participants.length ? <AvatarStack size="sm" people={goal.participants.map((id) => { const x = person(id); return { name: x?.name, src: x?.avatarUrl ?? undefined, person: x?.hue }; })} /> : undefined}>
          {goal.participants.length ? <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>{goal.participants.map((id) => { const x = person(id); return x ? <div key={id} style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={x.name} src={x.avatarUrl} person={x.hue} size="sm" /><span style={{ font: "var(--type-body-sm)" }}>{x.greetingName}</span></div> : null; })}</div> : <span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}>Nobody yet — add people in settings.</span>}
        </Section>
        {goal.progressKind !== "savings" && goal.progressKind !== "checkoff" ? (
          <Section title="Check-ins" action={goal.checkins.length ? <Badge tone="neutral">{goal.checkins.length}</Badge> : undefined}>
            {goal.checkins.length ? <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{goal.checkins.slice(0, 60).map((c) => { const x = person(c.memberId); const mine = c.memberId === me; return <Row key={c.id} avatar={x ? { name: x.name, src: x.avatarUrl, person: x.hue } : undefined} icon={x ? undefined : "check"} tint="mint" title={goal.progressKind === "count" ? `+${c.amount}${p.unit ? ` ${p.unit}` : ""}${x ? ` · ${x.greetingName}` : ""}` : x ? `${x.greetingName} did it` : "Done"} meta={[c.day === todayISO ? "Today" : fmtNight(c.day), c.note].filter(Boolean).join(" · ")} trailing={mine || isOwner || goal.createdBy === me ? <IconButton icon="x" label="Undo" size="sm" onClick={() => run(`undo-${c.id}`, () => actions.undoCheckInAction(goal.id, c.id), "Undone")} /> : undefined} chevron={false} />; })}</div> : <EmptyState compact icon={goal.progressKind === "streak" ? "calendar-check" : "list-checks"} title="No check-ins yet" body={goal.progressKind === "streak" ? "Tap “Did it today” and the streak starts." : "Add progress as it happens."} style={{ padding: "4px 0" }} />}
          </Section>
        ) : null}
        <Section title="Who can see it"><Badge tone="neutral">{goal.visibility === "family" ? "Everyone in the family" : goal.visibility === "private" ? "Just the person who made it (and the owner)" : `Shared with ${goal.sharedWith.map((id) => person(id)?.greetingName).filter(Boolean).join(", ") || "nobody yet"}`}</Badge></Section>
      </Stagger>

      {settings ? <GoalSheet open onClose={() => setSettings(false)} goal={goal} people={people} me={me} savingsOptions={savingsOptions} canDelete={isOwner || goal.createdBy === me} onSaved={() => { toast({ title: "Saved", tone: "positive" }); router.refresh(); }} onDeleted={() => router.push("/goals")} /> : null}
      <BottomSheet open={cover} onClose={() => setCover(false)} title="Choose a cover" footer={<>{goal.coverPhotoId ? <Button size="lg" fullWidth variant="ghost" onClick={() => run("cover", async () => { const r = await actions.setGoalCoverAction(goal.id, null); setCover(false); return r; }, "Cover removed")}>Remove cover</Button> : null}<Button size="lg" fullWidth variant="ghost" onClick={() => setCover(false)}>Cancel</Button></>}>
        {!recentPhotos.length ? <EmptyState compact icon="image" title="No photos yet" body="Add photos to the library first, then pick one here." action={<Button size="sm" onClick={() => router.push("/photos?add=1")}>Add photos</Button>} /> : <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>{recentPhotos.map((ph) => <ImageCard key={ph.id} src={ph.thumb ?? ph.src} ratio="1 / 1" selected={goal.coverPhotoId === ph.id} onClick={() => run("cover", async () => { const r = await actions.setGoalCoverAction(goal.id, ph.id); setCover(false); return r; }, "Cover set")} />)}</div>}
      </BottomSheet>
    </div>
  );
}

export function GoalClient(props: React.ComponentProps<typeof Inner>) {
  return <ToastProvider><Inner {...props} /></ToastProvider>;
}
