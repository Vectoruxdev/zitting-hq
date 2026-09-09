"use client";
/** New / edit goal — shared by the list and the detail page. */
import * as React from "react";
import { BottomSheet, Button, Checkbox, Input, RadioGroup, SegmentedControl, Select, Textarea, money } from "@/ui";
import type { Goal, GoalKind, ProgressKind } from "@/db/goals";
import * as actions from "./actions";

export interface PersonLite { id: string; name: string; greetingName: string; hue: number; avatarUrl: string | null; kind: "adult" | "child" }
export interface SavingsOption { id: string; name: string; saved: number; target: number }

export const KIND_LABEL: Record<ProgressKind, { label: string; hint: string; icon: string }> = {
  checkoff: { label: "Just finish it", hint: "Done or not done", icon: "circle-check" },
  count: { label: "Reach a number", hint: "Books read, miles run", icon: "list-checks" },
  streak: { label: "Do it daily", hint: "Build a streak", icon: "calendar-check" },
  savings: { label: "Save up", hint: "Follows a savings goal", icon: "piggy-bank" },
};

export function GoalSheet({ open, onClose, goal, people, me, savingsOptions, onSaved, canDelete, onDeleted }: { open: boolean; onClose: () => void; goal?: Goal | null; people: PersonLite[]; me: string | null; savingsOptions: SavingsOption[]; onSaved: (id: string, created: boolean) => void; canDelete?: boolean; onDeleted?: () => void }) {
  const editing = !!goal;
  const [title, setTitle] = React.useState(goal?.title ?? "");
  const [description, setDescription] = React.useState(goal?.description ?? "");
  const [kind, setKind] = React.useState<GoalKind>(goal?.kind ?? "family");
  const [progressKind, setProgressKind] = React.useState<ProgressKind>(goal?.progressKind ?? "checkoff");
  const [target, setTarget] = React.useState(goal?.target != null ? String(goal.target) : progressKind === "streak" ? "30" : "");
  const [unit, setUnit] = React.useState(goal?.unit ?? "");
  const [savingsGoalId, setSavingsGoalId] = React.useState(goal?.savingsGoalId ?? "");
  const [dueOn, setDueOn] = React.useState(goal?.dueOn ?? "");
  const [participants, setParticipants] = React.useState<string[]>(goal?.participants ?? (me ? [me] : []));
  const [visibility, setVisibility] = React.useState(goal?.visibility ?? "family");
  const [shared, setShared] = React.useState<string[]>(goal?.sharedWith ?? []);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState(false);
  const pickKind = (k: GoalKind) => { setKind(k); if (!editing) { setVisibility(k === "personal" ? "private" : "family"); setParticipants(k === "personal" ? (me ? [me] : []) : people.map((p) => p.id)); } };
  const pickProgress = (k: ProgressKind) => { setProgressKind(k); if (k === "streak" && !target) setTarget("30"); if (k === "count" && target === "30") setTarget(""); };
  const save = async () => {
    setBusy(true); setError(null);
    const payload = { title, description, kind, progressKind, target: target ? Number(target) : null, unit, savingsGoalId: savingsGoalId || null, dueOn: dueOn || null, visibility, sharedWith: shared, participants };
    if (editing) {
      const r = await actions.updateGoalAction(goal!.id, payload);
      setBusy(false);
      if (r.ok) { onSaved(goal!.id, false); onClose(); } else setError(r.error || "That didn't save");
    } else {
      const r = await actions.createGoalAction(payload);
      setBusy(false);
      if (r.ok) { onSaved(r.id, true); onClose(); } else setError(r.error || "That didn't save");
    }
  };
  return (
    <BottomSheet open={open} onClose={onClose} title={editing ? "Edit goal" : "New goal"} footer={<><Button size="lg" fullWidth loading={busy} disabled={!title.trim()} onClick={save}>{editing ? "Save" : "Start the goal"}</Button>{editing && canDelete ? (confirm ? <Button size="lg" fullWidth variant="danger" onClick={async () => { setBusy(true); await actions.deleteGoalAction(goal!.id); setBusy(false); onDeleted?.(); onClose(); }}>Really delete</Button> : <Button size="lg" fullWidth variant="ghost" onClick={() => setConfirm(true)}>Delete</Button>) : <Button size="lg" fullWidth variant="ghost" onClick={onClose}>Cancel</Button>}</>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <SegmentedControl items={[{ key: "family", label: "Family goal", icon: "users" }, { key: "personal", label: "Just mine", icon: "user" }]} value={kind} onChange={(k) => pickKind(k as GoalKind)} style={{ alignSelf: "flex-start" }} />
        <Input label="Goal" placeholder={kind === "family" ? "Read together every night" : "Run a 10k"} value={title} onChange={(e) => setTitle(e.target.value)} error={error ?? undefined} />
        <RadioGroup label="How we'll measure it" layout="cards" columns={2} value={progressKind} onChange={(v) => pickProgress(v as ProgressKind)} options={(Object.keys(KIND_LABEL) as ProgressKind[]).map((k) => ({ value: k, label: KIND_LABEL[k].label, hint: KIND_LABEL[k].hint, icon: KIND_LABEL[k].icon }))} />
        {progressKind === "count" ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><Input label="Target" type="number" inputMode="numeric" placeholder="20" value={target} onChange={(e) => setTarget(e.target.value)} /><Input label="Of what" placeholder="books" value={unit} onChange={(e) => setUnit(e.target.value)} /></div> : null}
        {progressKind === "streak" ? <Input label="How many days" type="number" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} hint="Check in once a day; the streak shows on the goal." /> : null}
        {progressKind === "savings" ? (savingsOptions.length ? <Select label="Savings goal in Finance" value={savingsGoalId} placeholder="Choose…" options={savingsOptions.map((o) => ({ value: o.id, label: `${o.name} · ${money(o.saved, { cents: false })} of ${money(o.target, { cents: false })}` }))} onChange={(e) => setSavingsGoalId(e.target.value)} /> : <p style={{ margin: 0, font: "var(--type-body-sm)", color: "var(--text-secondary)" }}>No savings goals yet — make one in Finance first, then link it here.</p>) : null}
        <Textarea label="Why it matters (optional)" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        <Input label="By when (optional)" type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
        <div><span style={{ font: "var(--type-label)", color: "var(--text-secondary)" }}>Who’s in</span><div style={{ display: "flex", flexWrap: "wrap", gap: "0 14px" }}>{people.map((p) => <Checkbox key={p.id} label={p.greetingName} checked={participants.includes(p.id)} onChange={(v) => setParticipants((s) => (v ? [...s, p.id] : s.filter((i) => i !== p.id)))} style={{ minHeight: 36, padding: "6px 0" }} />)}</div></div>
        <RadioGroup label="Who can see it" layout="cards" columns={3} value={visibility} onChange={setVisibility} options={[{ value: "family", label: "Family" }, { value: "custom", label: "Some people" }, { value: "private", label: "Just me" }]} />
        {visibility === "custom" ? <div style={{ display: "flex", flexWrap: "wrap", gap: "0 14px" }}>{people.filter((p) => p.id !== me).map((p) => <Checkbox key={p.id} label={p.greetingName} checked={shared.includes(p.id)} onChange={(v) => setShared((s) => (v ? [...s, p.id] : s.filter((i) => i !== p.id)))} style={{ minHeight: 36, padding: "6px 0" }} />)}</div> : null}
      </div>
    </BottomSheet>
  );
}
