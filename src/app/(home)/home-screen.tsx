"use client";
/**
 * Home — the per-person dashboard, built from the design system's Home
 * (ui_kits/hub/HubHome.jsx): sections on the canvas, not boxes. Owner sees the
 * household money; a wife sees only her Spendable; both see the family.
 */
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Avatar, Badge, Button, Celebrate, Checkbox, EmptyState, Icon, IconButton, ImageCard, ModuleTile, Money, PhotoHero, ProgressBar, Reveal, Row, Section, Skeleton, Stagger,
} from "@/ui";
import { completeChoreAction, uncompleteChoreAction } from "@/app/chores/actions";
import { modulesFor } from "@/lib/modules";
import type { HomeData } from "@/db/home";

const T = { sec: { font: "var(--type-body-sm)", color: "var(--text-secondary)" } as React.CSSProperties, cap: { font: "var(--type-caption)", color: "var(--text-tertiary)" } as React.CSSProperties };

function useNarrow(ref: React.RefObject<HTMLElement | null>) {
  const [narrow, setNarrow] = React.useState(true);
  React.useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 900));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return narrow;
}

function Greeting({ data }: { data: HomeData }) {
  const part = data.daypart === "late" ? "Up late" : data.daypart === "morning" ? "Good morning" : data.daypart === "afternoon" ? "Good afternoon" : "Good evening";
  const words = data.daypart === "late" ? ["Up", "late,", data.greetingName + "."] : [part.split(" ")[0], part.split(" ")[1] + ",", data.greetingName + "."];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <p style={{ margin: 0, font: "var(--type-overline)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: "var(--text-tertiary)" }}>{data.dateLabel}</p>
      <h1 style={{ margin: 0, font: "var(--type-greeting)", letterSpacing: "var(--ls-display)", textWrap: "balance", fontSize: "clamp(var(--fs-3xl), 6vw, var(--fs-4xl))" }}>
        {words.map((w, i) => <span key={i} style={{ display: "inline-block", marginRight: "0.25em", animation: `zh-fade-up var(--dur-slow) var(--ease-out) ${i * 90}ms both` }}>{w}</span>)}
      </h1>
    </div>
  );
}

/** The family, as people — tap one to see their photos (Phase 3) or your own profile. */
function FamilyRow({ data }: { data: HomeData }) {
  const router = useRouter();
  if (!data.people.length) return null;
  return (
    <div className="zhq-hscroll" style={{ display: "flex", gap: 4, overflowX: "auto", margin: "0 -8px", padding: "0 8px", flex: "0 1 auto", minWidth: 0 }}>
      {data.people.map((p, i) => (
        <button key={p.id} type="button" onClick={() => router.push(p.id === data.viewer.memberId ? "/me" : `/photos?person=${encodeURIComponent(p.id)}`)}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "6px 8px", border: 0, background: "transparent", cursor: "pointer", borderRadius: "var(--radius-md)", color: "var(--text-primary)", font: "inherit", flex: "none", animation: `zh-fade-up var(--dur-base) var(--ease-out) ${i * 40}ms both` }}>
          <Avatar name={p.name} src={p.avatarUrl} person={p.hue} size="lg" />
          <span style={{ font: "500 var(--fs-xs)/1 var(--font-ui)" }}>{p.greetingName}</span>
        </button>
      ))}
    </div>
  );
}

function PhotoOfDay({ data, narrow }: { data: HomeData; narrow: boolean }) {
  const router = useRouter();
  const pod = data.photoOfDay;
  return (
    <PhotoHero
      src={pod?.src} ratio={narrow ? "var(--ratio-hero-mobile)" : "var(--ratio-hero)"} eyebrow="Photo of the day" title={pod?.title ?? undefined}
      subtitle={pod ? [pod.by && `Added by ${pod.by}`, pod.album && `${pod.count} more in “${pod.album}”`].filter(Boolean).join(" · ") : undefined}
      actions={pod ? <Button variant="onPhoto" size="sm" iconLeft="image" onClick={() => router.push(pod.id ? `/photos?photo=${pod.id}` : "/photos")}>Open</Button> : undefined}
      onAddPhoto={() => router.push("/photos?add=1")} style={{ width: "100%", minWidth: 0 }}
    />
  );
}

