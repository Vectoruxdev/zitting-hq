"use client";
import * as React from "react";
import {
  AppShell, Avatar, AvatarStack, Badge, BottomSheet, Button, Card, Checkbox, DataTable, DonutChart, AreaChart, Drawer, EmptyState, FlowBar, IconButton, ImageCard, AlbumTile, PhotoGrid, PhotoHero, InlineAlert, Input, Modal, ModuleTile, Money, ProgressBar, ProgressRing, QuoteCard, RadioGroup, Row, SearchField, Section, SegmentedControl, Select, Skeleton, SkeletonCard, Sparkline, StatTile, Stepper, Tabs, Tag, Textarea, Toggle, ToastProvider, useToast, Tooltip, WeekStrip, Reveal, Stagger, Celebrate, DetailList, Lightbox, Dropzone,
  type ShellModule,
} from "@/ui";

// Placeholder people and photos — never real family photos in the repo.
const P = {
  jared: { name: "Jared", person: 1, src: "https://picsum.photos/seed/zh-jared/200/200" },
  jaelynn: { name: "Jaelynn", person: 2, src: "https://picsum.photos/seed/zh-jae/200/200" },
  katelynn: { name: "Katelynn", person: 3, src: "https://picsum.photos/seed/zh-kate/200/200" },
  azaleah: { name: "Azaleah", person: 4 },
};
const MODULES: ShellModule[] = [
  { key: "home", label: "Home", icon: "house", tint: "coral", group: "Family", primary: true },
  { key: "photos", label: "Photos", icon: "image", tint: "rose", group: "Family", primary: true, badge: 6 },
  { key: "meals", label: "Meals", icon: "utensils", tint: "butter", group: "Family", primary: true },
  { key: "groceries", label: "Groceries", short: "List", icon: "shopping-cart", tint: "mint", group: "Family", badge: 7 },
  { key: "calendar", label: "Calendar", short: "Cal", icon: "calendar", tint: "sky", group: "Family" },
  { key: "quotes", label: "Quotes", icon: "quote", tint: "rose", group: "Family" },
  { key: "goals", label: "Goals", icon: "target", tint: "mint", group: "Family" },
  { key: "chores", label: "Chores", icon: "square-check", tint: "butter", group: "Family", muted: true },
  { key: "money", label: "Finance", icon: "wallet", tint: "sky", group: "Money", primary: true, badge: 3 },
  { key: "cameras", label: "Cameras", icon: "video", tint: "lilac", group: "Home" },
];

