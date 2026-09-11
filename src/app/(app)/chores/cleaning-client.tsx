"use client";
/**
 * Cleaning — what is open today for you and for everyone else (kids first),
 * what is coming up, the week chart with hand-offs, and the lists themselves.
 * Kids have no logins: an adult ticks for them, and both parents see the same
 * kid cards.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { Avatar, Badge, BottomSheet, Button, Card, Celebrate, Checkbox, EmptyState, Icon, IconButton, Input, Reveal, Row, Section, SegmentedControl, Select, Stagger, Stepper, Tabs, Tag, Textarea, Toggle, ToastProvider, useToast } from "@/ui";
import { addDays, assigneeFor, rhythmLabel, upcoming, weekStart, weekdayOf, WEEKDAY_NAMES, type Assign, type Rhythm, type TimeOfDay } from "@/lib/cleaning/schedule";
import { dayStats, openOn, streak, LIST_ICONS, LIST_TINTS, TASK_ICONS, type CleaningCompletion, type CleaningList, type CleaningTask, type Handoff, type ListVisibility, type OpenItem } from "@/lib/cleaning/view";
import { WEEKDAYS_SHORT, fmtNight, fmtShort } from "@/lib/dates";
import * as actions from "./actions";

export interface PersonLite { id: string; name: string; greetingName: string; hue: number; avatarUrl: string | null; kind: "adult" | "child" }
export interface TemplateLite { key: string; name: string; icon: string; body: string; count: number }
interface Props { lists: CleaningList[]; tasks: CleaningTask[]; completions: CleaningCompletion[]; handoffs: Handoff[]; people: PersonLite[]; me: string | null; isAdult: boolean; todayISO: string; dayISO: string; initialTab: string; templates: TemplateLite[]; /** Open the new-task sheet straight away (the Add button on the tab bar). */ openNew?: boolean }

const TIMES: { key: TimeOfDay; label: string }[] = [{ key: "morning", label: "Morning" }, { key: "afternoon", label: "Afternoon" }, { key: "evening", label: "Evening" }, { key: "any", label: "Anytime" }];
const timeLabel = (t: TimeOfDay) => (t === "any" ? null : TIMES.find((x) => x.key === t)?.label ?? null);
const ORDINALS = Array.from({ length: 28 }, (_, i) => String(i + 1));
type Result = { ok: boolean; error?: string } | undefined;

/** "by Sat", "due today", "overdue", … for week / month / once items; nothing for today's day tasks. */
function dueLabel(item: OpenItem, todayISO: string): string | null {
  const d = item.occ.dueISO;
  if (item.occ.period === "day") return null;
  if (d === todayISO) return "due today";
  if (d < todayISO) return `overdue · was ${fmtShort(d)}`;
  return item.occ.period === "week" && weekStart(d) === weekStart(todayISO) ? `by ${WEEKDAYS_SHORT[weekdayOf(d)]}` : `by ${fmtShort(d)}`;
}