function TodaySection({ data }: { data: HomeData }) {
  const router = useRouter();
  const d = data.dashboard.today;
  const empty = !d.dinner && !d.events.length && !data.tonight?.cook && !data.upNext.length;
  return (
    <Section title="Today" onAction={() => router.push("/calendar")} actionLabel="Calendar">
      {empty ? (
        <EmptyState compact icon="calendar" title="A quiet day" body={data.dashboard.calendar.feedCount ? "Nothing on the calendar. Plan a dinner and it shows up here." : "Nothing planned. Connect a calendar or plan a dinner and it shows up here."} style={{ padding: "8px 0" }} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {d.dinner || data.tonight?.cook ? (() => {
            const cook = data.people.find((p) => p.id === data.tonight?.cook);
            const mine = !!cook && cook.id === data.viewer.memberId;
            const dish = (data.tonight?.dish ?? []).map((id) => data.people.find((p) => p.id === id)?.greetingName).filter(Boolean).join(", ");
            const title = d.dinner ? (mine ? `Your night — ${d.dinner.name}` : cook ? `${cook.greetingName}’s night — ${d.dinner.name}` : `Tonight — ${d.dinner.name}`) : mine ? "Your night — nothing planned yet" : `${cook!.greetingName}’s night — nothing planned yet`;
            return <Row avatar={cook ? { name: cook.name, src: cook.avatarUrl, person: cook.hue } : undefined} icon={cook ? undefined : "chef-hat"} tint="butter" title={title} meta={[data.tonight?.note, dish ? `dishes: ${dish}` : null].filter(Boolean).join(" · ") || "Dinner"} trailing={mine ? <Button size="sm" variant="soft" onClick={() => router.push(`/meals?swap=${data.todayISO}`)}>Swap</Button> : undefined} onClick={() => router.push("/meals")} chevron={!mine} />;
          })() : null}
          {(data.upNext.length ? data.upNext.filter((e) => e.dateISO === data.todayISO) : d.events.map((e, i) => ({ key: `d${i}`, kind: "event" as const, title: e.title, dateISO: data.todayISO, time: e.time, location: null, forMemberId: null, driverMemberId: null, familyEventId: null, tripId: null, dayOfTrip: undefined }))).map((e) => <UpNextRow key={e.key} e={e} data={data} />)}
        </div>
      )}
      {data.upNext.some((e) => e.dateISO !== data.todayISO) ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 8 }}>
          <span style={{ font: "var(--type-overline)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: "var(--text-tertiary)", padding: "6px 0" }}>Coming up</span>
          {data.upNext.filter((e) => e.dateISO !== data.todayISO).slice(0, 4).map((e) => <UpNextRow key={e.key} e={e} data={data} showDate />)}
        </div>
      ) : null}
    </Section>
  );
}

