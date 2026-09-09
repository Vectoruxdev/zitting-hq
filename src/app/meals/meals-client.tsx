"use client";
/**
 * Meals — whose night it is, what's for dinner, the recipe box, and ideas
 * people found. Mobile-first rows on the canvas; sheets for every edit.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AvatarStack, Badge, BottomSheet, Button, Card, Checkbox, EmptyState, IconButton, ImageCard, InlineAlert, Input, RadioGroup, Reveal, Row, SearchField, Section, SegmentedControl, Select, Stagger, Textarea, ToastProvider, useToast,
} from "@/ui";
import type { Idea, NightPlan, RotationDay, Swap } from "@/db/kitchen";
import { resizeImage } from "@/lib/image";
import { WEEKDAYS, WEEKDAYS_SHORT, fmtNight, fmtShort } from "@/lib/dates";
import * as actions from "./actions";

export interface Recipe { id: number; name: string; ingredients: { name: string; qty?: string }[]; notes: string | null; servings: number | null; prepMinutes: number | null; tags: string[]; sourceUrl: string | null; lastMadeOn: string | null; coverUrl: string | null }
export interface PlanCell { id: number; date: string; slot: string; recipeId: number | null; title: string | null; note: string | null }
export interface PersonLite { id: string; name: string; greetingName: string; hue: number; avatarUrl: string | null; kind: "adult" | "child" }
interface Props {
  configured: boolean; weekStart: string; prevWeek: string; nextWeek: string; todayISO: string; localToday: string;
  initialTab: "week" | "recipes" | "ideas"; swapDate: string | null; swapId: number | null;
  recipes: Recipe[]; plan: PlanCell[]; nights: NightPlan[]; swaps: Swap[]; rotation: RotationDay[]; ideas: Idea[]; people: PersonLite[];
  viewer: { memberId: string | null; role: "owner" | "partner" | "member" };
}

const addDays = (iso: string, d: number) => { const x = new Date(iso + "T00:00:00"); x.setDate(x.getDate() + d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const weekdayOf = (iso: string) => new Date(iso + "T00:00:00").getDay();

function Inner(p: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = React.useState<string>(p.initialTab);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [night, setNight] = React.useState<string | null>(null);
  const [swapFor, setSwapFor] = React.useState<string | null>(p.swapDate);
  const [rotationOpen, setRotationOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Recipe | "new" | null>(null);
  const [q, setQ] = React.useState("");
  const me = p.viewer.memberId;
  const isOwner = p.viewer.role === "owner";
  const person = (id: string | null | undefined) => p.people.find((x) => x.id === id) || null;
  const recipeById = new Map(p.recipes.map((r) => [r.id, r]));
  const cellFor = (date: string) => p.plan.find((m) => m.date === date && m.slot === "dinner") || null;
  const nightFor = (date: string) => p.nights.find((n) => n.date === date) || null;
  const run = async (key: string, fn: () => Promise<unknown>, done?: string) => { setBusy(key); try { const r = (await fn()) as { ok?: boolean; error?: string } | undefined; if (r && r.ok === false) toast({ title: r.error || "That didn't save", tone: "negative" }); else if (done) toast({ title: done, tone: "positive" }); router.refresh(); } finally { setBusy(null); } };
  const days = Array.from({ length: 7 }, (_, i) => addDays(p.weekStart, i));
  const incoming = p.swaps.filter((s) => s.toMemberId === me);
  const outgoing = p.swaps.filter((s) => s.fromMemberId === me);
  const adults = p.people.filter((x) => x.kind === "adult");

  const NightRow = ({ date }: { date: string }) => {
    const cell = cellFor(date); const n = nightFor(date); const cook = person(n?.cook);
    const recipe = cell?.recipeId ? recipeById.get(cell.recipeId) : null;
    const meal = recipe?.name || cell?.title || null;
    const isToday = date === p.todayISO; const past = date < p.todayISO;
    const mine = !!cook && cook.id === me;
    const dish = (n?.dish ?? []).map((id) => person(id)?.greetingName).filter(Boolean).join(", ");
    const who = cook ? (mine ? "Your night" : `${cook.greetingName}’s night`) : "Nobody’s on dinner";
    return (
      <Row
        avatar={cook ? { name: cook.name, src: cook.avatarUrl, person: cook.hue } : undefined} icon={cook ? undefined : "chef-hat"} tint="butter"
        tone={isToday ? "soft" : "default"}
        title={meal ? meal : <span style={{ color: "var(--text-tertiary)" }}>Nothing planned yet</span>}
        meta={<>{isToday ? "Tonight" : WEEKDAYS_SHORT[weekdayOf(date)] + " " + fmtShort(date)} · {who}{dish ? ` · dishes: ${dish}` : ""}{n?.note ? ` · ${n.note}` : ""}</>}
        trailing={!past && (mine || isOwner) && cook ? <Button size="sm" variant="soft" onClick={() => setSwapFor(date)}>Swap</Button> : undefined}
        onClick={() => setNight(date)} chevron={false}
        style={isToday ? { margin: 0, boxSizing: "border-box", padding: "8px 12px" } : undefined}
      />
    );
  };

  return (
    <div style={{ width: "100%", maxWidth: "var(--content-max)", margin: "0 auto", padding: "16px var(--page-gutter-mobile) 64px", display: "flex", flexDirection: "column", gap: "var(--section-gap)" }}>
      <Reveal>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div><p style={{ margin: "0 0 6px", font: "var(--type-overline)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Meals</p><h1 style={{ margin: 0, font: "var(--type-greeting)", fontSize: "clamp(var(--fs-3xl), 5vw, var(--fs-4xl))", letterSpacing: "var(--ls-display)" }}>{tab === "recipes" ? "Recipe box" : tab === "ideas" ? "Ideas" : "This week’s dinners"}</h1></div>
          <SegmentedControl size="sm" items={[{ key: "week", label: "Week" }, { key: "recipes", label: "Recipes", }, { key: "ideas", label: "Ideas" }]} value={tab} onChange={setTab} />
        </div>
      </Reveal>
      {!p.configured ? <InlineAlert tone="warning" title="The kitchen tables aren’t set up yet">Run <code>supabase-phase2-kitchen.sql</code> in the Supabase SQL Editor, then reload.</InlineAlert> : null}

      {tab === "week" ? (
        <Stagger gap={28} start={1}>
          {incoming.length || outgoing.length ? (
            <Section title="Swap requests">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {incoming.map((s) => { const from = person(s.fromMemberId); return (
                  <InlineAlert key={s.id} tone="accent" icon="chef-hat" title={`${from?.greetingName ?? "Someone"} asks: can you take ${fmtNight(s.fromDate)}?`} action={<div style={{ display: "flex", gap: 6 }}><Button size="sm" loading={busy === `swap-${s.id}`} onClick={() => run(`swap-${s.id}`, () => actions.answerSwap(s.id, "accept"), "Swapped")}>Take it</Button><Button size="sm" variant="ghost" onClick={() => run(`swap-${s.id}`, () => actions.answerSwap(s.id, "decline"))}>Can’t</Button></div>}>
                    They’ll take your {fmtNight(s.toDate)}.{s.message ? ` “${s.message}”` : ""}
                  </InlineAlert>); })}
                {outgoing.map((s) => { const to = person(s.toMemberId); return (
                  <InlineAlert key={s.id} tone="info" icon="clock" title={`Waiting on ${to?.greetingName ?? "them"}`} action={<Button size="sm" variant="ghost" onClick={() => run(`swap-${s.id}`, () => actions.answerSwap(s.id, "cancel"))}>Cancel</Button>}>
                    You asked them to take {fmtNight(s.fromDate)} for their {fmtNight(s.toDate)}.
                  </InlineAlert>); })}
              </div>
            </Section>
          ) : null}
          <Section title={`${fmtShort(p.weekStart)} – ${fmtShort(addDays(p.weekStart, 6))}`} action={<div style={{ display: "flex", gap: 4 }}><IconButton icon="chevron-left" label="Previous week" size="sm" variant="outline" onClick={() => router.push(`/meals?week=${p.prevWeek}`)} /><IconButton icon="chevron-right" label="Next week" size="sm" variant="outline" onClick={() => router.push(`/meals?week=${p.nextWeek}`)} /><IconButton icon="sliders-horizontal" label="Who cooks when" size="sm" variant="outline" onClick={() => setRotationOpen(true)} /></div>}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{days.map((d) => <NightRow key={d} date={d} />)}</div>
          </Section>
          {!p.rotation.length ? <EmptyState compact icon="chef-hat" title="No dinner rotation yet" body="Set who cooks on which nights once, and every week fills itself in. Swaps handle the exceptions." action={<Button size="sm" variant="soft" iconLeft="sliders-horizontal" onClick={() => setRotationOpen(true)}>Set the rotation</Button>} style={{ padding: "4px 0" }} /> : null}
        </Stagger>
      ) : null}

      {tab === "recipes" ? (
        <Stagger gap={24} start={1}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <SearchField size="sm" placeholder="Search recipes" value={q} onChange={setQ} style={{ flex: "1 1 240px" }} />
            <Button size="sm" iconLeft="plus" onClick={() => setEditing("new")}>New recipe</Button>
          </div>
          {!p.recipes.length ? <EmptyState icon="book-open" title="The recipe box is empty" body="Save the family favorites with their ingredients — planning a night becomes one tap, and the shopping list fills itself." action={<Button iconLeft="plus" onClick={() => setEditing("new")}>Add the first recipe</Button>} /> : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 200px), 1fr))", gap: 16 }}>
              {p.recipes.filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || r.tags.some((t) => t.toLowerCase().includes(q.toLowerCase()))).map((r) => (
                <Card key={r.id} media={r.coverUrl ?? <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--text-tertiary)", border: "1.5px dashed var(--border-strong)", borderRadius: "inherit", margin: 8 }}><span style={{ font: "var(--type-caption)" }}>No photo yet</span></div>} title={r.name} intensity="finance" onClick={() => setEditing(r)} padding={14}>
                  <span style={{ font: "var(--type-caption)", color: "var(--text-secondary)" }}>{[r.ingredients.length ? `${r.ingredients.length} ingredient${r.ingredients.length === 1 ? "" : "s"}` : "No ingredients yet", r.prepMinutes ? `${r.prepMinutes} min` : null, r.servings ? `serves ${r.servings}` : null].filter(Boolean).join(" · ")}</span>
                </Card>
              ))}
            </div>
          )}
        </Stagger>
      ) : null}

      {tab === "ideas" ? <IdeasTab ideas={p.ideas} people={p.people} me={me} busy={busy} run={run} localToday={p.localToday} /> : null}

      {/* ---- night sheet ---- */}
      {night ? <NightSheet date={night} cell={cellFor(night)} plan={nightFor(night)} recipes={p.recipes} people={adults.length ? adults : p.people} allPeople={p.people} onClose={() => setNight(null)} busy={busy} run={run} /> : null}
      {/* ---- swap sheet ---- */}
      {swapFor ? <SwapSheet date={swapFor} me={me} isOwner={isOwner} nights={p.nights} people={adults} person={person} onClose={() => { setSwapFor(null); router.replace("/meals"); }} busy={busy} run={run} /> : null}
      {/* ---- rotation sheet ---- */}
      <BottomSheet open={rotationOpen} onClose={() => setRotationOpen(false)} title="Who cooks when" footer={<Button size="lg" fullWidth variant="ghost" onClick={() => setRotationOpen(false)}>Done</Button>}>
        <p style={{ margin: "0 0 12px", font: "var(--type-body-sm)", color: "var(--text-secondary)" }}>The default for each night. Swaps and one-off changes sit on top.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2, 3, 4, 5, 6, 0].map((wd) => { const r = p.rotation.find((x) => x.weekday === wd); return (
            <div key={wd} style={{ display: "grid", gridTemplateColumns: "72px 1fr 1fr", gap: 8, alignItems: "end" }}>
              <span style={{ font: "var(--type-label)", paddingBottom: 12 }}>{WEEKDAYS[wd]}</span>
              <Select label="Cooks" size="sm" value={r?.cookMemberId ?? ""} placeholder="Nobody" options={p.people.filter((x) => x.kind === "adult").map((x) => ({ value: x.id, label: x.greetingName }))} onChange={(e) => run(`rot-${wd}`, () => actions.setRotationDay(wd, e.target.value || null, r?.dishMemberIds ?? []))} />
              <Select label="Dishes" size="sm" value={r?.dishMemberIds?.[0] ?? ""} placeholder="Nobody" options={p.people.map((x) => ({ value: x.id, label: x.greetingName }))} onChange={(e) => run(`rotd-${wd}`, () => actions.setRotationDay(wd, r?.cookMemberId ?? null, e.target.value ? [e.target.value] : []))} />
            </div>); })}
        </div>
      </BottomSheet>
      {/* ---- recipe editor ---- */}
      {editing ? <RecipeSheet recipe={editing === "new" ? null : editing} onClose={() => setEditing(null)} busy={busy} run={run} /> : null}
    </div>
  );
}

