"use client";
/**
 * Quotes — an heirloom, not a database. Fast capture from a phone, a browsable
 * archive, favorites, and sharing. The owner can flag a quote for the login page.
 */
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BottomSheet, Button, Checkbox, EmptyState, IconButton, Input, QuoteCard, RadioGroup, Reveal, SearchField, Select, Tabs, Textarea, ToastProvider, useToast, type Tint } from "@/ui";
import type { Quote } from "@/db/quotes";
import type { Person } from "@/db/profiles";
import * as actions from "./actions";

const TINTS: Tint[] = ["coral", "sky", "mint", "butter", "lilac", "rose"];

function Inner({ quotes, people, viewer }: { quotes: Quote[]; people: Pick<Person, "id" | "name" | "greetingName" | "hue" | "avatarUrl">[]; viewer: { memberId: string | null; role: string } }) {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(params.get("add") === "1");
  const [q, setQ] = React.useState("");
  const [tab, setTab] = React.useState("all");
  const [text, setText] = React.useState("");
  const [saidBy, setSaidBy] = React.useState<string>(people[0]?.id ?? "");
  const [otherName, setOtherName] = React.useState("");
  const [saidOn, setSaidOn] = React.useState(new Date().toISOString().slice(0, 10));
  const [visibility, setVisibility] = React.useState("family");
  const [shared, setShared] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const personOf = (id: string | null) => people.find((p) => p.id === id);
  const shown = quotes
    .filter((x) => tab === "all" || (tab === "saved" ? x.saved : tab === "words" ? x.source === "seed" : tab === "family" ? x.source !== "seed" : x.saidByMemberId === tab))
    .sort((a, b) => (tab === "saved" ? (b.savedAt || "").localeCompare(a.savedAt || "") : 0))
    .filter((x) => !q || x.text.toLowerCase().includes(q.toLowerCase()) || (x.saidByName || "").toLowerCase().includes(q.toLowerCase()));
  const speakers = Array.from(new Set(quotes.map((x) => x.saidByMemberId).filter(Boolean))) as string[];
  const save = async () => {
    setBusy(true);
    const r = await actions.createQuote({ text, saidByMemberId: saidBy === "__other" ? null : saidBy || null, saidByName: saidBy === "__other" ? otherName : null, saidOn, visibility, sharedWith: shared });
    setBusy(false);
    if (r.ok) { setOpen(false); setText(""); toast({ title: "Kept", body: "Added to the family quotes.", tone: "positive" }); router.replace("/quotes"); router.refresh(); }
    else toast({ title: r.error || "Couldn't save", tone: "negative" });
  };
  return (
    <div style={{ width: "100%", maxWidth: "var(--content-max)", margin: "0 auto", padding: "16px var(--page-gutter-mobile) 64px", display: "flex", flexDirection: "column", gap: "var(--section-gap)" }}>
      <Reveal>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div><p style={{ margin: "0 0 6px", font: "var(--type-overline)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Something someone said</p><h1 style={{ margin: 0, font: "var(--type-greeting)", fontSize: "clamp(var(--fs-3xl), 5vw, var(--fs-4xl))", letterSpacing: "var(--ls-display)" }}>Quotes</h1></div>
          <Button iconLeft="plus" onClick={() => setOpen(true)}>Add a quote</Button>
        </div>
      </Reveal>
      {quotes.length ? (
        <Reveal index={1}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <Tabs size="sm" items={[{ key: "all", label: "All", count: quotes.length }, { key: "family", label: "Family", count: quotes.filter((x) => x.source !== "seed").length || undefined }, { key: "words", label: "Scripture & prophets", icon: "book-open", count: quotes.filter((x) => x.source === "seed").length || undefined }, { key: "saved", label: "Saved", icon: "heart", count: quotes.filter((x) => x.saved).length || undefined }, ...speakers.map((id) => ({ key: id, label: personOf(id)?.greetingName || "Someone" }))]} value={tab} onChange={setTab} style={{ flex: "1 1 320px" }} />
            <SearchField size="sm" placeholder="Search quotes" value={q} onChange={setQ} style={{ flex: "0 1 260px" }} />
          </div>
        </Reveal>
      ) : null}
      {!shown.length ? (
        <Reveal index={2}><EmptyState icon="quote" title={quotes.length ? "Nothing matches" : "No quotes yet"} body={quotes.length ? "Try another word or person." : "The next funny thing someone says — tap and keep it. They add up into something you'll read for years."} action={quotes.length ? undefined : <Button iconLeft="plus" onClick={() => setOpen(true)}>Add the first quote</Button>} /></Reveal>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 16, alignItems: "start" }}>
          {shown.map((x, i) => {
            const who = personOf(x.saidByMemberId);
            const tint = who ? TINTS[(who.hue - 1) % 6] : "rose";
            const mine = viewer.role === "owner" || x.addedBy === viewer.memberId;
            return (
              <Reveal key={x.id} index={Math.min(i, 10)}>
                <div style={{ position: "relative" }}>
                  <QuoteCard text={x.text} who={who ? { name: who.name, src: who.avatarUrl ?? undefined, person: who.hue } : { name: x.saidByName ?? undefined, person: 6 }} when={x.saidOn ? new Date(x.saidOn + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : undefined} tint={tint} tone="paper" />
                  <div style={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 2 }}>
                    <IconButton icon="heart" label={x.saved ? "Remove from your saved quotes" : "Save to your quotes"} size="sm" active={x.saved} onClick={async () => { await actions.toggleSaved(x.id, !x.saved); router.refresh(); }} />
                    {viewer.role === "owner" ? <IconButton icon={x.showOnLogin ? "eye" : "eye-off"} label={x.showOnLogin ? "Shown on the login page" : "Show on the login page"} size="sm" active={x.showOnLogin} onClick={async () => { await actions.setShowOnLogin(x.id, !x.showOnLogin); router.refresh(); }} /> : null}
                    {mine ? <IconButton icon="trash-2" label="Delete" size="sm" onClick={async () => { if (confirm("Delete this quote?")) { await actions.removeQuote(x.id); router.refresh(); } }} /> : null}
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      )}
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Keep a quote" footer={<><Button size="lg" fullWidth loading={busy} onClick={save} disabled={!text.trim()}>Keep it</Button><Button size="lg" variant="ghost" fullWidth onClick={() => setOpen(false)}>Cancel</Button></>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Textarea label="What they said" value={text} onChange={(e) => setText(e.target.value)} placeholder="Mom, can the moon come to dinner?" rows={3} />
          <Select label="Who said it" value={saidBy} onChange={(e) => setSaidBy(e.target.value)} options={[...people.map((p) => ({ value: p.id, label: p.name })), { value: "__other", label: "Someone else…" }]} />
          {saidBy === "__other" ? <Input label="Their name" value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="Grandma" /> : null}
          <Input label="When" type="date" value={saidOn} onChange={(e) => setSaidOn(e.target.value)} />
          <RadioGroup label="Who can see it" layout="cards" columns={3} value={visibility} onChange={setVisibility} options={[{ value: "family", label: "Family", description: "Everyone" }, { value: "custom", label: "Some people", description: "Pick who" }, { value: "private", label: "Just me", description: "Owner still sees it" }]} />
          {visibility === "custom" ? <div style={{ display: "flex", flexDirection: "column" }}>{people.filter((p) => p.id !== viewer.memberId).map((p) => <Checkbox key={p.id} label={p.name} checked={shared.includes(p.id)} onChange={(v) => setShared((s) => (v ? [...s, p.id] : s.filter((id) => id !== p.id)))} />)}</div> : null}
        </div>
      </BottomSheet>
    </div>
  );
}

export function QuotesClient(props: React.ComponentProps<typeof Inner>) {
  return <ToastProvider><Inner {...props} /></ToastProvider>;
}
