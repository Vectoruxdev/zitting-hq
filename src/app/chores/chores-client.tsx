"use client";
/**
 * Chores — today's list per person with big check-offs (kitchen tablet),
 * the week chart with streaks and points, and the schedule for grown-ups.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { Avatar, Badge, BottomSheet, Button, Celebrate, Checkbox, EmptyState, Icon, IconButton, Input, Reveal, Row, Section, SegmentedControl, Select, Stagger, Stepper, Tabs, Tag, Toggle, ToastProvider, useToast } from "@/ui";
import type { Chore, Completion, TimeOfDay } from "@/db/chores";
import { WEEKDAYS_SHORT, fmtNight } from "@/lib/dates";
import * as actions from "./actions";

export interface PersonLite { id: string; name: string; greetingName: string; hue: number; avatarUrl: string | null; kind: "adult" | "child" }
interface Props { chores: Chore[]; completions: Completion[]; people: PersonLite[]; me: string | null; isAdult: boolean; todayISO: string; dayISO: string; week: string[]; initialTab: string }

const ICONS = ["square-check", "bed", "trash-2", "utensils", "cooking-pot", "refrigerator", "shopping-basket", "book-open", "leaf", "dumbbell", "school", "baby", "heart", "star", "sparkles", "sun", "moon", "activity", "clipboard-list", "folder"];
const TIMES: { key: TimeOfDay; label: string }[] = [{ key: "morning", label: "Morning" }, { key: "afternoon", label: "Afternoon" }, { key: "evening", label: "Evening" }, { key: "any", label: "Anytime" }];
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const weekdayOf = (iso: string) => new Date(iso + "T00:00:00Z").getUTCDay();
const isDue = (c: Chore, iso: string) => c.active && c.days.includes(String(weekdayOf(iso)));
export function daysLabel(days: string): string {
  if (days.length === 7) return "Every day";
  if (days === "12345") return "Weekdays";
  if (days === "06") return "Weekends";
  return days.split("").map((d) => WEEKDAYS_SHORT[Number(d)]).join(" ");
}

function Inner(p: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = React.useState(p.initialTab);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [fire, setFire] = React.useState(0);
  const [whoSheet, setWhoSheet] = React.useState<Chore | null>(null);
  const [edit, setEdit] = React.useState<{ chore?: Chore } | null>(null);
  const person = (id: string | null) => p.people.find((x) => x.id === id) || null;
  const go = (day: string, t = tab) => router.push(`/chores?day=${day}&tab=${t}`);
  const run = async (key: string, fn: () => Promise<{ ok: boolean; error?: string } | undefined>, done?: string) => { setBusy(key); try { const r = await fn(); if (r && !r.ok) toast({ title: r.error || "That didn't save", tone: "negative" }); else if (done) toast({ title: done, tone: "positive" }); router.refresh(); } finally { setBusy(null); } };
  const compFor = (choreId: string, day: string) => p.completions.find((c) => c.choreId === choreId && c.day === day);
  const ordered = [...p.people].sort((a, b) => Number(a.kind === "adult") - Number(b.kind === "adult"));
  const groups = [...ordered.map((x) => ({ key: x.id, who: x as PersonLite | null, due: p.chores.filter((c) => c.assigneeMemberId === x.id && isDue(c, p.dayISO)) })), { key: "shared", who: null, due: p.chores.filter((c) => !c.assigneeMemberId && isDue(c, p.dayISO)) }].filter((g) => g.due.length);
  const toggle = async (chore: Chore, done: boolean, memberId?: string | null) => {
    const groupDue = groups.find((g) => (g.who?.id ?? null) === chore.assigneeMemberId)?.due ?? [];
    const wasLeft = groupDue.filter((c) => !compFor(c.id, p.dayISO)).length;
    await run(`c-${chore.id}`, () => (done ? actions.completeChoreAction(chore.id, p.dayISO, memberId) : actions.uncompleteChoreAction(chore.id, p.dayISO)));
    if (done && wasLeft === 1 && groupDue.length > 1) setFire((f) => f + 1);
  };
  const dayTitle = p.dayISO === p.todayISO ? "Today" : p.dayISO === addDays(p.todayISO, -1) ? "Yesterday" : p.dayISO === addDays(p.todayISO, 1) ? "Tomorrow" : fmtNight(p.dayISO);
  const dayFor = (memberId: string, day: string) => { const due = p.chores.filter((c) => c.assigneeMemberId === memberId && isDue(c, day)); const done = due.filter((c) => compFor(c.id, day)); return { due: due.length, done: done.length, points: done.filter((c) => !c.needsCheck || compFor(c.id, day)?.checkedAt).reduce((a, c) => a + c.points, 0), possible: due.reduce((a, c) => a + c.points, 0) }; };
  const streak = (memberId: string) => { const mine = p.chores.filter((c) => c.assigneeMemberId === memberId); if (!mine.length) return 0; const complete = (iso: string) => { const due = mine.filter((c) => isDue(c, iso)); return due.length ? due.every((c) => compFor(c.id, iso)) : null; }; let d = p.todayISO, n = 0; if (complete(d) === false) d = addDays(d, -1); for (let i = 0; i < 60; i++) { const r = complete(d); if (r === false) break; if (r === true) n++; d = addDays(d, -1); } return n; };
  const chartPeople = ordered.filter((x) => p.chores.some((c) => c.assigneeMemberId === x.id));
  const toCheck = p.chores.filter((c) => c.needsCheck).map((c) => ({ c, comp: compFor(c.id, p.dayISO) })).filter((x) => x.comp && !x.comp.checkedAt);

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: "var(--content-max)", margin: "0 auto", padding: "16px var(--page-gutter-mobile) 64px", display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      <Celebrate fire={fire} origin="top" />
      <Reveal>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div><p style={{ margin: "0 0 6px", font: "var(--type-overline)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Chores</p><h1 style={{ margin: 0, font: "var(--type-greeting)", fontSize: "clamp(var(--fs-3xl), 5vw, var(--fs-4xl))", letterSpacing: "var(--ls-display)" }}>{tab === "chart" ? "This week" : tab === "manage" ? "The schedule" : dayTitle}</h1></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {tab !== "manage" ? <><IconButton icon="chevron-left" label="Previous" size="sm" variant="outline" onClick={() => go(addDays(p.dayISO, tab === "chart" ? -7 : -1))} /><IconButton icon="chevron-right" label="Next" size="sm" variant="outline" onClick={() => go(addDays(p.dayISO, tab === "chart" ? 7 : 1))} />{p.dayISO !== p.todayISO ? <Button size="sm" variant="ghost" onClick={() => go(p.todayISO)}>Today</Button> : null}</> : null}
            {p.isAdult ? <Button iconLeft="plus" onClick={() => setEdit({})}>New chore</Button> : null}
          </div>
        </div>
      </Reveal>
      <Reveal index={1}><Tabs items={[{ key: "today", label: "Today" }, { key: "chart", label: "Chart" }, ...(p.isAdult ? [{ key: "manage", label: "Schedule", count: p.chores.length || undefined }] : [])]} value={tab} onChange={(t) => { setTab(t); router.replace(`/chores?day=${p.dayISO}&tab=${t}`, { scroll: false }); }} /></Reveal>

      {tab === "today" ? (
        !p.chores.length ? <Reveal index={2}><EmptyState icon="square-check" title="No chores set up" body="Add each kid's chores once — which days, morning or evening, how many points — and this becomes the tablet's checklist." action={p.isAdult ? <Button iconLeft="plus" onClick={() => setEdit({})}>Add the first chore</Button> : undefined} /></Reveal>
        : !groups.length ? <Reveal index={2}><EmptyState icon="sun" title="Nothing due" body={`No chores fall on ${dayTitle.toLowerCase()}.`} /></Reveal>
        : (
          <Stagger gap={24} start={2}>
            {p.isAdult && toCheck.length ? <Section title="Needs a check" action={<Badge tone="warning">{toCheck.length}</Badge>}><div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{toCheck.map(({ c, comp }) => { const x = person(comp!.memberId ?? c.assigneeMemberId); return <Row key={c.id} avatar={x ? { name: x.name, src: x.avatarUrl, person: x.hue } : undefined} icon={x ? undefined : c.icon ?? "square-check"} tint="butter" title={c.title} meta={x ? `${x.greetingName} says it's done` : "Marked done"} trailing={<Button size="sm" iconLeft="badge-check" loading={busy === `k-${comp!.id}`} onClick={() => run(`k-${comp!.id}`, () => actions.checkChoreAction(comp!.id, true), "Checked")}>Check</Button>} chevron={false} />; })}</div></Section> : null}
            {groups.map((g) => {
              const done = g.due.filter((c) => compFor(c.id, p.dayISO));
              const pts = done.filter((c) => !c.needsCheck || compFor(c.id, p.dayISO)?.checkedAt).reduce((a, c) => a + c.points, 0);
              const all = done.length === g.due.length;
              return (
                <Section key={g.key} title={g.who ? g.who.greetingName : "Anyone"} action={<span style={{ display: "flex", alignItems: "center", gap: 8 }}><Badge tone={all ? "positive" : "neutral"} icon={all ? "circle-check" : undefined}>{done.length}/{g.due.length}{g.who ? ` · ${pts} pt${pts === 1 ? "" : "s"}` : ""}</Badge>{g.who ? <Avatar name={g.who.name} src={g.who.avatarUrl} person={g.who.hue} size="sm" /> : null}</span>}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {g.due.map((c) => { const comp = compFor(c.id, p.dayISO); const doer = comp ? person(comp.memberId) : null; return (
                      <Row key={c.id} leading={<Checkbox checked={!!comp} size="lg" disabled={busy === `c-${c.id}`} onChange={(v) => { if (v && !g.who && p.people.length > 1) setWhoSheet(c); else toggle(c, v); }} style={{ minHeight: 0, padding: 0 }} />}
                        title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: comp ? "line-through" : "none", opacity: comp ? 0.65 : 1 }}><Icon name={c.icon ?? "square-check"} size={18} color="var(--text-secondary)" />{c.title}</span>}
                        meta={[TIMES.find((t) => t.key === c.timeOfDay)?.label !== "Anytime" ? TIMES.find((t) => t.key === c.timeOfDay)?.label : null, `${c.points} pt${c.points === 1 ? "" : "s"}`, !g.who && doer ? `${doer.greetingName} did it` : null].filter(Boolean).join(" · ")}
                        trailing={c.needsCheck && comp ? (comp.checkedAt ? <Badge tone="positive" icon="badge-check">Checked</Badge> : p.isAdult ? <Button size="sm" variant="soft" iconLeft="badge-check" loading={busy === `k-${comp.id}`} onClick={() => run(`k-${comp.id}`, () => actions.checkChoreAction(comp.id, true), "Checked")}>Check</Button> : <Badge tone="warning">Waiting for a check</Badge>) : c.needsCheck ? <Badge tone="neutral" size="sm">Gets checked</Badge> : undefined}
                        chevron={false} style={{ minHeight: 56 }} />
                    ); })}
                    {all ? <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0 0", font: "var(--type-body-sm)", color: "var(--positive)" }}><Icon name="party-popper" size={18} />All done{g.who ? `, ${g.who.greetingName}` : ""}</div> : null}
                  </div>
                </Section>
              );
            })}
          </Stagger>
        )
      ) : null}

      {tab === "chart" ? (
        !chartPeople.length ? <Reveal index={2}><EmptyState icon="layout-grid" title="No one has chores yet" body="Assign chores to people and the week chart fills in here." /></Reveal> : (
          <Stagger gap={24} start={2}>
            <div style={{ overflowX: "auto", margin: "0 calc(-1 * var(--page-gutter-mobile))", padding: "0 var(--page-gutter-mobile)" }}>
              <div style={{ display: "grid", gridTemplateColumns: `minmax(120px, 1.4fr) repeat(7, minmax(40px, 1fr)) minmax(72px, auto)`, gap: "10px 6px", alignItems: "center", minWidth: 560 }}>
                <span />
                {p.week.map((d) => <span key={d} style={{ textAlign: "center", font: "var(--type-overline)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: d === p.todayISO ? "var(--accent)" : "var(--text-tertiary)" }}>{WEEKDAYS_SHORT[weekdayOf(d)][0]}<br /><span className="zh-num" style={{ font: "500 var(--fs-sm)/1.4 var(--font-num)", color: d === p.todayISO ? "var(--accent)" : "var(--text-secondary)" }}>{Number(d.slice(8))}</span></span>)}
                <span style={{ textAlign: "right", font: "var(--type-overline)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Week</span>
                {chartPeople.map((x) => { const wk = p.week.map((d) => dayFor(x.id, d)); const total = wk.reduce((a, w) => ({ points: a.points + w.points, possible: a.possible + w.possible }), { points: 0, possible: 0 }); const st = streak(x.id); return (
                  <React.Fragment key={x.id}>
                    <button type="button" onClick={() => go(p.dayISO, "today")} style={{ display: "flex", alignItems: "center", gap: 10, border: 0, background: "transparent", padding: "4px 0", cursor: "pointer", font: "inherit", color: "inherit", textAlign: "left", minWidth: 0 }}><Avatar name={x.name} src={x.avatarUrl} person={x.hue} size="sm" /><span style={{ minWidth: 0 }}><span style={{ display: "block", font: "var(--type-body)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.greetingName}</span>{st > 1 ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, font: "var(--type-caption)", color: "var(--accent)" }}><Icon name="sparkles" size={12} />{st}-day streak</span> : null}</span></button>
                    {wk.map((w, i) => { const day = p.week[i]; const future = day > p.todayISO; const frac = w.due ? w.done / w.due : 0; return (
                      <button key={day} type="button" onClick={() => go(day, "today")} aria-label={`${x.greetingName} ${fmtNight(day)}: ${w.done} of ${w.due}`} style={{ display: "grid", placeItems: "center", border: 0, background: "transparent", padding: 2, cursor: "pointer" }}>
                        <span style={{ width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center", background: !w.due ? "transparent" : future ? "var(--surface-sunken)" : `conic-gradient(${frac >= 1 ? "var(--positive)" : `var(--person-${x.hue})`} ${frac * 360}deg, var(--data-track) 0)`, position: "relative" }}>
                          <span style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--bg-app)", display: "grid", placeItems: "center", font: "500 var(--fs-xs)/1 var(--font-num)", color: !w.due ? "var(--text-tertiary)" : frac >= 1 ? "var(--positive)" : "var(--text-primary)" }}>{!w.due ? "–" : frac >= 1 ? <Icon name="check" size={14} /> : `${w.done}/${w.due}`}</span>
                        </span>
                      </button>
                    ); })}
                    <span className="zh-num" style={{ textAlign: "right", font: "500 var(--fs-sm)/1.3 var(--font-num)", color: "var(--text-secondary)" }}>{total.points}<span style={{ color: "var(--text-tertiary)" }}>/{total.possible} pts</span></span>
                  </React.Fragment>
                ); })}
              </div>
            </div>
            <p style={{ margin: 0, font: "var(--type-caption)", color: "var(--text-tertiary)" }}>Points count once a chore that needs a check has been checked. A streak is every due chore done, day after day.</p>
          </Stagger>
        )
      ) : null}

      {tab === "manage" && p.isAdult ? (
        !p.chores.length ? <Reveal index={2}><EmptyState icon="clipboard-list" title="No chores yet" body="Start with the ones that happen every day — make the bed, clear the table — then add the weekly ones." action={<Button iconLeft="plus" onClick={() => setEdit({})}>Add a chore</Button>} /></Reveal> : (
          <Stagger gap={24} start={2}>
            {[...ordered.map((x) => ({ key: x.id, who: x as PersonLite | null })), { key: "shared", who: null }].map((g) => { const list = p.chores.filter((c) => c.assigneeMemberId === (g.who?.id ?? null)); if (!list.length) return null; return (
              <Section key={g.key} title={g.who ? g.who.greetingName : "Anyone"} action={g.who ? <Avatar name={g.who.name} src={g.who.avatarUrl} person={g.who.hue} size="sm" /> : undefined}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{list.map((c) => <Row key={c.id} icon={c.icon ?? "square-check"} tint="butter" title={c.title} meta={[daysLabel(c.days), TIMES.find((t) => t.key === c.timeOfDay)?.label !== "Anytime" ? TIMES.find((t) => t.key === c.timeOfDay)?.label : null, `${c.points} pt${c.points === 1 ? "" : "s"}`, c.needsCheck ? "gets checked" : null, !c.active ? "paused" : null].filter(Boolean).join(" · ")} onClick={() => setEdit({ chore: c })} style={{ opacity: c.active ? 1 : 0.6 }} />)}</div>
              </Section>
            ); })}
          </Stagger>
        )
      ) : null}

      <BottomSheet open={!!whoSheet} onClose={() => setWhoSheet(null)} title={whoSheet ? `Who did “${whoSheet.title}”?` : "Who did it?"}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 10 }}>{ordered.map((x) => <button key={x.id} type="button" onClick={() => { const c = whoSheet!; setWhoSheet(null); toggle(c, true, x.id); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "14px 8px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", background: "var(--surface-card)", cursor: "pointer", font: "inherit", color: "inherit" }}><Avatar name={x.name} src={x.avatarUrl} person={x.hue} size="lg" /><span style={{ font: "var(--type-body-sm)", fontWeight: 500 }}>{x.greetingName}</span></button>)}</div>
      </BottomSheet>
      {edit ? <ChoreSheet chore={edit.chore} people={ordered} onClose={() => setEdit(null)} onSaved={(m) => { toast({ title: m, tone: "positive" }); router.refresh(); }} /> : null}
    </div>
  );
}

function ChoreSheet({ chore, people, onClose, onSaved }: { chore?: Chore; people: PersonLite[]; onClose: () => void; onSaved: (msg: string) => void }) {
  const editing = !!chore;
  const [title, setTitle] = React.useState(chore?.title ?? "");
  const [icon, setIcon] = React.useState(chore?.icon ?? "square-check");
  const [who, setWho] = React.useState(chore?.assigneeMemberId ?? (people.find((p) => p.kind === "child")?.id ?? ""));
  const [days, setDays] = React.useState(chore?.days ?? "0123456");
  const [time, setTime] = React.useState<TimeOfDay>(chore?.timeOfDay ?? "any");
  const [points, setPoints] = React.useState(chore?.points ?? 1);
  const [needsCheck, setNeedsCheck] = React.useState(chore?.needsCheck ?? false);
  const [active, setActive] = React.useState(chore?.active ?? true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState(false);
  const toggleDay = (d: number) => setDays((s) => (s.includes(String(d)) ? s.replace(String(d), "") : (s + d).split("").sort().join("")));
  const save = async () => {
    setBusy(true); setError(null);
    const payload = { title, icon, assigneeMemberId: who || null, days, timeOfDay: time, points, needsCheck };
    const r = editing ? await actions.updateChoreAction(chore!.id, { ...payload, active }) : await actions.createChoreAction(payload);
    setBusy(false);
    if (r.ok) { onSaved(editing ? "Saved" : "Chore added"); onClose(); } else setError(r.error || "That didn't save");
  };
  return (
    <BottomSheet open onClose={onClose} title={editing ? "Edit chore" : "New chore"} footer={<><Button size="lg" fullWidth loading={busy} disabled={!title.trim() || !days} onClick={save}>{editing ? "Save" : "Add"}</Button>{editing ? (confirm ? <Button size="lg" fullWidth variant="danger" onClick={async () => { setBusy(true); await actions.deleteChoreAction(chore!.id); setBusy(false); onSaved("Removed"); onClose(); }}>Really delete</Button> : <Button size="lg" fullWidth variant="ghost" onClick={() => setConfirm(true)}>Delete</Button>) : <Button size="lg" fullWidth variant="ghost" onClick={onClose}>Cancel</Button>}</>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Input label="Chore" placeholder="Make the bed" value={title} onChange={(e) => setTitle(e.target.value)} error={error ?? undefined} />
        <div><span style={{ font: "var(--type-label)", color: "var(--text-secondary)" }}>Icon</span><div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>{ICONS.map((i) => <button key={i} type="button" aria-label={i} aria-pressed={icon === i} onClick={() => setIcon(i)} style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", border: icon === i ? "2px solid var(--accent)" : "1px solid var(--border-hairline)", background: icon === i ? "var(--accent-soft)" : "var(--surface-card)", display: "grid", placeItems: "center", cursor: "pointer", color: icon === i ? "var(--accent)" : "var(--text-secondary)" }}><Icon name={i} size={18} /></button>)}</div></div>
        <Select label="Who" value={who} placeholder="Anyone" options={people.map((x) => ({ value: x.id, label: x.greetingName }))} onChange={(e) => setWho(e.target.value)} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}><span style={{ font: "var(--type-label)", color: "var(--text-secondary)" }}>Which days</span><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{WEEKDAYS_SHORT.map((w, d) => <Tag key={w} selected={days.includes(String(d))} onClick={() => toggleDay(d)}>{w}</Tag>)}</div><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><Tag selected={days === "0123456"} onClick={() => setDays("0123456")}>Every day</Tag><Tag selected={days === "12345"} onClick={() => setDays("12345")}>Weekdays</Tag><Tag selected={days === "06"} onClick={() => setDays("06")}>Weekends</Tag></div></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}><span style={{ font: "var(--type-label)", color: "var(--text-secondary)" }}>When</span><SegmentedControl size="sm" items={TIMES.map((t) => ({ key: t.key, label: t.label }))} value={time} onChange={(t) => setTime(t as TimeOfDay)} /></div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}><span style={{ font: "var(--type-label)", color: "var(--text-secondary)" }}>Points</span><Stepper value={points} min={0} max={20} onChange={setPoints} label="Points" size="sm" /></div>
        <Toggle label="A grown-up checks it" description="Points count once it's checked." checked={needsCheck} onChange={setNeedsCheck} />
        {editing ? <Toggle label="Active" description="Paused chores stay in the schedule but aren't due." checked={active} onChange={setActive} /> : null}
      </div>
    </BottomSheet>
  );
}

export function ChoresClient(props: Props) {
  return <ToastProvider><Inner {...props} /></ToastProvider>;
}