const fmtTime = (t: string | null) => { if (!t) return null; const [h, m] = t.split(":").map(Number); const d = new Date(); d.setHours(h, m); return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); };
function UpNextRow({ e, data, showDate }: { e: HomeData["upNext"][number]; data: HomeData; showDate?: boolean }) {
  const router = useRouter();
  const forP = data.people.find((p) => p.id === e.forMemberId), drv = data.people.find((p) => p.id === e.driverMemberId);
  const mine = !!drv && drv.id === data.viewer.memberId;
  const day = showDate ? new Date(e.dateISO + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" }) : null;
  const title = e.kind === "trip" ? `${e.title}${e.dayOfTrip ? ` · day ${e.dayOfTrip.n} of ${e.dayOfTrip.of}` : ""}` : e.kind === "appointment" && forP ? `${e.title} — ${forP.greetingName}` : e.title;
  return <Row time={e.time ? fmtTime(e.time) ?? undefined : day ?? undefined} icon={e.time || day ? undefined : e.kind === "trip" ? "plane" : e.kind === "appointment" ? "stethoscope" : "calendar"} tint={e.kind === "appointment" ? "lilac" : e.kind === "trip" ? "sky" : "coral"} title={title} meta={[day && e.time ? fmtTime(e.time) : null, e.location, drv ? `${mine ? "you're" : drv.greetingName + " is"} driving` : null].filter(Boolean).join(" · ") || undefined} trailing={e.kind === "appointment" ? <Badge tone="info" icon="stethoscope">Appt</Badge> : mine ? <Badge tone="warning" icon="car">Driving</Badge> : undefined} onClick={() => router.push(e.tripId ? `/trips/${e.tripId}` : e.familyEventId ? `/calendar?event=${e.familyEventId}` : "/calendar")} />;
}

function AttentionSection({ data }: { data: HomeData }) {
  const router = useRouter();
  const items = [
    ...(data.pendingSwaps ? [{ key: "swaps", label: `${data.pendingSwaps} dinner swap${data.pendingSwaps === 1 ? "" : "s"} waiting for your answer`, href: "/meals", tone: "accent" as const }] : []),
    ...(data.viewer.kind === "adult" && data.chores.toCheck ? [{ key: "chores", label: `${data.chores.toCheck} chore${data.chores.toCheck === 1 ? "" : "s"} to check`, href: "/chores", tone: "warn" as const }] : []),
    ...data.dashboard.needsAttention,
  ];
  if (!items.length) return <Section title="Needs attention"><Row icon="circle-check" tint="mint" title="All clear" meta="Nothing needs you right now." /></Section>;
  return (
    <Section title="Needs attention" action={<Badge tone="accent">{items.length}</Badge>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((it) => <Row key={it.key} tone="soft" tint={it.tone === "warn" ? "butter" : "coral"} icon={it.key === "swaps" ? "chef-hat" : it.key === "chores" ? "square-check" : it.href.startsWith("/finance") ? "receipt" : "shopping-cart"} title={it.label} onClick={() => router.push(it.href)} style={{ margin: 0, boxSizing: "border-box", padding: "8px 12px" }} />)}
      </div>
    </Section>
  );
}

const Big = ({ children }: { children: React.ReactNode }) => <span className="zh-money" style={{ font: "var(--type-money-lg)", fontSize: "var(--fs-3xl)" }}>{children}</span>;

/** Owner: the household at a glance. Two numbers and the open items. Links into Finance. */
function MoneySection({ data }: { data: HomeData }) {
  const router = useRouter();
  const f = data.dashboard.finance;
  return (
    <Section title="Money" onAction={() => router.push("/finance")} actionLabel="Finance">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><span style={T.cap}>Spent in {f.monthLabel ?? "this month"}</span><Big>{f.spending ?? "$0"}</Big></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><span style={T.cap}>Income</span><Big>{f.income ?? "$0"}</Big></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><span style={T.cap}>Cash across accounts</span><Big>{f.totalCash ?? "$0"}</Big></div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {f.transfersPending ? <Row size="sm" icon="arrow-left-right" tint="coral" title={`${f.transfersPending} transfer${f.transfersPending === 1 ? "" : "s"} ready`} meta={f.transfersPendingTotal ?? undefined} onClick={() => router.push("/finance")} /> : null}
          {f.toReview ? <Row size="sm" icon="receipt" tint="sky" title={`${f.toReview} transaction${f.toReview === 1 ? "" : "s"} to review`} onClick={() => router.push("/finance")} /> : null}
          {!f.transfersPending && !f.toReview ? <Row size="sm" icon="circle-check" tint="mint" title="Reviewed and routed" meta="Nothing waiting in finance." /> : null}
        </div>
      </div>
    </Section>
  );
}

/** Wife: her spendable only. One big number, a bar, the camera. Never household totals. */
function SpendableSection({ data }: { data: HomeData }) {
  const router = useRouter();
  const f = data.dashboard.finance;
  const allowance = f.memberAllowance ?? 0, spent = f.memberSpent ?? 0;
  const left = Math.max(0, allowance - spent);
  return (
    <Section eyebrow="Spendable" title={allowance > 0 ? "Left this month" : `Spent in ${f.monthLabel ?? "this month"}`} onAction={() => router.push("/finance")} actionLabel="Activity">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <Money value={allowance > 0 ? left : spent} size="xl" animate style={{ fontSize: "clamp(var(--fs-4xl), 8vw, var(--fs-5xl))", letterSpacing: "-0.02em" }} />
          {allowance > 0 ? <span style={T.sec}>of <Money value={allowance} size="sm" cents={false} tone="inherit" /></span> : null}
        </div>
        {allowance > 0 ? <ProgressBar value={spent / allowance} tone="budget" size="sm" /> : null}
        {f.memberUnlocked === false ? <Row size="sm" icon="lock" tint="butter" title="Allowance locked" meta="Finish reviewing your purchases to unlock it." onClick={() => router.push("/finance")} /> : null}
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="lg" iconLeft="camera" fullWidth onClick={() => router.push("/finance")}>Snap a receipt</Button>
          {f.memberToReview ? <Button size="lg" variant="soft" onClick={() => router.push("/finance")}>{f.memberToReview} to review</Button> : null}
        </div>
      </div>
    </Section>
  );
}

function QuoteBlock({ data }: { data: HomeData }) {
  const router = useRouter();
  const q = data.quote;
  if (!q) return <Section eyebrow="Something someone said"><EmptyState compact icon="quote" title="No quotes yet" body="The next funny thing someone says — tap and keep it." action={<Button size="sm" variant="soft" iconLeft="plus" onClick={() => router.push("/quotes?add=1")}>Add a quote</Button>} style={{ padding: "4px 0" }} /></Section>;
  const who = data.people.find((p) => p.id === q.saidByMemberId);
  const name = who?.greetingName || q.saidByName;
  return (
    <figure style={{ margin: 0, padding: "16px 8px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 14 }}>
      <Icon name="quote" size={20} color="var(--accent)" />
      <blockquote style={{ margin: 0, font: "var(--type-quote)", fontSize: "clamp(var(--fs-xl), 3vw, var(--fs-3xl))", textWrap: "balance", color: "var(--text-primary)", maxWidth: 560 }}>{q.text}</blockquote>
      <figcaption style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        {who ? <Avatar name={who.name} src={who.avatarUrl} person={who.hue} size="sm" /> : null}
        {name ? <span style={{ font: "var(--type-label)" }}>{name}</span> : null}
        {q.saidOn ? <span style={T.cap}>· {new Date(q.saidOn + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span> : null}
        <IconButton icon="plus" label="Add a quote" size="sm" onClick={() => router.push("/quotes?add=1")} />
      </figcaption>
    </figure>
  );
}

function GoalsSection({ data }: { data: HomeData }) {
  const router = useRouter();
  if (!data.goals.length) return <Section title="Family goals" onAction={() => router.push("/goals")}><EmptyState compact icon="target" title="No goals yet" body="Pick one thing to work toward together." action={<Button size="sm" variant="soft" iconLeft="plus" onClick={() => router.push("/goals")}>Add a goal</Button>} style={{ padding: "4px 0" }} /></Section>;
  return (
    <Section title="Family goals" onAction={() => router.push("/goals")}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {data.goals.map((g) => <button key={g.id} type="button" onClick={() => router.push(`/goals/${g.id}`)} style={{ display: "block", width: "100%", textAlign: "left", padding: 0, border: 0, background: "transparent", cursor: "pointer", font: "inherit", color: "inherit" }}><ProgressBar label={g.progressKind === "streak" && g.streak > 1 ? `${g.title} · ${g.streak}-day streak` : g.title} value={g.value} current={g.money ? g.current : g.progressKind === "count" || g.progressKind === "streak" ? `${g.current}` : undefined} target={g.money ? g.target : g.progressKind === "count" || g.progressKind === "streak" ? `${g.target ?? "?"}${g.progressKind === "streak" ? " days" : g.unit ? ` ${g.unit}` : ""}` : undefined} showPercent={g.progressKind === "checkoff"} tone={g.money ? "accent" : "info"} size="sm" /></button>)}
      </div>
    </Section>
  );
}

/** Adults: each kid's day at a glance. A child: their own list with big check-offs. */
function ChoresSection({ data }: { data: HomeData }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [fire, setFire] = React.useState(0);
  const kid = data.viewer.kind === "child";
  const mine = data.chores.people.find((p) => p.memberId === data.viewer.memberId);
  if (kid) {
    if (!mine) return <Section title="Your chores"><Row icon="sun" tint="butter" title="Nothing today" meta="No chores on your list." /></Section>;
    const left = mine.items.filter((i) => !i.done).length;
    return (
      <Section title="Your chores" action={<Badge tone={left ? "neutral" : "positive"} icon={left ? undefined : "circle-check"}>{mine.done}/{mine.total}</Badge>} onAction={() => router.push("/chores")}>
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 2 }}>
          <Celebrate fire={fire} />
          {mine.items.map((it) => <Row key={it.choreId} leading={<Checkbox checked={it.done} size="lg" disabled={busy === it.choreId} onChange={async (v) => { setBusy(it.choreId); await (v ? completeChoreAction(it.choreId, data.todayISO, data.viewer.memberId) : uncompleteChoreAction(it.choreId, data.todayISO)); setBusy(null); if (v && left === 1) setFire((f) => f + 1); router.refresh(); }} style={{ minHeight: 0, padding: 0 }} />} title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: it.done ? "line-through" : "none", opacity: it.done ? 0.65 : 1 }}><Icon name={it.icon ?? "square-check"} size={18} color="var(--text-secondary)" />{it.title}</span>} trailing={it.needsCheck && it.done ? <Badge tone={it.checked ? "positive" : "warning"} size="sm">{it.checked ? "Checked" : "Waiting"}</Badge> : undefined} chevron={false} style={{ minHeight: 56 }} />)}
          {!left ? <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0 0", font: "var(--type-body-sm)", color: "var(--positive)" }}><Icon name="party-popper" size={18} />All done for today</div> : null}
        </div>
      </Section>
    );
  }
  const kids = data.chores.people.filter((p) => data.people.find((x) => x.id === p.memberId)?.kind === "child");
  if (!kids.length) return null;
  return (
    <Section title="Chores today" onAction={() => router.push("/chores")}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {kids.map((k) => { const who = data.people.find((x) => x.id === k.memberId); const all = k.done === k.total; return <Row key={k.memberId} avatar={who ? { name: who.name, src: who.avatarUrl, person: who.hue } : undefined} title={who?.greetingName ?? "Someone"} meta={`${k.done} of ${k.total} done · ${k.points} pt${k.points === 1 ? "" : "s"}${k.streak > 1 ? ` · ${k.streak}-day streak` : ""}`} trailing={all ? <Badge tone="positive" icon="circle-check">Done</Badge> : <Badge tone="neutral">{k.total - k.done} left</Badge>} onClick={() => router.push("/chores")} />; })}
      </div>
    </Section>
  );
}

function RecentPhotos({ data }: { data: HomeData }) {
  const router = useRouter();
  return (
    <Section title="Recent photos" onAction={() => router.push("/photos")} actionLabel="All photos">
      {data.recentPhotos.length ? (
        <div className="zhq-hscroll" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 -16px", padding: "0 16px 4px" }}>
          {data.recentPhotos.map((ph, i) => <ImageCard key={ph.id} src={ph.src} ratio="1 / 1" onClick={() => router.push(`/photos?photo=${ph.id}`)} style={{ width: 104, flex: "none", borderRadius: "var(--radius-photo-sm)", animation: `zh-fade-up var(--dur-base) var(--ease-out) ${i * 40}ms both` }} />)}
          <button type="button" onClick={() => router.push("/photos?add=1")} style={{ width: 104, aspectRatio: "1 / 1", flex: "none", borderRadius: "var(--radius-photo-sm)", border: "1.5px dashed var(--border-strong)", background: "transparent", color: "var(--text-secondary)", display: "grid", placeItems: "center", cursor: "pointer", font: "var(--type-caption)" }}><span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}><Icon name="plus" size={20} />Add</span></button>
        </div>
      ) : <EmptyState compact icon="camera" title="Nothing here yet" body="Add the first photo from your phone and everyone sees it here." action={<Button size="sm" iconLeft="upload" onClick={() => router.push("/photos?add=1")}>Add a photo</Button>} style={{ padding: "4px 0" }} />}
    </Section>
  );
}