function Inner(p: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = React.useState(p.initialTab);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [fire, setFire] = React.useState(0);
  const [whoSheet, setWhoSheet] = React.useState<OpenItem | null>(null);
  const [handSheet, setHandSheet] = React.useState<OpenItem | null>(null);
  const [editTask, setEditTask] = React.useState<{ task?: CleaningTask; listId?: string } | null>(p.openNew && p.isAdult && p.lists.length ? { listId: p.lists[0].id } : null);
  const [editList, setEditList] = React.useState<{ list?: CleaningList } | null>(null);
  const person = React.useCallback((id: string | null) => p.people.find((x) => x.id === id) || null, [p.people]);
  const go = (day: string, t = tab) => router.push(`/chores?day=${day}&tab=${t}`);
  const run = async (key: string, fn: () => Promise<Result>, done?: string) => {
    setBusy(key);
    try { const r = await fn(); if (r && !r.ok) toast({ title: r.error || "That didn't save", tone: "negative" }); else if (done) toast({ title: done, tone: "positive" }); }
    catch (e) { toast({ title: e instanceof Error ? e.message : "That didn't work", tone: "negative" }); }
    finally { setBusy(null); }
  };

  const items = React.useMemo(() => openOn(p.dayISO, p.tasks, p.lists, p.completions, p.handoffs), [p.dayISO, p.tasks, p.lists, p.completions, p.handoffs]);
  const ordered = React.useMemo(() => [...p.people].sort((a, b) => Number(a.kind === "adult") - Number(b.kind === "adult")), [p.people]);
  const mine = items.filter((i) => i.assignee === p.me || i.assignee === null);
  const others = ordered.filter((x) => x.id !== p.me).map((who) => ({ who, items: items.filter((i) => i.assignee === who.id) })).filter((g) => g.items.length);
  const comingUp = React.useMemo(() => upcoming(p.tasks, addDays(p.dayISO, 1), 7).map((occ) => { const task = p.tasks.find((t) => t.id === occ.taskId)!; const list = p.lists.find((l) => l.id === task.listId); const hand = p.handoffs.find((h) => h.taskId === task.id && h.periodKey === occ.periodKey); return { occ, task, list, assignee: assigneeFor(task, occ.periodKey, hand?.memberId) }; }), [p.tasks, p.lists, p.handoffs, p.dayISO]);
  const toCheck = items.filter((i) => i.task.needsCheck && i.completion && !i.completion.checkedAt);
  const dayTitle = p.dayISO === p.todayISO ? "Today" : p.dayISO === addDays(p.todayISO, -1) ? "Yesterday" : p.dayISO === addDays(p.todayISO, 1) ? "Tomorrow" : fmtNight(p.dayISO);
  const week = React.useMemo(() => { const s = weekStart(p.dayISO); return Array.from({ length: 7 }, (_, i) => addDays(s, i)); }, [p.dayISO]);
  const weekItems = React.useMemo(() => week.map((d) => openOn(d, p.tasks, p.lists, p.completions, p.handoffs)), [week, p.tasks, p.lists, p.completions, p.handoffs]);
  const weekJobs = React.useMemo(() => openOn(week[0], p.tasks, p.lists, p.completions, p.handoffs).filter((i) => i.occ.period !== "day"), [week, p.tasks, p.lists, p.completions, p.handoffs]);
  const chartPeople = ordered.filter((x) => weekItems.some((day) => day.some((i) => i.occ.period === "day" && i.assignee === x.id)));

  const toggle = async (item: OpenItem, done: boolean, memberId?: string | null) => {
    const wasLeft = mine.filter((i) => !i.completion).length;
    await run(`c-${item.task.id}`, () => (done ? actions.completeTaskAction(item.task.id, item.occ.periodKey, memberId) : actions.uncompleteTaskAction(item.task.id, item.occ.periodKey)));
    if (done && mine.some((i) => i.task.id === item.task.id) && wasLeft === 1 && mine.length > 1) setFire((f) => f + 1);
  };
  const onCheck = (item: OpenItem, v: boolean) => {
    if (v && item.assignee === null && p.people.length > 1) setWhoSheet(item);
    else toggle(item, v, item.assignee);
  };
  const whoLabel = (id: string | null) => (id ? person(id)?.greetingName ?? "Someone" : "Anyone");

  const ItemRow = ({ item, showList = true, showWho = false }: { item: OpenItem; showList?: boolean; showWho?: boolean }) => {
    const comp = item.completion;
    const doer = comp ? person(comp.memberId) : null;
    const meta = [showList ? item.list.name : null, dueLabel(item, p.todayISO), timeLabel(item.task.timeOfDay), showWho ? whoLabel(item.assignee) : null, item.task.points ? `${item.task.points} pt${item.task.points === 1 ? "" : "s"}` : null, item.assignee === null && doer ? `${doer.greetingName} did it` : null, item.handoff ? "handed off" : null].filter(Boolean).join(" · ");
    return (
      <Row leading={<Checkbox checked={!!comp} size="lg" disabled={busy === `c-${item.task.id}`} onChange={(v) => onCheck(item, v)} style={{ minHeight: 0, padding: 0 }} />}
        title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: comp ? "line-through" : "none", opacity: comp ? 0.65 : 1 }}><Icon name={item.task.icon ?? "sparkles"} size={18} color="var(--text-secondary)" />{item.task.title}</span>}
        meta={meta || undefined}
        trailing={<span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          {item.task.needsCheck && comp ? (comp.checkedAt ? <Badge tone="positive" icon="badge-check">Checked</Badge> : p.isAdult ? <Button size="sm" variant="soft" iconLeft="badge-check" loading={busy === `k-${comp.id}`} onClick={() => run(`k-${comp.id}`, () => actions.checkTaskAction(comp.id, true), "Checked")}>Check</Button> : <Badge tone="warning">Waiting</Badge>) : null}
          {p.isAdult && !comp && p.people.length > 1 ? <IconButton icon="users" label="Hand off" size="sm" variant="ghost" onClick={() => setHandSheet(item)} /> : null}
        </span>}
        chevron={false} style={{ minHeight: 56 }} />
    );
  };

  const emptyAll = !p.lists.length;

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: "var(--content-max)", margin: "0 auto", padding: "16px var(--page-gutter-mobile) 64px", display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      <Celebrate fire={fire} origin="top" />
      <Reveal>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: "0 0 6px", font: "var(--type-overline)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Cleaning</p>
            <h1 style={{ margin: 0, font: "var(--type-greeting)", fontSize: "clamp(var(--fs-2xl), 5vw, var(--fs-4xl))" }}>{tab === "week" ? `Week of ${fmtShort(week[0])}` : tab === "lists" ? "Lists" : dayTitle}</h1>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {tab !== "lists" ? <><IconButton icon="chevron-left" label="Previous" size="sm" variant="outline" onClick={() => go(addDays(p.dayISO, tab === "week" ? -7 : -1))} /><IconButton icon="chevron-right" label="Next" size="sm" variant="outline" onClick={() => go(addDays(p.dayISO, tab === "week" ? 7 : 1))} />{p.dayISO !== p.todayISO ? <Button size="sm" variant="ghost" onClick={() => go(p.todayISO)}>Today</Button> : null}</> : null}
            {p.isAdult && p.lists.length ? <Button iconLeft="plus" onClick={() => setEditTask({ listId: p.lists[0].id })}>New task</Button> : null}
          </div>
        </div>
      </Reveal>
      <Reveal index={1}><Tabs items={[{ key: "today", label: "Today" }, { key: "week", label: "Week" }, { key: "lists", label: "Lists", count: p.lists.length || undefined }]} value={tab} onChange={(t) => { setTab(t); router.replace(`/chores?day=${p.dayISO}&tab=${t}`); }} /></Reveal>

      {emptyAll ? (
        <Stagger gap={16} start={2}>
          <EmptyState icon="sparkles" title="No cleaning lists yet" body="Start from a template — the daily basics, the Saturday deep clean, the every-so-often jobs — and prune it to your house. Or make your own list." action={p.isAdult ? <Button iconLeft="plus" onClick={() => setEditList({})}>Make a list</Button> : undefined} />
          {p.isAdult ? <TemplateStrip templates={p.templates} lists={p.lists} busy={busy} run={run} /> : null}
        </Stagger>
      ) : null}

      {!emptyAll && tab === "today" ? (
        <Stagger gap={24} start={2}>
          {p.isAdult && toCheck.length ? <Section title="Needs a check" action={<Badge tone="warning">{toCheck.length}</Badge>}><div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{toCheck.map((i) => <ItemRow key={i.task.id} item={i} showWho />)}</div></Section> : null}
          <Section title={p.me ? "Yours" : "Open"} action={<Badge tone={mine.length && mine.every((i) => i.completion) ? "positive" : "neutral"} icon={mine.length && mine.every((i) => i.completion) ? "circle-check" : undefined}>{mine.filter((i) => i.completion).length}/{mine.length}</Badge>}>
            {!mine.length ? <Row icon="sun" tint="butter" title={`Nothing on your list ${dayTitle === "Today" ? "today" : dayTitle.toLowerCase()}`} meta="Enjoy it." chevron={false} /> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {mine.map((i) => <ItemRow key={i.task.id} item={i} />)}
                {mine.every((i) => i.completion) ? <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0 0", font: "var(--type-body-sm)", color: "var(--positive)" }}><Icon name="party-popper" size={18} />All done</div> : null}
              </div>
            )}
          </Section>
          {comingUp.length ? (
            <Section title="Coming up" eyebrow="The next 7 days">
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {comingUp.slice(0, 8).map(({ occ, task, list, assignee }) => <Row key={`${task.id}:${occ.periodKey}`} icon={task.icon ?? "sparkles"} tint="butter" title={task.title} meta={[occ.dueISO === addDays(p.dayISO, 1) ? "Tomorrow" : fmtNight(occ.dueISO), list?.name, whoLabel(assignee)].filter(Boolean).join(" · ")} chevron={false} size="sm" />)}
              </div>
            </Section>
          ) : null}
          {others.map((g) => {
            const done = g.items.filter((i) => i.completion).length;
            const all = done === g.items.length;
            const st = g.who.kind === "child" ? streak(p.tasks, p.lists, p.completions, p.handoffs, g.who.id, p.todayISO) : 0;
            return (
              <Section key={g.who.id} title={g.who.greetingName} action={<span style={{ display: "flex", alignItems: "center", gap: 8 }}>{st > 1 ? <Badge tone="accent" icon="star">{st}-day streak</Badge> : null}<Badge tone={all ? "positive" : "neutral"} icon={all ? "circle-check" : undefined}>{done}/{g.items.length}</Badge><Avatar name={g.who.name} src={g.who.avatarUrl} person={g.who.hue} size="sm" /></span>}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {g.items.map((i) => <ItemRow key={i.task.id} item={i} />)}
                  {all ? <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0 0", font: "var(--type-body-sm)", color: "var(--positive)" }}><Icon name="party-popper" size={18} />All done, {g.who.greetingName}</div> : null}
                </div>
              </Section>
            );
          })}
        </Stagger>
      ) : null}

      {!emptyAll && tab === "week" ? (
        <Stagger gap={24} start={2}>
          {chartPeople.length ? (
            <div style={{ overflowX: "auto", margin: "0 calc(-1 * var(--page-gutter-mobile))", padding: "0 var(--page-gutter-mobile)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(120px, 1.4fr) repeat(7, minmax(40px, 1fr)) minmax(72px, auto)", gap: "10px 6px", alignItems: "center", minWidth: 560 }}>
                <span />
                {week.map((d) => <span key={d} style={{ textAlign: "center", font: "var(--type-overline)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: d === p.todayISO ? "var(--accent)" : "var(--text-tertiary)" }}>{WEEKDAYS_SHORT[weekdayOf(d)]}</span>)}
                <span style={{ textAlign: "right", font: "var(--type-overline)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Week</span>
                {chartPeople.map((x) => {
                  const wk = weekItems.map((day) => dayStats(day, x.id));
                  const total = wk.reduce((a, w) => ({ done: a.done + w.done, due: a.due + w.due, points: a.points + w.points, possible: a.possible + w.possible }), { done: 0, due: 0, points: 0, possible: 0 });
                  const st = x.kind === "child" ? streak(p.tasks, p.lists, p.completions, p.handoffs, x.id, p.todayISO) : 0;
                  return (
                    <React.Fragment key={x.id}>
                      <button type="button" onClick={() => go(p.dayISO, "today")} style={{ display: "flex", alignItems: "center", gap: 10, border: 0, background: "transparent", padding: "4px 0", cursor: "pointer", font: "inherit", color: "inherit", textAlign: "left" }}>
                        <Avatar name={x.name} src={x.avatarUrl} person={x.hue} size="sm" />
                        <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}><span style={{ font: "var(--type-label)" }}>{x.greetingName}</span>{st > 1 ? <span style={{ font: "var(--type-caption)", color: "var(--accent)" }}>{st}-day streak</span> : null}</span>
                      </button>
                      {wk.map((w, i) => { const day = week[i]; const future = day > p.todayISO; const frac = w.due ? w.done / w.due : 0; return (
                        <button key={day} type="button" onClick={() => go(day, "today")} aria-label={`${x.greetingName} ${fmtNight(day)}: ${w.done} of ${w.due}`} style={{ display: "grid", placeItems: "center", border: 0, background: "transparent", padding: 2, cursor: "pointer" }}>
                          <span style={{ width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center", background: !w.due ? "transparent" : future ? "var(--surface-sunken)" : `conic-gradient(${frac >= 1 ? "var(--positive)" : `var(--person-${x.hue})`} ${Math.round(frac * 360)}deg, var(--surface-sunken) 0)` }}>
                            <span style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--bg-app)", display: "grid", placeItems: "center", font: "500 var(--fs-xs)/1 var(--font-num)", color: !w.due ? "var(--text-tertiary)" : frac >= 1 ? "var(--positive)" : "var(--text-secondary)" }}>{w.due ? `${w.done}` : "·"}</span>
                          </span>
                        </button>
                      ); })}
                      <span className="zh-num" style={{ textAlign: "right", font: "500 var(--fs-sm)/1.3 var(--font-num)", color: "var(--text-secondary)" }}>{total.done}<span style={{ color: "var(--text-tertiary)" }}>/{total.due}{total.possible ? ` · ${total.points} pts` : ""}</span></span>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          ) : null}
          <Section title="This week's jobs" eyebrow="Open all week" action={weekJobs.length ? <Badge tone={weekJobs.every((i) => i.completion) ? "positive" : "neutral"}>{weekJobs.filter((i) => i.completion).length}/{weekJobs.length}</Badge> : undefined}>
            {!weekJobs.length ? <Row icon="calendar-days" tint="butter" title="Nothing on a weekly or monthly rhythm this week" meta="Weekly and monthly jobs show up here, with who has them." chevron={false} /> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{weekJobs.map((i) => <ItemRow key={i.task.id} item={i} showWho />)}</div>
            )}
          </Section>
          <p style={{ margin: 0, font: "var(--type-caption)", color: "var(--text-tertiary)" }}>The rings are each person&rsquo;s daily tasks. Weekly and monthly jobs live in the list above; tap the people icon on one to hand it to someone this time.</p>
        </Stagger>
      ) : null}

      {!emptyAll && tab === "lists" ? (
        <Stagger gap={24} start={2}>
          {p.isAdult ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Button variant="secondary" iconLeft="plus" onClick={() => setEditList({})}>New list</Button></div> : null}
          {p.lists.map((l) => {
            const ts = p.tasks.filter((t) => t.listId === l.id);
            return (
              <Section key={l.id} title={l.name} eyebrow={[l.visibility === "personal" ? "Just you" : "Family", l.remindTime ? `reminder ${l.remindTime}` : null].filter(Boolean).join(" · ")} action={p.isAdult ? <span style={{ display: "flex", gap: 4 }}><IconButton icon="plus" label="Add a task" size="sm" variant="ghost" onClick={() => setEditTask({ listId: l.id })} /><IconButton icon="settings" label="List settings" size="sm" variant="ghost" onClick={() => setEditList({ list: l })} /></span> : undefined}>
                {!ts.length ? <Row icon={l.icon ?? "sparkles"} tint={(l.tint as "butter") ?? "butter"} title="No tasks yet" meta={p.isAdult ? "Tap + to add the first one." : undefined} chevron={false} /> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {ts.map((t) => <Row key={t.id} icon={t.icon ?? "sparkles"} tint={(l.tint as "butter") ?? "butter"} title={t.title} meta={[rhythmLabel(t.rhythm), t.assign.mode === "person" ? whoLabel(t.assign.memberId) : t.assign.mode === "rotation" ? `Takes turns: ${t.assign.memberIds.map((id) => whoLabel(id)).join(", ")}` : "Anyone", timeLabel(t.timeOfDay), t.points ? `${t.points} pts` : null].filter(Boolean).join(" · ")} trailing={!t.active ? <Badge tone="neutral">Paused</Badge> : t.needsCheck ? <Badge tone="neutral" icon="badge-check">Checked</Badge> : undefined} onClick={p.isAdult ? () => setEditTask({ task: t }) : undefined} chevron={p.isAdult} style={{ opacity: t.active ? 1 : 0.6 }} />)}
                  </div>
                )}
              </Section>
            );
          })}
          {p.isAdult ? <TemplateStrip templates={p.templates} lists={p.lists} busy={busy} run={run} /> : null}
        </Stagger>
      ) : null}

      <BottomSheet open={!!whoSheet} onClose={() => setWhoSheet(null)} title={whoSheet ? `Who did “${whoSheet.task.title}”?` : "Who did it?"}>
        <PeopleGrid people={ordered} onPick={(id) => { const it = whoSheet!; setWhoSheet(null); toggle(it, true, id); }} />
      </BottomSheet>
      <BottomSheet open={!!handSheet} onClose={() => setHandSheet(null)} title={handSheet ? `Who takes “${handSheet.task.title}” ${handSheet.occ.period === "day" ? "today" : handSheet.occ.period === "week" ? "this week" : handSheet.occ.period === "month" ? "this month" : "this time"}?` : "Hand off"} footer={handSheet?.handoff ? <Button size="lg" fullWidth variant="ghost" onClick={() => { const it = handSheet!; setHandSheet(null); run(`h-${it.task.id}`, () => actions.handoffAction(it.task.id, it.occ.periodKey, null), "Back to the usual"); }}>Back to the usual</Button> : undefined}>
        <PeopleGrid people={ordered.filter((x) => x.id !== handSheet?.assignee)} onPick={(id) => { const it = handSheet!; setHandSheet(null); run(`h-${it.task.id}`, () => actions.handoffAction(it.task.id, it.occ.periodKey, id), `Handed to ${whoLabel(id)}`); }} />
      </BottomSheet>
      {editTask ? <TaskSheet task={editTask.task} listId={editTask.listId ?? editTask.task?.listId ?? p.lists[0]?.id ?? ""} lists={p.lists} people={ordered} todayISO={p.todayISO} onClose={() => setEditTask(null)} onSaved={(m) => { toast({ title: m, tone: "positive" }); router.refresh(); }} /> : null}
      {editList ? <ListSheet list={editList.list} me={p.me} onClose={() => setEditList(null)} onSaved={(m) => { toast({ title: m, tone: "positive" }); router.refresh(); }} /> : null}
    </div>
  );
}

function PeopleGrid({ people, onPick }: { people: PersonLite[]; onPick: (id: string) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 10 }}>
      {people.map((x) => <button key={x.id} type="button" onClick={() => onPick(x.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "14px 8px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", background: "var(--surface-card)", cursor: "pointer", font: "var(--type-label)", color: "var(--text-primary)" }}><Avatar name={x.name} src={x.avatarUrl} person={x.hue} size="md" />{x.greetingName}</button>)}
    </div>
  );
}

function TemplateStrip({ templates, lists, busy, run }: { templates: TemplateLite[]; lists: CleaningList[]; busy: string | null; run: (k: string, fn: () => Promise<Result>, done?: string) => Promise<void> }) {
  const router = useRouter();
  const left = templates.filter((t) => !lists.some((l) => l.name === t.name));
  if (!left.length) return null;
  return (
    <Section title="Start from a template" eyebrow="Adds a list you can prune">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 240px), 1fr))", gap: 12 }}>
        {left.map((t) => <Card key={t.key} icon={t.icon} title={t.name} intensity="finance" action={<Button size="sm" variant="soft" iconLeft="plus" loading={busy === `tpl-${t.key}`} onClick={() => run(`tpl-${t.key}`, async () => { const r = await actions.applyTemplateAction(t.key); if (r.ok) router.refresh(); return r; }, `${t.name} added`)}>Add</Button>}><span style={{ font: "var(--type-body-sm)", color: "var(--text-secondary)" }}>{t.body} {t.count} tasks.</span></Card>)}
      </div>
    </Section>
  );
}

type RhythmType = Rhythm["type"];
function TaskSheet({ task, listId, lists, people, todayISO, onClose, onSaved }: { task?: CleaningTask; listId: string; lists: CleaningList[]; people: PersonLite[]; todayISO: string; onClose: () => void; onSaved: (msg: string) => void }) {
  const router = useRouter();
  const editing = !!task;
  const r = task?.rhythm;
  const a = task?.assign;
  const [title, setTitle] = React.useState(task?.title ?? "");
  const [icon, setIcon] = React.useState(task?.icon ?? "sparkles");
  const [list, setList] = React.useState(listId);
  const [type, setType] = React.useState<RhythmType>(r?.type ?? "daily");
  const [weekdays, setWeekdays] = React.useState<number[]>(r?.type === "weekly" ? r.weekdays : [6]);
  const [n, setN] = React.useState(r?.type === "every_weeks" ? r.n : 1);
  const [byDay, setByDay] = React.useState(r?.type === "every_weeks" ? r.weekday : 6);
  const [anchor, setAnchor] = React.useState(r?.type === "every_weeks" ? r.anchor : todayISO);
  const [monthDay, setMonthDay] = React.useState<string>(r?.type === "monthly" ? String(r.day) : "1");
  const [date, setDate] = React.useState(r?.type === "once" ? r.date : todayISO);
  const [mode, setMode] = React.useState<Assign["mode"]>(a?.mode ?? "anyone");
  const [personId, setPersonId] = React.useState(a?.mode === "person" ? a.memberId : "");
  const [turns, setTurns] = React.useState<string[]>(a?.mode === "rotation" ? a.memberIds : people.filter((x) => x.kind === "adult").map((x) => x.id));
  const [time, setTime] = React.useState<TimeOfDay>(task?.timeOfDay ?? "any");
  const [points, setPoints] = React.useState(task?.points ?? 0);
  const [needsCheck, setNeedsCheck] = React.useState(task?.needsCheck ?? false);
  const [notes, setNotes] = React.useState(task?.notes ?? "");
  const [active, setActive] = React.useState(task?.active ?? true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState(false);
  const [kid, setKid] = React.useState<null | { name: string; busy: boolean }>(null);
  const toggleDay = (d: number) => setWeekdays((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d].sort()));
  const toggleTurn = (id: string) => setTurns((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const rhythm = (): Rhythm => type === "daily" ? { type } : type === "weekly" ? { type, weekdays } : type === "every_weeks" ? { type, n, weekday: byDay, anchor } : type === "monthly" ? { type, day: monthDay === "last" ? "last" : Number(monthDay) } : { type: "once", date };
  const assign = (): Assign => mode === "person" ? { mode, memberId: personId } : mode === "rotation" ? { mode, memberIds: turns, anchor: a?.mode === "rotation" ? a.anchor : undefined } : { mode: "anyone" };
  const save = async () => {
    setBusy(true); setError(null);
    const payload = { listId: list, title, icon, notes, rhythm: rhythm(), assign: assign(), timeOfDay: time, points, needsCheck };
    const res = editing ? await actions.updateTaskAction(task!.id, { ...payload, active }) : await actions.createTaskAction(payload);
    setBusy(false);
    if (res.ok) { onSaved(editing ? "Saved" : "Task added"); onClose(); } else setError(res.error || "That didn't save");
  };
  const addKid = async () => {
    if (!kid) return;
    setKid({ ...kid, busy: true });
    const res = await actions.addKidAction(kid.name);
    if (res.ok) { setKid(null); if (mode === "person") setPersonId(res.id); router.refresh(); } else setKid({ name: kid.name, busy: false });
  };
  const kids = people.filter((x) => x.kind === "child");
  return (
    <BottomSheet open onClose={onClose} title={editing ? "Edit task" : "New task"} footer={<><Button size="lg" fullWidth loading={busy} disabled={!title.trim() || !list} onClick={save}>{editing ? "Save" : "Add"}</Button>{editing ? (confirm ? <Button size="lg" fullWidth variant="danger" onClick={async () => { setBusy(true); await actions.deleteTaskAction(task!.id); setBusy(false); onSaved("Removed"); onClose(); }}>Really delete</Button> : <Button size="lg" fullWidth variant="ghost" onClick={() => setConfirm(true)}>Delete</Button>) : <Button size="lg" fullWidth variant="ghost" onClick={onClose}>Cancel</Button>}</>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Input label="Task" placeholder="Mop the floors" value={title} onChange={(e) => setTitle(e.target.value)} error={error ?? undefined} />
        <div><span style={{ font: "var(--type-label)", color: "var(--text-secondary)" }}>Icon</span><div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>{TASK_ICONS.map((i) => <button key={i} type="button" aria-label={i} aria-pressed={icon === i} onClick={() => setIcon(i)} style={{ width: 38, height: 38, borderRadius: 12, border: `1px solid ${icon === i ? "var(--accent)" : "var(--border-hairline)"}`, background: icon === i ? "var(--accent-soft)" : "var(--surface-card)", display: "grid", placeItems: "center", cursor: "pointer", color: icon === i ? "var(--accent)" : "var(--text-secondary)" }}><Icon name={i} size={18} /></button>)}</div></div>
        {lists.length > 1 ? <Select label="List" value={list} options={lists.map((l) => ({ value: l.id, label: l.name }))} onChange={(e) => setList(e.target.value)} /> : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ font: "var(--type-label)", color: "var(--text-secondary)" }}>How often</span>
          <SegmentedControl size="sm" items={[{ key: "daily", label: "Daily" }, { key: "weekly", label: "Some days" }, { key: "every_weeks", label: "Weekly+" }, { key: "monthly", label: "Monthly" }, { key: "once", label: "Once" }]} value={type} onChange={(k) => setType(k as RhythmType)} />
          {type === "weekly" ? <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{WEEKDAYS_SHORT.map((w, d) => <Tag key={w} selected={weekdays.includes(d)} onClick={() => toggleDay(d)}>{w}</Tag>)}</div> : null}
          {type === "every_weeks" ? <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}><span style={{ font: "var(--type-body-sm)", color: "var(--text-secondary)" }}>{n === 1 ? "Every week" : n === 2 ? "Every other week" : `Every ${n} weeks`}</span><Stepper value={n} min={1} max={12} onChange={setN} label="Weeks" size="sm" /></div>
            <Select label="Due by" value={String(byDay)} options={WEEKDAY_NAMES.map((d, i) => ({ value: String(i), label: d }))} onChange={(e) => setByDay(Number(e.target.value))} />
            {n > 1 ? <Input label="First week" hint="Any day in the first week it's due" type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} /> : null}
            <span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}>Open all week, due by that day.</span>
          </div> : null}
          {type === "monthly" ? <Select label="Due by" value={monthDay} options={[...ORDINALS.map((d) => ({ value: d, label: `the ${d}${d.endsWith("1") && d !== "11" ? "st" : d.endsWith("2") && d !== "12" ? "nd" : d.endsWith("3") && d !== "13" ? "rd" : "th"}` })), { value: "last", label: "the last day" }]} onChange={(e) => setMonthDay(e.target.value)} /> : null}
          {type === "once" ? <Input label="On" type="date" value={date} onChange={(e) => setDate(e.target.value)} /> : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ font: "var(--type-label)", color: "var(--text-secondary)" }}>Who</span>
          <SegmentedControl size="sm" items={[{ key: "anyone", label: "Anyone" }, { key: "person", label: "One person" }, { key: "rotation", label: "Take turns" }]} value={mode} onChange={(k) => setMode(k as Assign["mode"])} />
          {mode === "person" ? <Select value={personId} placeholder="Pick who" options={people.map((x) => ({ value: x.id, label: x.kind === "child" ? `${x.greetingName} (kid)` : x.greetingName }))} onChange={(e) => setPersonId(e.target.value)} /> : null}
          {mode === "rotation" ? <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{people.map((x) => <Tag key={x.id} selected={turns.includes(x.id)} onClick={() => toggleTurn(x.id)}>{x.greetingName}</Tag>)}</div> : null}
          {mode === "rotation" ? <span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}>Each time it comes round it goes to the next person. Hand off any single time from the list.</span> : null}
          {kid ? <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}><Input label="Kid's name" placeholder="Azaleah" value={kid.name} onChange={(e) => setKid({ ...kid, name: e.target.value })} style={{ flex: 1 }} /><Button size="md" loading={kid.busy} disabled={!kid.name.trim()} onClick={addKid}>Add</Button><Button size="md" variant="ghost" onClick={() => setKid(null)}>Cancel</Button></div>
            : <Button size="sm" variant="ghost" iconLeft="baby" onClick={() => setKid({ name: "", busy: false })} style={{ alignSelf: "flex-start" }}>{kids.length ? "Add another kid" : "Add a kid"}</Button>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}><span style={{ font: "var(--type-label)", color: "var(--text-secondary)" }}>When in the day</span><SegmentedControl size="sm" items={TIMES.map((t) => ({ key: t.key, label: t.label }))} value={time} onChange={(k) => setTime(k as TimeOfDay)} /></div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}><span style={{ font: "var(--type-label)", color: "var(--text-secondary)" }}>Points <span style={{ color: "var(--text-tertiary)" }}>(for kids)</span></span><Stepper value={points} min={0} max={20} onChange={setPoints} label="Points" size="sm" /></div>
        <Toggle label="A grown-up checks it" description="Shows under Needs a check until a parent okays it." checked={needsCheck} onChange={setNeedsCheck} />
        <Textarea label="Notes" placeholder="Where the supplies are, what counts as done…" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        {editing ? <Toggle label="Active" description="Paused tasks stay in the list but never come due." checked={active} onChange={setActive} /> : null}
      </div>
    </BottomSheet>
  );
}

