"use client";
/** Goals — what the family is working toward, with progress you can feel. */
import * as React from "react";
import { useRouter } from "next/navigation";
import { AvatarStack, Badge, Button, EmptyState, Icon, ProgressBar, ProgressRing, Reveal, SegmentedControl, Stagger, ToastProvider, useToast, money } from "@/ui";
import type { Goal } from "@/db/goals";
import { fmtShort } from "@/lib/dates";
import { GoalSheet, KIND_LABEL, type PersonLite, type SavingsOption } from "./goal-sheet";

export function progressLine(g: Pick<Goal, "progress" | "progressKind">): string {
  const p = g.progress;
  if (g.progressKind === "savings") return `${money(p.current, { cents: false })} of ${money(p.target ?? 0, { cents: false })}`;
  if (g.progressKind === "count") return `${p.current} of ${p.target ?? "?"}${p.unit ? ` ${p.unit}` : ""}`;
  if (g.progressKind === "streak") return `${p.current} of ${p.target ?? "?"} days${p.streak > 1 ? ` · ${p.streak}-day streak` : ""}`;
  return p.done ? "Done" : "Not yet";
}

function Inner({ goals, people, me, isOwner, todayISO, savingsOptions, addOpen }: { goals: Goal[]; people: PersonLite[]; me: string | null; isOwner: boolean; todayISO: string; savingsOptions: SavingsOption[]; addOpen: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = React.useState("active");
  const [open, setOpen] = React.useState(addOpen);
  const active = goals.filter((g) => !g.completedAt);
  const done = goals.filter((g) => !!g.completedAt);
  const shown = tab === "done" ? done : tab === "mine" ? active.filter((g) => me && g.participants.includes(me)) : active;
  const person = (id: string) => people.find((p) => p.id === id);
  const GoalCard = ({ g }: { g: Goal }) => {
    const due = g.dueOn ? Math.round((Date.parse(g.dueOn) - Date.parse(todayISO)) / 86400000) : null;
    return (
      <button type="button" onClick={() => router.push(`/goals/${g.id}`)} style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "left", padding: 0, border: 0, background: "transparent", cursor: "pointer", font: "inherit", color: "inherit", borderRadius: "var(--radius-lg)" }}>
        {g.cover ? <div style={{ position: "relative", aspectRatio: "16 / 9", borderRadius: "var(--radius-photo)", overflow: "hidden", background: "var(--surface-sunken)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL; next/image can't optimise it */}
          <img src={g.cover} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "var(--scrim-bottom)" }} /><div style={{ position: "absolute", left: 14, right: 14, bottom: 12, color: "var(--text-on-photo)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><span style={{ font: "var(--type-h3)" }}>{g.title}</span>{g.progress.done ? <Badge tone="positive" solid icon="circle-check">Done</Badge> : null}</div></div> : null}
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {!g.cover ? <ProgressRing value={g.progress.value} size={56} thickness={6} tone={g.progress.done ? "positive" : g.hue ? `var(--person-${g.hue})` : "accent"} celebrate={false}><Icon name={KIND_LABEL[g.progressKind].icon} size={20} color={g.progress.done ? "var(--positive)" : "var(--text-secondary)"} /></ProgressRing> : null}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ font: "var(--type-overline)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: "var(--text-tertiary)" }}>{g.kind === "family" ? "Family" : "Personal"} · {KIND_LABEL[g.progressKind].label}{due != null && !g.completedAt ? ` · ${due < 0 ? `${-due}d overdue` : due === 0 ? "due today" : `${due}d left`}` : ""}</span>
            {!g.cover ? <span style={{ font: "var(--type-h3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.title}</span> : null}
            <span style={{ font: "var(--type-body-sm)", color: "var(--text-secondary)" }}>{progressLine(g)}{g.completedAt ? ` · finished ${fmtShort(g.completedAt.slice(0, 10))}` : ""}</span>
          </div>
          {g.participants.length ? <AvatarStack size="sm" max={3} people={g.participants.map((id) => { const p = person(id); return { name: p?.name, src: p?.avatarUrl ?? undefined, person: p?.hue }; })} /> : null}
        </div>
        {g.progressKind !== "checkoff" ? <ProgressBar value={g.progress.value} size="sm" tone={g.progress.done ? "positive" : g.progressKind === "savings" ? "accent" : "info"} /> : null}
      </button>
    );
  };
  return (
    <div style={{ width: "100%", maxWidth: "var(--content-max)", margin: "0 auto", padding: "16px var(--page-gutter-mobile) 64px", display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      <Reveal>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div><p style={{ margin: "0 0 6px", font: "var(--type-overline)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Goals</p><h1 style={{ margin: 0, font: "var(--type-greeting)", fontSize: "clamp(var(--fs-3xl), 5vw, var(--fs-4xl))", letterSpacing: "var(--ls-display)" }}>What we’re working toward</h1></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <SegmentedControl size="sm" items={[{ key: "active", label: active.length ? `Family · ${active.length}` : "Family" }, { key: "mine", label: "Mine" }, { key: "done", label: done.length ? `Done · ${done.length}` : "Done" }]} value={tab} onChange={setTab} />
            <Button iconLeft="plus" onClick={() => setOpen(true)}>New goal</Button>
          </div>
        </div>
      </Reveal>
      {!shown.length ? <Reveal index={1}><EmptyState icon="target" title={tab === "done" ? "Nothing finished yet" : tab === "mine" ? "No goals of your own yet" : "No goals yet"} body={tab === "done" ? "When a goal is reached it moves here — with who did it and when." : "Pick one thing to work toward — a trip to save for, a habit to build, something to finish together."} action={tab !== "done" ? <Button iconLeft="plus" onClick={() => setOpen(true)}>Start a goal</Button> : undefined} /></Reveal> : (
        <Stagger gap={28} start={1}><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))", gap: "28px 32px" }}>{shown.map((g) => <GoalCard key={g.id} g={g} />)}</div></Stagger>
      )}
      {open ? <GoalSheet open onClose={() => { setOpen(false); if (addOpen) router.replace("/goals"); }} people={people} me={me} savingsOptions={savingsOptions} onSaved={(id, created) => { toast({ title: created ? "Goal started" : "Saved", tone: "positive" }); if (created) router.push(`/goals/${id}`); else router.refresh(); }} /> : null}
      {isOwner ? null : null}
    </div>
  );
}

export function GoalsClient(props: React.ComponentProps<typeof Inner>) {
  return <ToastProvider><Inner {...props} /></ToastProvider>;
}