function Launcher({ data }: { data: HomeData }) {
  const router = useRouter();
  const g = data.dashboard.groceries;
  const mods = modulesFor(data.viewer.role).filter((m) => !m.primary);
  const counts: Record<string, number | undefined> = { groceries: g.listCount || undefined };
  return (
    <Section title="Everything">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: "8px 0" }}>
        {mods.map((m) => <ModuleTile key={m.slug} icon={m.icon} label={m.name} tint={m.tint} count={counts[m.slug]} muted={m.status === "planned"} onClick={() => router.push(m.href)} />)}
      </div>
    </Section>
  );
}

const Stack = ({ children, gap = "var(--section-gap)", start = 0, style }: { children: React.ReactNode; gap?: string | number; start?: number; style?: React.CSSProperties }) => (
  <Stagger gap={gap} start={start} style={style}>{children}</Stagger>
);

export function HomeScreen({ data }: { data: HomeData }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const narrow = useNarrow(ref);
  const isMember = data.viewer.role === "member";
  const kid = data.viewer.kind === "child";
  const hidden = new Set<string>([]);
  return (
    <div ref={ref} style={{ width: "100%", maxWidth: "var(--content-max)", margin: "0 auto", padding: `${narrow ? 4 : 16}px ${narrow ? "var(--page-gutter-mobile)" : "var(--page-gutter-desktop)"} 48px` }}>
      {kid ? (
        <Stack gap={32}>
          <Stack gap={20}><Greeting data={data} /><FamilyRow data={data} /></Stack>
          <ChoresSection data={data} />
          <TodaySection data={data} />
          <GoalsSection data={data} />
          <PhotoOfDay data={data} narrow={narrow} />
          <QuoteBlock data={data} />
          <RecentPhotos data={data} />
        </Stack>
      ) : narrow ? (
        <Stack gap={32}>
          <Stack gap={20}><Greeting data={data} /><FamilyRow data={data} /></Stack>
          <PhotoOfDay data={data} narrow />
          <TodaySection data={data} />
          <AttentionSection data={data} />
          <ChoresSection data={data} />
          {isMember ? <SpendableSection data={data} /> : <MoneySection data={data} />}
          <QuoteBlock data={data} />
          <RecentPhotos data={data} />
          <GoalsSection data={data} />
          <Launcher data={data} />
        </Stack>
      ) : (
        <Stack gap={40}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "24px 40px", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 320px", minWidth: 0 }}><Greeting data={data} /></div>
            <FamilyRow data={data} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 400px), 1fr))", gap: "40px 56px", alignItems: "start" }}>
            <Stack start={2}><PhotoOfDay data={data} narrow={false} /><TodaySection data={data} /><QuoteBlock data={data} /><RecentPhotos data={data} /></Stack>
            <Stack start={3}><AttentionSection data={data} /><ChoresSection data={data} />{isMember ? <SpendableSection data={data} /> : <MoneySection data={data} />}<GoalsSection data={data} /><Launcher data={data} /></Stack>
          </div>
        </Stack>
      )}
      {hidden.size ? null : null}
      <noscript><Link href="/finance">Finance</Link></noscript>
    </div>
  );
}

/** Skeleton for loading.tsx — the real layout with placeholders. */
export function HomeSkeleton() {
  return (
    <div style={{ width: "100%", maxWidth: "var(--content-max)", margin: "0 auto", padding: "16px var(--page-gutter-mobile) 48px", display: "flex", flexDirection: "column", gap: 32 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}><Skeleton width="30%" /><Skeleton variant="title" width="60%" style={{ height: 36 }} /></div>
      <Reveal><Skeleton variant="photo" ratio="var(--ratio-hero-mobile)" /></Reveal>
      <Skeleton lines={3} />
      <Skeleton lines={2} />
    </div>
  );
}