function NightSheet({ date, cell, plan, recipes, people, allPeople, onClose, busy, run }: { date: string; cell: PlanCell | null; plan: NightPlan | null; recipes: Recipe[]; people: PersonLite[]; allPeople: PersonLite[]; onClose: () => void; busy: string | null; run: (k: string, fn: () => Promise<unknown>, done?: string) => Promise<void> }) {
  const [text, setText] = React.useState(cell?.recipeId ? "" : cell?.title ?? "");
  const [q, setQ] = React.useState("");
  const [cook, setCook] = React.useState<string>(plan?.cook ?? "");
  const [dish, setDish] = React.useState<string[]>(plan?.dish ?? []);
  const [note, setNote] = React.useState(plan?.note ?? "");
  const current = cell?.recipeId ? recipes.find((r) => r.id === cell.recipeId) : null;
  const saveWho = () => run(`night-${date}`, () => actions.setNight(date, { cookMemberId: cook || null, dishMemberIds: dish, note }), "Saved");
  return (
    <BottomSheet open onClose={onClose} title={`${fmtNight(date)} — dinner`} footer={<><Button size="lg" fullWidth onClick={async () => { await saveWho(); onClose(); }} loading={busy === `night-${date}`}>Save</Button>{plan?.overridden ? <Button size="lg" fullWidth variant="ghost" onClick={() => run(`night-${date}`, () => actions.setNight(date, { reset: true }))}>Back to the usual rotation</Button> : null}</>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Section title="What" gap={8}>
          {current ? <Row icon="utensils" tint="butter" title={current.name} meta={`${current.ingredients.length} ingredients`} trailing={<><Button size="sm" variant="soft" iconLeft="shopping-cart" onClick={() => run(`send-${current.id}`, () => actions.sendRecipeToList(current.id), "Ingredients added to the list")}>List</Button><IconButton icon="x" label="Clear" size="sm" onClick={() => run(`meal-${date}`, () => actions.setMeal({ date, recipeId: null, title: null }))} /></>} chevron={false} /> : (
            <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) run(`meal-${date}`, () => actions.setMeal({ date, title: text }), "Planned"); }} style={{ display: "flex", gap: 8 }}>
              <Input placeholder="Type anything… Pizza night" value={text} onChange={(e) => setText(e.target.value)} style={{ flex: 1 }} />
              <Button type="submit" disabled={!text.trim()} style={{ alignSelf: "flex-end" }}>Set</Button>
            </form>
          )}
          {recipes.length ? <><SearchField size="sm" placeholder="Or pick a recipe" value={q} onChange={setQ} /><div style={{ display: "flex", flexDirection: "column", maxHeight: 220, overflow: "auto" }}>{recipes.filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase())).slice(0, 12).map((r) => <Row key={r.id} size="sm" icon="utensils" tint="butter" title={r.name} meta={`${r.ingredients.length} ing.`} onClick={() => run(`meal-${date}`, () => actions.setMeal({ date, recipeId: r.id }), "Planned")} />)}</div></> : null}
        </Section>
        <Section title="Who" gap={8}>
          <Select label="Cooks" value={cook} placeholder="Nobody" options={people.map((x) => ({ value: x.id, label: x.greetingName }))} onChange={(e) => setCook(e.target.value)} />
          <div><span style={{ font: "var(--type-label)", color: "var(--text-secondary)" }}>Dishes</span><div style={{ display: "flex", flexWrap: "wrap", gap: "0 16px" }}>{allPeople.map((x) => <Checkbox key={x.id} label={x.greetingName} checked={dish.includes(x.id)} onChange={(v) => setDish((d) => (v ? [...d, x.id] : d.filter((i) => i !== x.id)))} style={{ minHeight: 36, padding: "6px 0" }} />)}</div></div>
          <Input label="Note" placeholder="Eating at Grandma’s · leftovers · takeout" value={note} onChange={(e) => setNote(e.target.value)} />
        </Section>
      </div>
    </BottomSheet>
  );
}