function ListSheet({ list, me, onClose, onSaved }: { list?: CleaningList; me: string | null; onClose: () => void; onSaved: (msg: string) => void }) {
  const editing = !!list;
  const [name, setName] = React.useState(list?.name ?? "");
  const [icon, setIcon] = React.useState(list?.icon ?? "sparkles");
  const [tint, setTint] = React.useState(list?.tint ?? "butter");
  const [visibility, setVisibility] = React.useState<ListVisibility>(list?.visibility ?? "family");
  const [remind, setRemind] = React.useState(list?.remindTime ?? "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState(false);
  const save = async () => {
    setBusy(true); setError(null);
    const payload = { name, icon, tint, visibility, remindTime: remind || null };
    const res = editing ? await actions.updateListAction(list!.id, payload) : await actions.createListAction(payload);
    setBusy(false);
    if (res.ok) { onSaved(editing ? "Saved" : "List added"); onClose(); } else setError(res.error || "That didn't save");
  };
  return (
    <BottomSheet open onClose={onClose} title={editing ? "List settings" : "New list"} footer={<><Button size="lg" fullWidth loading={busy} disabled={!name.trim()} onClick={save}>{editing ? "Save" : "Add"}</Button>{editing ? (confirm ? <Button size="lg" fullWidth variant="danger" onClick={async () => { setBusy(true); await actions.deleteListAction(list!.id); setBusy(false); onSaved("List removed"); onClose(); }}>Really delete the list and its tasks</Button> : <Button size="lg" fullWidth variant="ghost" onClick={() => setConfirm(true)}>Delete</Button>) : <Button size="lg" fullWidth variant="ghost" onClick={onClose}>Cancel</Button>}</>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Input label="Name" placeholder="Saturday deep clean" value={name} onChange={(e) => setName(e.target.value)} error={error ?? undefined} />
        <div><span style={{ font: "var(--type-label)", color: "var(--text-secondary)" }}>Icon</span><div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>{LIST_ICONS.map((i) => <button key={i} type="button" aria-label={i} aria-pressed={icon === i} onClick={() => setIcon(i)} style={{ width: 38, height: 38, borderRadius: 12, border: `1px solid ${icon === i ? "var(--accent)" : "var(--border-hairline)"}`, background: icon === i ? "var(--accent-soft)" : "var(--surface-card)", display: "grid", placeItems: "center", cursor: "pointer", color: icon === i ? "var(--accent)" : "var(--text-secondary)" }}><Icon name={i} size={18} /></button>)}</div></div>
        <div><span style={{ font: "var(--type-label)", color: "var(--text-secondary)" }}>Color</span><div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>{LIST_TINTS.map((t) => <button key={t} type="button" aria-label={t} aria-pressed={tint === t} onClick={() => setTint(t)} style={{ width: 30, height: 30, borderRadius: "50%", border: `2px solid ${tint === t ? "var(--text-primary)" : "transparent"}`, background: `var(--hue-${t}-soft)`, cursor: "pointer", display: "grid", placeItems: "center" }}><span style={{ width: 14, height: 14, borderRadius: "50%", background: `var(--hue-${t})` }} /></button>)}</div></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}><span style={{ font: "var(--type-label)", color: "var(--text-secondary)" }}>Who sees it</span><SegmentedControl size="sm" items={[{ key: "family", label: "The family" }, { key: "personal", label: "Just me" }]} value={visibility} onChange={(k) => setVisibility(k as ListVisibility)} />{visibility === "personal" && !me ? <span style={{ font: "var(--type-caption)", color: "var(--negative)" }}>Personal lists need a signed-in person.</span> : null}</div>
        <Input label="Morning reminder" hint="Leave empty for the usual 8:00 digest" type="time" value={remind} onChange={(e) => setRemind(e.target.value)} />
      </div>
    </BottomSheet>
  );
}

export function CleaningClient(props: Props) {
  return <ToastProvider><Inner {...props} /></ToastProvider>;
}