function Block({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <Section title={title} style={{ gridColumn: wide ? "1 / -1" : undefined }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>{children}</div>
    </Section>
  );
}

function Toasts() {
  const { toast } = useToast();
  return (
    <>
      <Button variant="secondary" onClick={() => toast({ title: "Receipt saved", body: "Matched to Target · $42.18", tone: "positive" })}>Toast</Button>
      <Button variant="secondary" onClick={() => toast({ title: "Removed from the list", action: { label: "Undo" } })}>Toast with undo</Button>
    </>
  );
}

export function Gallery() {
  const [theme, setTheme] = React.useState<"light" | "dark">("light");
  const [modal, setModal] = React.useState(false);
  const [sheet, setSheet] = React.useState(false);
  const [sheetForm, setSheetForm] = React.useState(false);
  const [drawer, setDrawer] = React.useState(false);
  const [box, setBox] = React.useState(false);
  const [fire, setFire] = React.useState(0);
  const [active, setActive] = React.useState("home");
  const [range, setRange] = React.useState("month");
  React.useEffect(() => {
    if (theme === "dark") document.documentElement.setAttribute("data-zh-theme", "dark");
    else document.documentElement.removeAttribute("data-zh-theme");
  }, [theme]);
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + i); return { date: d, dots: i % 2 ? ["var(--hue-sky)"] : [] }; });
  const stream = Array.from({ length: 9 }, (_, i) => ({ id: i, src: `https://picsum.photos/seed/zh-s${i}/500/500` }));
  return (
    <ToastProvider>
      <div style={{ minHeight: "100dvh", background: "var(--bg-app)", color: "var(--text-primary)", padding: "24px clamp(16px, 4vw, 40px) 80px", position: "relative" }}>
        <Celebrate fire={fire} />
        <header style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 32 }}>
          <h1 style={{ margin: 0, font: "var(--type-greeting)", fontSize: "var(--fs-3xl)" }}>Design system</h1>
          <span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}>src/ui · ported from the Claude Design project</span>
          <span style={{ flex: 1 }} />
          <SegmentedControl size="sm" items={[{ key: "light", label: "Light", icon: "sun" }, { key: "dark", label: "Dark", icon: "moon" }]} value={theme} onChange={(k) => setTheme(k as "light" | "dark")} />
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: "40px 56px", alignItems: "start" }}>
          <Block title="Buttons">
            <Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="ghost">Ghost</Button><Button variant="soft" iconLeft="plus">Soft</Button><Button variant="danger">Danger</Button>
            <Button size="sm" iconLeft="camera">Small</Button><Button size="lg" iconRight="arrow-right">Large</Button><Button loading>Saving</Button><Button disabled>Disabled</Button>
            <IconButton icon="heart" label="Favorite" /><IconButton icon="pencil" label="Edit" variant="outline" /><IconButton icon="plus" label="Add" variant="filled" /><IconButton icon="bell" label="Alerts" badge={3} />
            <Tooltip label="Tooltips are ink pills"><IconButton icon="info" label="Info" /></Tooltip>
          </Block>

          <Block title="Form controls">
            <Input label="Dish" placeholder="Street tacos" hint="What's for dinner" style={{ minWidth: 220 }} />
            <Input label="Amount" money prefix="$" defaultValue="42.18" error="A little short" style={{ minWidth: 160 }} />
            <Select label="Cook" options={["Jaelynn", "Katelynn", "Jared"]} style={{ minWidth: 180 }} />
            <Textarea label="Prep notes" placeholder="Bring the insurance card" style={{ minWidth: 260 }} />
            <SearchField placeholder="Search recipes" />
            <Stepper label="Eggs" defaultValue={2} unit="dz" />
            <Toggle label="Push notifications" description="Swap requests and reminders" defaultChecked />
            <Checkbox label="Cilantro" description="Jaelynn · tacos" size="lg" defaultChecked />
            <RadioGroup label="Give tonight to" layout="cards" columns={2} options={[{ value: "k", label: "Katelynn", description: "Wednesday", icon: "chef-hat" }, { value: "j", label: "Jared", description: "Friday", icon: "chef-hat" }]} defaultValue="k" style={{ width: "100%" }} />
          </Block>

          <Block title="Badges, tags, avatars">
            <Badge>Neutral</Badge><Badge tone="accent">3 to review</Badge><Badge tone="positive" icon="circle-check">Reviewed</Badge><Badge tone="negative" icon="triangle-alert">Short $120</Badge><Badge tone="warning">Low</Badge><Badge tone="info" icon="stethoscope">Appt</Badge><Badge tone="accent" solid>12</Badge>
            <Tag>Groceries</Tag><Tag selected>Kids</Tag><Tag color="var(--hue-mint)" onClick={() => {}}>Produce</Tag><Tag icon="tag" onRemove={() => {}}>Dining out</Tag>
            <Avatar {...P.jared} size="lg" /><Avatar {...P.jaelynn} size="md" ring /><Avatar {...P.azaleah} size="md" status="online" /><AvatarStack people={[P.jared, P.jaelynn, P.katelynn, P.azaleah, { name: "Jae", person: 6 }]} max={3} />
          </Block>

          <Block title="Sections and rows">
            <div style={{ width: "100%" }}>
              <Row icon="chef-hat" tint="butter" title="Your night — Street tacos" meta={<>6:30 · <span style={{ color: "var(--warning)" }}>still need cilantro and limes</span></>} trailing={<Button size="sm" variant="soft">Swap</Button>} onClick={() => {}} chevron={false} />
              <Row avatar={P.azaleah} title="Dentist — Azaleah" meta="3:30 · Sunrise Pediatric Dental · Katelynn drives" trailing={<Badge tone="info" icon="stethoscope">Appt</Badge>} onClick={() => {}} />
              <Row time="8:15" title="School drop-off" meta="Azaleah, Emerick" onClick={() => {}} />
              <Row tone="soft" tint="coral" icon="receipt" title="3 purchases waiting for review" meta="Jaelynn 2 · Katelynn 1" onClick={() => {}} style={{ margin: 0, boxSizing: "border-box", padding: "8px 12px" }} />
              <Row icon="circle-check" tint="mint" title="All clear" meta="Nothing needs you right now." />
            </div>
          </Block>

          <Block title="Cards and tiles">
            <Card title="Sheet-pan chicken" eyebrow="Monday" media="https://picsum.photos/seed/zh-m1/400/300" onClick={() => {}} style={{ maxWidth: 260 }}><span style={{ font: "var(--type-caption)", color: "var(--text-secondary)" }}>Katelynn&apos;s night</span></Card>
            <Card title="Bills" eyebrow="Account" icon="landmark" intensity="finance" action={<Badge tone="negative">Short</Badge>} style={{ maxWidth: 260 }}><Money value={1330} size="lg" /><ProgressBar value={1330 / 1450} tone="budget" size="sm" current={1330} target={1450} /></Card>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 72px)", gap: 4 }}>{MODULES.slice(0, 8).map((m) => <ModuleTile key={m.key} icon={m.icon} label={m.label} tint={m.tint} count={m.badge} muted={m.muted} onClick={() => {}} />)}</div>
          </Block>

          <Block title="Money and numbers">
            <Money value={318.4} size="xl" animate /><Money value={-42.18} /><Money value={600} sign /><Money value={6420} size="lg" cents={false} tone="muted" />
            <StatTile label="Spent this month" value={2418.22} delta={-4} icon="wallet" chart={<Sparkline values={[400, 900, 1300, 1700, 1980, 2200, 2418]} tone="accent" />} style={{ minWidth: 220 }} />
            <StatTile label="Saved" value={320} delta={12} icon="piggy-bank" chart={<Sparkline values={[200, 220, 260, 280, 300, 300, 320]} />} style={{ minWidth: 220 }} />
            <StatTile label="Loading" value={0} loading style={{ minWidth: 220 }} />
            <ProgressRing value={0.71} tone="hue-mint" label="Read together" /><ProgressRing value={1} size={72} />
            <DetailList style={{ width: "100%", maxWidth: 360 }} items={[{ label: "Merchant", value: "Target", icon: "receipt" }, { label: "Amount", value: <Money value={-42.18} /> }, { label: "Category", value: "Kids", icon: "tag" }]} />
          </Block>

          <Block title="Charts" wide>
            <div style={{ width: "100%", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 24 }}>
              <div><SegmentedControl size="sm" items={[{ key: "month", label: "Month" }, { key: "quarter", label: "Quarter" }]} value={range} onChange={setRange} style={{ marginBottom: 12 }} /><AreaChart labels={["1", "5", "10", "15", "20", "25", "30"]} series={[{ label: "Income", color: "var(--data-2)", values: range === "month" ? [0, 3210, 3210, 3210, 6420, 6420, 6420] : [6420, 6420, 6420, 6420, 6420, 6420, 6420] }, { label: "Spend", color: "var(--data-1)", values: range === "month" ? [120, 640, 1210, 1880, 2400, 3050, 3480] : [3900, 3450, 3480, 3100, 3600, 3300, 3700] }]} /></div>
              <DonutChart segments={[{ label: "Groceries", value: 812, color: "var(--hue-mint)" }, { label: "Kids", value: 410, color: "var(--hue-sky)" }, { label: "Dining out", value: 296, color: "var(--hue-coral)" }, { label: "Gas", value: 230, color: "var(--hue-butter)" }]} size={160} />
              <FlowBar total={3210} segments={[{ label: "Bills", value: 1450, color: "var(--hue-sky)" }, { label: "Groceries", value: 600, color: "var(--hue-mint)" }, { label: "Spendable", value: 600, color: "var(--hue-coral)" }, { label: "Savings", value: 320, color: "var(--hue-lilac)" }]} />
              <DataTable density="finance" defaultSort={{ key: "amount", dir: "desc" }} columns={[{ key: "date", label: "Date", sortable: true, muted: true }, { key: "merchant", label: "Merchant", sortable: true }, { key: "category", label: "Category" }, { key: "amount", label: "Amount", numeric: true, sortable: true, render: (v) => <Money value={v as number} size="sm" /> }]} rows={[{ id: 1, date: "Sep 8", merchant: "Target", category: "Kids", amount: -42.18 }, { id: 2, date: "Sep 7", merchant: "Chick-fil-A", category: "Dining out", amount: -18.4 }, { id: 3, date: "Sep 1", merchant: "Allowance", category: "Transfer", amount: 600 }]} onRowClick={() => setDrawer(true)} />
            </div>
          </Block>

          <Block title="Feedback">
            <InlineAlert tone="negative" title="Bank sync failed" action={<Button size="sm" variant="secondary">Reconnect</Button>}>Chase hasn&apos;t responded since Tuesday.</InlineAlert>
            <InlineAlert tone="positive" title="All reviewed">Jaelynn&apos;s allowance is unlocked.</InlineAlert>
            <EmptyState compact icon="quote" title="No quotes yet" body="The next funny thing someone says — tap and keep it." action={<Button size="sm" variant="soft" iconLeft="plus">Add a quote</Button>} />
            <EmptyState tone="error" title="Couldn't load photos" body="Check the connection and try again." action={<Button size="sm" variant="secondary" iconLeft="refresh-cw">Retry</Button>} style={{ maxWidth: 360 }} />
            <SkeletonCard photo style={{ width: 240 }} /><Skeleton lines={3} width={200} />
            <Toasts />
            <Button variant="soft" iconLeft="party-popper" onClick={() => setFire((f) => f + 1)}>Celebrate</Button>
          </Block>

          <Block title="Overlays and navigation">
            <Button variant="secondary" onClick={() => setModal(true)}>Modal</Button><Button variant="secondary" onClick={() => setSheet(true)}>Bottom sheet</Button><Button variant="secondary" onClick={() => setSheetForm(true)}>Long form sheet</Button><Button variant="secondary" onClick={() => setDrawer(true)}>Drawer</Button><Button variant="secondary" onClick={() => setBox(true)}>Lightbox</Button>
            <Tabs items={[{ key: "home", label: "Home" }, { key: "activity", label: "Activity", count: 12 }, { key: "review", label: "Review", count: 2 }]} style={{ width: "100%" }} />
            <WeekStrip days={week} value={new Date()} style={{ width: "100%" }} />
          </Block>

          <Block title="Photos" wide>
            <div style={{ width: "100%", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 24, alignItems: "start" }}>
              <PhotoHero src="https://picsum.photos/seed/zh-lake/1200/800" eyebrow="Photo of the day" title="Saturday at the lake" subtitle="Added by Katelynn · 42 more in “Lake weekend”" actions={<Button variant="onPhoto" size="sm" iconLeft="image">Open album</Button>} topRight={<><IconButton icon="heart" label="Favorite" variant="onPhoto" size="sm" /><IconButton icon="camera" label="Add" variant="onPhoto" size="sm" /></>} />
              <PhotoHero onAddPhoto={() => {}} />
              <PhotoGrid items={stream} columns={3} hero onSelect={() => setBox(true)} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}><AlbumTile cover="https://picsum.photos/seed/zh-art/400/400" title="Kids’ art" count={18} onClick={() => {}} /><AlbumTile title="First day of school" onClick={() => {}} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}><ImageCard src="https://picsum.photos/seed/tacos/600/450" title="Street tacos" caption="Tuesday" personName="Jaelynn" person={2} onFavorite={() => {}} /><ImageCard src="https://picsum.photos/seed/zh-m4/600/450" title="Pasta bake" overlayTitle caption="Thursday" badge="Recipe" /></div>
              <Dropzone files={[{ name: "a.jpg", src: "https://picsum.photos/seed/zh-r1/200/200" }, { name: "b.jpg", src: "https://picsum.photos/seed/zh-r2/200/200" }]} progress={{ "a.jpg": 1, "b.jpg": 0.45 }} />
              <QuoteCard text="Mom, can the moon come to dinner?" who={{ name: "Jae", person: 6 }} age={4} when="Last Tuesday" tone="paper" />
            </div>
          </Block>

          <Block title="AppShell · phone frame (392) and desktop" wide>
            <div style={{ width: 392, height: 720, borderRadius: 44, overflow: "hidden", boxShadow: "0 0 0 10px #2a2930, var(--shadow-3)", flex: "none", position: "relative" }}>
              <AppShell modules={MODULES} active={active} onNavigate={setActive} user={P.jaelynn} mode="phone" onAction={() => setSheet(true)}>
                <div style={{ padding: "8px 16px 24px", height: "100%", overflow: "auto" }}>
                  <Stagger gap={24}>
                    <div><h2 style={{ margin: 0, font: "var(--type-greeting)", fontSize: "var(--fs-3xl)" }}>Good afternoon, Jaelynn.</h2><p style={{ margin: "6px 0 0", font: "var(--type-body-sm)", color: "var(--text-secondary)" }}>Tuesday, September 8</p></div>
                    <PhotoHero src="https://picsum.photos/seed/zh-lake/900/720" ratio="var(--ratio-hero-mobile)" eyebrow="Photo of the day" title="Saturday at the lake" />
                    <Section title="Today" onAction={() => setActive("calendar")} actionLabel="Calendar"><Row icon="chef-hat" tint="butter" title="Your night — Street tacos" meta="6:30" trailing={<Button size="sm" variant="soft">Swap</Button>} chevron={false} onClick={() => {}} /></Section>
                    <p style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}>Active: {active}</p>
                  </Stagger>
                </div>
              </AppShell>
            </div>
            <div style={{ flex: "1 1 600px", height: 520, minWidth: 0, borderRadius: "var(--radius-card)", overflow: "hidden", border: "1px solid var(--border-hairline)" }}>
              <AppShell modules={MODULES} active={active} onNavigate={setActive} user={P.jared} mode="desktop" onSignOut={() => {}}>
                <div style={{ padding: 24 }}><Reveal><h2 style={{ margin: 0, font: "var(--type-greeting)" }}>Good afternoon, Jared.</h2></Reveal></div>
              </AppShell>
            </div>
          </Block>
        </div>

        <Modal open={modal} onClose={() => setModal(false)} title="Swap dinner night" description="Tonight is Jaelynn’s. Give it to someone and take their next night." size="sm" footer={<><Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button><Button onClick={() => setModal(false)}>Ask Katelynn to swap</Button></>}>
          <Select label="Give tonight to" options={["Katelynn (Wed)", "Jared (Fri)"]} defaultValue="Katelynn (Wed)" />
        </Modal>
        <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Add" footer={<Button size="lg" fullWidth iconLeft="camera" onClick={() => setSheet(false)}>Open camera</Button>}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{[["image", "A photo"], ["receipt", "A receipt"], ["quote", "A quote"], ["shopping-cart", "To the list"]].map(([ic, t]) => <Card key={t} icon={ic} title={t} intensity="finance" onClick={() => setSheet(false)} />)}</div>
        </BottomSheet>
        <BottomSheet open={sheetForm} onClose={() => setSheetForm(false)} title="New recipe" footer={<><Button size="lg" fullWidth onClick={() => setSheetForm(false)}>Save recipe</Button><Button size="lg" fullWidth variant="ghost" onClick={() => setSheetForm(false)}>Cancel</Button></>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Input label="Name" placeholder="Sheet-pan chicken" />
            <Input label="Ingredient" placeholder="Chicken thighs" />
            <Input label="Ingredient" placeholder="Red onion" />
            <Input label="Ingredient" placeholder="Lemon" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><Input label="Serves" type="number" inputMode="numeric" /><Input label="Minutes" type="number" inputMode="numeric" /></div>
            <Input label="Tags" hint="comma separated · weeknight, kids love it" />
            <Input label="Where it's from" type="url" placeholder="https://…" />
            <Textarea label="Notes" placeholder="Oven temp, the trick that makes it work…" />
          </div>
        </BottomSheet>
        <Drawer open={drawer} onClose={() => setDrawer(false)} title="Target" description="Sep 8 · Kids" footer={<Button onClick={() => setDrawer(false)}>Done</Button>}>
          <DetailList items={[{ label: "Amount", value: <Money value={-42.18} /> }, { label: "Account", value: "Jaelynn’s card" }, { label: "Receipt", value: "Attached" }]} />
        </Drawer>
        <Lightbox open={box} onClose={() => setBox(false)} items={stream.map((s) => ({ ...s, title: "Lake weekend", when: "Saturday", person: P.katelynn }))} onFavorite={() => {}} />
      </div>
    </ToastProvider>
  );
}