function SwapSheet({ date, me, isOwner, nights, people, person, onClose, busy, run }: { date: string; me: string | null; isOwner: boolean; nights: NightPlan[]; people: PersonLite[]; person: (id: string | null | undefined) => PersonLite | null; onClose: () => void; busy: string | null; run: (k: string, fn: () => Promise<unknown>, done?: string) => Promise<void> }) {
  const mine = nights.find((n) => n.date === date);
  const cookId = mine?.cook ?? me;
  const others = people.filter((x) => x.id !== cookId);
  const [to, setTo] = React.useState(others[0]?.id ?? "");
  const [toDate, setToDate] = React.useState("");
  const [msg, setMsg] = React.useState("");
  const theirNights = nights.filter((n) => n.cook === to && n.date > date).slice(0, 6);
  const target = person(to);
  return (
    <BottomSheet open onClose={onClose} title="Swap dinner night" footer={<><Button size="lg" fullWidth disabled={!to || !toDate} loading={busy === "swap"} onClick={async () => { await run("swap", () => actions.requestSwap({ toMemberId: to, fromDate: date, toDate, message: msg }), `Asked ${target?.greetingName ?? "them"} to swap`); onClose(); }}>Ask {target?.greetingName ?? "them"} to swap</Button><Button size="lg" fullWidth variant="ghost" onClick={onClose}>Cancel</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <p style={{ margin: 0, font: "var(--type-body-sm)", color: "var(--text-secondary)" }}>{fmtNight(date)} is {cookId === me ? "yours" : `${person(cookId)?.greetingName ?? "someone"}’s`}. Give it to someone and take one of their nights.{!isOwner && cookId !== me ? " Only the cook (or the owner) can offer a swap." : ""}</p>
        <Select label="Give it to" value={to} options={others.map((x) => ({ value: x.id, label: x.greetingName }))} onChange={(e) => { setTo(e.target.value); setToDate(""); }} />
        {theirNights.length ? <RadioGroup label={`Take which of ${target?.greetingName ?? "their"} nights?`} layout="cards" columns={2} value={toDate} onChange={setToDate} options={theirNights.map((n) => ({ value: n.date, label: fmtNight(n.date), description: n.note || undefined }))} /> : <InlineAlert tone="info">{target?.greetingName ?? "They"} {to ? "has no nights in the next two weeks — set the rotation first." : "—"}</InlineAlert>}
        <Input label="Say why (optional)" placeholder="Late meeting" value={msg} onChange={(e) => setMsg(e.target.value)} />
      </div>
    </BottomSheet>
  );
}

function RecipeSheet({ recipe, onClose, busy, run }: { recipe: Recipe | null; onClose: () => void; busy: string | null; run: (k: string, fn: () => Promise<unknown>, done?: string) => Promise<void> }) {
  const [name, setName] = React.useState(recipe?.name ?? "");
  const [ing, setIng] = React.useState<{ name: string; qty?: string }[]>(recipe?.ingredients?.length ? recipe.ingredients : [{ name: "" }]);
  const [notes, setNotes] = React.useState(recipe?.notes ?? "");
  const [servings, setServings] = React.useState(recipe?.servings ? String(recipe.servings) : "");
  const [prep, setPrep] = React.useState(recipe?.prepMinutes ? String(recipe.prepMinutes) : "");
  const [tags, setTags] = React.useState(recipe?.tags?.join(", ") ?? "");
  const [source, setSource] = React.useState(recipe?.sourceUrl ?? "");
  const [cover, setCover] = React.useState(recipe?.coverUrl ?? null);
  const [confirm, setConfirm] = React.useState(false);
  const file = React.useRef<HTMLInputElement>(null);
  const setRow = (i: number, patch: Partial<{ name: string; qty: string }>) => setIng((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const save = async () => run("recipe", async () => {
    const res = await actions.saveRecipe({ id: recipe?.id ?? null, name, ingredients: ing, notes: notes || null, servings: servings ? Number(servings) : null, prepMinutes: prep ? Number(prep) : null, tags: tags.split(",").map((t) => t.trim()).filter(Boolean), sourceUrl: source || null });
    if (res.ok) onClose();
    return res;
  }, "Saved");
  const onCover = async (f?: File) => {
    if (!f || !recipe) return;
    const blob = await resizeImage(f, { max: 1200 });
    const fd = new FormData(); fd.append("file", new File([blob], "cover.jpg", { type: "image/jpeg" }));
    await run("cover", async () => { const r = await actions.uploadRecipeCover(recipe.id, fd); if (r.ok) setCover(r.url ?? null); return r; }, "Photo added");
  };
  return (
    <BottomSheet open onClose={onClose} title={recipe ? "Edit recipe" : "New recipe"} footer={<><Button size="lg" fullWidth onClick={save} disabled={!name.trim()} loading={busy === "recipe"}>Save recipe</Button>{recipe ? (confirm ? <Button size="lg" fullWidth variant="danger" onClick={() => run("recipe", async () => { const r = await actions.deleteRecipe(recipe.id); onClose(); return r; })}>Really delete</Button> : <Button size="lg" fullWidth variant="ghost" onClick={() => setConfirm(true)}>Delete</Button>) : null}</>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {recipe ? <div style={{ display: "flex", gap: 12, alignItems: "center" }}><ImageCard src={cover} ratio="4 / 3" style={{ width: 120 }} /><div style={{ display: "flex", flexDirection: "column", gap: 6 }}><input ref={file} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => onCover(e.target.files?.[0])} /><Button size="sm" variant="secondary" iconLeft="camera" loading={busy === "cover"} onClick={() => file.current?.click()}>{cover ? "Change photo" : "Add a photo"}</Button><span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}>Shows on the recipe and on Home.</span></div></div> : null}
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sheet-pan chicken" />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ font: "var(--type-label)", color: "var(--text-secondary)" }}>Ingredients</span>
          {ing.map((r, i) => <div key={i} style={{ display: "flex", gap: 8 }}><Input value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} placeholder="Ingredient" style={{ flex: 2 }} /><Input value={r.qty || ""} onChange={(e) => setRow(i, { qty: e.target.value })} placeholder="Qty" style={{ flex: 1, maxWidth: 110 }} /><IconButton icon="x" label="Remove" onClick={() => setIng((rows) => rows.filter((_, j) => j !== i))} style={{ alignSelf: "center" }} /></div>)}
          <Button size="sm" variant="ghost" iconLeft="plus" onClick={() => setIng((rows) => [...rows, { name: "" }])} style={{ alignSelf: "flex-start" }}>Ingredient</Button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><Input label="Serves" type="number" inputMode="numeric" value={servings} onChange={(e) => setServings(e.target.value)} /><Input label="Minutes" type="number" inputMode="numeric" value={prep} onChange={(e) => setPrep(e.target.value)} /></div>
        <Input label="Tags" hint="comma separated · weeknight, kids love it" value={tags} onChange={(e) => setTags(e.target.value)} />
        <Input label="Where it's from" type="url" placeholder="https://…" value={source} onChange={(e) => setSource(e.target.value)} />
        <Textarea label="Notes" placeholder="Oven temp, the trick that makes it work…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        {recipe?.ingredients.length ? <Button variant="soft" iconLeft="shopping-cart" onClick={() => run(`send-${recipe.id}`, () => actions.sendRecipeToList(recipe.id), "Ingredients added to the list")}>Send ingredients to the list</Button> : null}
      </div>
    </BottomSheet>
  );
}

function IdeasTab({ ideas, people, me, busy, run, localToday }: { ideas: Idea[]; people: PersonLite[]; me: string | null; busy: string | null; run: (k: string, fn: () => Promise<unknown>, done?: string) => Promise<void>; localToday: string }) {
  const [url, setUrl] = React.useState("");
  const [planning, setPlanning] = React.useState<number | null>(null);
  const [date, setDate] = React.useState(localToday);
  const person = (id: string | null) => people.find((x) => x.id === id);
  const PLATFORM: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube", web: "Web" };
  return (
    <Stagger gap={24} start={1}>
      <form onSubmit={(e) => { e.preventDefault(); if (url.trim()) run("idea", async () => { const r = await actions.addIdea(url); if (r.ok) setUrl(""); return r; }, "Saved the idea"); }} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <Input label="Paste a link" placeholder="TikTok, Instagram, a recipe page…" type="url" value={url} onChange={(e) => setUrl(e.target.value)} style={{ flex: 1 }} />
        <Button type="submit" iconLeft="plus" loading={busy === "idea"} disabled={!url.trim()}>Add</Button>
      </form>
      <p style={{ margin: "-12px 0 0", font: "var(--type-caption)", color: "var(--text-tertiary)" }}>TikTok and YouTube fill in the title and picture; Instagram links keep the link and let you name it.</p>
      {!ideas.length ? <EmptyState icon="sparkles" title="No ideas yet" body="See something on TikTok that looks like dinner? Paste it here and let the family vote with a heart." /> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))", gap: 16, alignItems: "start" }}>
          {ideas.map((i) => { const by = person(i.postedBy); const liked = !!me && i.reactions.some((r) => r.memberId === me); return (
            <Card key={i.id} media={i.imageUrl ?? undefined} title={i.title || i.url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)} eyebrow={PLATFORM[i.platform] || "Link"} intensity="finance" padding={14} action={<Badge tone={i.status === "made" ? "positive" : i.status === "planned" ? "accent" : "neutral"}>{i.status}</Badge>}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {i.author || by ? <span style={{ font: "var(--type-caption)", color: "var(--text-secondary)" }}>{[i.author, by ? `found by ${by.greetingName}` : null].filter(Boolean).join(" · ")}</span> : null}
                {i.notes ? <span style={{ font: "var(--type-body-sm)" }}>{i.notes}</span> : null}
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <IconButton icon="heart" label={liked ? "Unlike" : "Like"} size="sm" variant="outline" active={liked} onClick={() => run(`like-${i.id}`, () => actions.reactToIdea(i.id))} />
                  {i.reactions.length ? <AvatarStack size="xs" people={i.reactions.map((r) => { const p = person(r.memberId); return { name: p?.name, src: p?.avatarUrl ?? undefined, person: p?.hue }; })} /> : null}
                  <span style={{ flex: 1 }} />
                  <IconButton icon="external-link" label="Open" size="sm" onClick={() => window.open(i.url, "_blank", "noopener")} />
                  {i.status !== "made" ? <Button size="sm" variant="soft" iconLeft="calendar-plus" onClick={() => setPlanning(i.id)}>Plan it</Button> : null}
                  {i.status !== "made" ? <Button size="sm" variant="secondary" iconLeft="check" loading={busy === `made-${i.id}`} onClick={() => run(`made-${i.id}`, () => actions.ideaToRecipe(i.id), "Added to the recipe box")}>Made it</Button> : null}
                  <IconButton icon="trash-2" label="Remove" size="sm" onClick={() => run(`rm-${i.id}`, () => actions.removeIdea(i.id))} />
                </div>
              </div>
            </Card>); })}
        </div>
      )}
      <BottomSheet open={planning != null} onClose={() => setPlanning(null)} title="Which night?" footer={<Button size="lg" fullWidth loading={busy === "plan"} onClick={async () => { if (planning != null) await run("plan", () => actions.planIdea(planning, date), "Planned"); setPlanning(null); }}>Plan it</Button>}>
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </BottomSheet>
    </Stagger>
  );
}

export function MealsClient(props: Props) {
  return <ToastProvider><Inner {...props} /></ToastProvider>;
}
