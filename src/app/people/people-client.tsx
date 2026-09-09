"use client";
/** People & permissions — one person at a time: who they are, how they sign in, what they can open, which accounts they see. */
import * as React from "react";
import { useRouter } from "next/navigation";
import { Avatar, Badge, BottomSheet, Button, Checkbox, EmptyState, InlineAlert, Input, Reveal, Row, Section, SegmentedControl, Select, Stagger, Toggle, ToastProvider, useToast } from "@/ui";
import type { AccountAccessRow, HouseholdAccount } from "@/db/permissions";
import * as actions from "./actions";
import { addMember, removeMember, sendInviteEmail, getInviteLink } from "@/app/finance/actions";

export interface PersonAdmin { id: string; name: string; greetingName: string; hue: number; avatarUrl: string | null; kind: "adult" | "child"; role: "owner" | "partner" | "member"; email: string | null; status: string; allowance: number | null; lastSeenAt: string | null }
export interface ModuleLite { slug: string; name: string; icon: string }
interface Props { people: PersonAdmin[]; accounts: HouseholdAccount[]; access: AccountAccessRow[]; moduleAccess: { memberId: string; module: string; allowed: boolean }[]; modules: ModuleLite[]; me: string | null; initialId: string | null }
type Run = (k: string, fn: () => Promise<{ ok: boolean; error?: string | null } | void>, done?: string) => Promise<void>;

const ago = (iso: string | null) => { if (!iso) return null; const d = Math.round((Date.now() - Date.parse(iso)) / 86400000); return d <= 0 ? "today" : d === 1 ? "yesterday" : d < 30 ? `${d} days ago` : `${Math.round(d / 30)} months ago`; };

function Inner(p: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [sel, setSel] = React.useState<string | null>(p.initialId ?? p.people[0]?.id ?? null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [add, setAdd] = React.useState(false);
  const [link, setLink] = React.useState<string | null>(null);
  const person = p.people.find((x) => x.id === sel) ?? null;
  const run: Run = async (key, fn, done) => { setBusy(key); try { const r = await fn(); if (r && !r.ok) toast({ title: r.error || "That didn't save", tone: "negative" }); else if (done) toast({ title: done, tone: "positive" }); router.refresh(); } catch (e) { toast({ title: e instanceof Error ? e.message : "That didn't work", tone: "negative" }); } finally { setBusy(null); } };
  return (
    <div style={{ width: "100%", maxWidth: "var(--content-max)", margin: "0 auto", padding: "16px var(--page-gutter-mobile) 64px", display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      <Reveal>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div><p style={{ margin: "0 0 6px", font: "var(--type-overline)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Who sees what</p><h1 style={{ margin: 0, font: "var(--type-greeting)", fontSize: "clamp(var(--fs-3xl), 5vw, var(--fs-4xl))", letterSpacing: "var(--ls-display)" }}>People & permissions</h1></div>
          <Button iconLeft="user-plus" onClick={() => setAdd(true)}>Add person</Button>
        </div>
      </Reveal>
      <Reveal index={1}>
        <div className="zhq-hscroll" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 calc(-1 * var(--page-gutter-mobile))", padding: "0 var(--page-gutter-mobile) 4px" }}>
          {p.people.map((x) => <button key={x.id} type="button" onClick={() => setSel(x.id)} aria-pressed={sel === x.id} style={{ display: "flex", alignItems: "center", gap: 10, flex: "none", padding: "8px 14px 8px 8px", borderRadius: "var(--radius-pill)", border: sel === x.id ? "1.5px solid var(--text-primary)" : "1px solid var(--border-hairline)", background: sel === x.id ? "var(--surface-card)" : "transparent", cursor: "pointer", font: "inherit", color: "inherit" }}><Avatar name={x.name} src={x.avatarUrl} person={x.hue} size="sm" /><span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2 }}><span style={{ font: "var(--type-body-sm)", fontWeight: 600 }}>{x.greetingName}</span><span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}>{x.role === "owner" ? "Owner" : x.kind === "child" ? "Kid" : x.role === "partner" ? "Partner" : "Adult"}</span></span></button>)}
        </div>
      </Reveal>
      {!person ? <EmptyState icon="users" title="Nobody here yet" body="Add the people in your family. Each gets a login, a color, and their own view of the app." action={<Button iconLeft="user-plus" onClick={() => setAdd(true)}>Add person</Button>} /> : <PersonPanel key={person.id} person={person} p={p} busy={busy} run={run} onLink={setLink} />}
      <AddSheet open={add} onClose={() => setAdd(false)} onAdded={(id) => { toast({ title: "Added", tone: "positive" }); router.refresh(); if (id) setSel(id); }} />
      <BottomSheet open={!!link} onClose={() => setLink(null)} title="Invite link" footer={<Button size="lg" fullWidth variant="ghost" onClick={() => setLink(null)}>Done</Button>}>
        <p style={{ margin: "0 0 10px", font: "var(--type-body-sm)", color: "var(--text-secondary)" }}>Send this to them any way you like. It opens a page to set their password.</p>
        <Input readOnly value={link ?? ""} onFocus={(e) => e.currentTarget.select()} />
        <Button style={{ marginTop: 10 }} iconLeft="copy" onClick={async () => { try { await navigator.clipboard.writeText(link ?? ""); toast({ title: "Copied", tone: "positive" }); } catch { /* clipboard blocked */ } }}>Copy</Button>
      </BottomSheet>
    </div>
  );
}

function PersonPanel({ person, p, busy, run, onLink }: { person: PersonAdmin; p: Props; busy: string | null; run: Run; onLink: (l: string) => void }) {
  const router = useRouter();
  const [name, setName] = React.useState(person.name);
  const [email, setEmail] = React.useState(person.email ?? "");
  const [allowance, setAllowance] = React.useState(person.allowance != null ? String(person.allowance) : "");
  const [confirm, setConfirm] = React.useState(false);
  const isMe = person.id === p.me;
  const privileged = person.role === "owner" || person.role === "partner";
  const grant = (accountId: string) => p.access.find((a) => a.accountId === accountId && a.memberId === person.id)?.access ?? "none";
  const moduleOn = (slug: string) => p.moduleAccess.find((m) => m.memberId === person.id && m.module === slug)?.allowed ?? true;
  const signedIn = person.lastSeenAt ? `Last opened the app ${ago(person.lastSeenAt)}` : person.status === "invited" ? "Invited — hasn't signed in yet" : person.email ? "Has an email, no login yet" : "No login";
  return (
    <Stagger gap={28} start={2}>
      <Section title="About">
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          <Avatar name={person.name} src={person.avatarUrl} person={person.hue} size="xl" />
          <div style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: 12 }}>
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => { if (name.trim() && name.trim() !== person.name) run("name", () => actions.renameAction(person.id, { name }), "Saved"); }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}><span style={{ font: "var(--type-label)", color: "var(--text-secondary)" }}>Grown-up or kid</span><SegmentedControl size="sm" items={[{ key: "adult", label: "Adult", icon: "user" }, { key: "child", label: "Kid", icon: "baby" }]} value={person.kind} onChange={(k) => run("kind", () => actions.setKindAction(person.id, k as "adult" | "child"), "Saved")} /><span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}>Kids get a simpler Home (their chores first) and no money.</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}><span style={{ font: "var(--type-label)", color: "var(--text-secondary)" }}>Their color</span><div style={{ display: "flex", gap: 8 }}>{[1, 2, 3, 4, 5, 6].map((h) => <button key={h} type="button" aria-label={`Color ${h}`} aria-pressed={person.hue === h} onClick={() => run("hue", () => actions.setHueAction(person.id, h))} style={{ width: 32, height: 32, borderRadius: "50%", border: person.hue === h ? "3px solid var(--text-primary)" : "3px solid transparent", background: `var(--person-${h})`, cursor: "pointer", boxShadow: "inset 0 0 0 2px var(--bg-app)" }} />)}</div></div>
          </div>
        </div>
      </Section>

      <Section title="Signing in" action={<Badge tone={person.lastSeenAt ? "positive" : person.status === "invited" ? "info" : "neutral"}>{person.lastSeenAt ? "Signed in" : person.status === "invited" ? "Invited" : "No login"}</Badge>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ font: "var(--type-body-sm)", color: "var(--text-secondary)" }}>{signedIn}</span>
          <span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}>Forgot their password? <b>Reset password</b> emails them a link to choose a new one (or hands you the link to pass along). They can also do it themselves from the sign-in page.</span>
          <Input label="Email" type="email" placeholder="them@example.com" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => { if ((email.trim() || null) !== (person.email ?? null)) run("email", () => actions.renameAction(person.id, { email }), "Saved"); }} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button size="sm" variant="secondary" iconLeft="send" disabled={!email.trim()} loading={busy === "invite"} onClick={() => run("invite", async () => { const r = await sendInviteEmail(email); if (r.link && !r.ok) onLink(r.link); return { ok: r.ok, error: r.error }; }, "Invite sent")}>{person.lastSeenAt ? "Send a reset link" : "Send invite"}</Button>
            <Button size="sm" variant="ghost" iconLeft="link" disabled={!email.trim()} loading={busy === "link"} onClick={() => run("link", async () => { const r = await getInviteLink(email); if (r.ok && r.link) onLink(r.link); return r; })}>Copy a link instead</Button>
            <Button size="sm" variant="ghost" iconLeft="key-round" disabled={!person.email} loading={busy === "reset"} onClick={() => run("reset", async () => { const r = await actions.sendPasswordResetAction(person.id); if (r.link && !r.sent) onLink(r.link); return { ok: r.ok, error: r.sent ? null : r.error }; }, "Reset email sent")}>Reset password</Button>
          </div>
        </div>
      </Section>

      <Section title="Money">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Select label="Finance role" value={person.role} disabled={isMe} options={[{ value: "owner", label: "Owner — sees and runs everything" }, { value: "partner", label: "Partner — sees the whole household" }, { value: "member", label: "Member — their own Spendable view" }]} onChange={(e) => run("role", () => actions.setRoleAction(person.id, e.target.value as PersonAdmin["role"]), "Saved")} hint={isMe ? "That's you — another owner would have to change this." : undefined} />
          {person.role === "member" ? <>
            <Input label="Spending money each month" type="number" inputMode="decimal" placeholder="Not set" value={allowance} onChange={(e) => setAllowance(e.target.value)} onBlur={() => { const v = allowance.trim() === "" ? null : Number(allowance); if (v !== (person.allowance ?? null)) run("allow", () => actions.setAllowanceAction(person.id, v), "Saved"); }} hint="Shown on their Home as what's left this month." />
            <Button size="sm" variant="secondary" iconLeft="eye" onClick={() => router.push(`/finance?as=${person.id}`)} style={{ alignSelf: "flex-start" }}>Preview their money view</Button>
          </> : null}
        </div>
      </Section>

      {person.role !== "owner" ? (
        <Section title="What they can open">
          <div style={{ display: "flex", flexDirection: "column" }}>
            {p.modules.map((m) => <Toggle key={m.slug} label={m.name} checked={moduleOn(m.slug)} disabled={busy === `mod-${m.slug}`} onChange={(v) => run(`mod-${m.slug}`, () => actions.setModuleAccessAction(person.id, m.slug, v))} />)}
          </div>
          <span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}>Home, notifications and their profile are always on. Money follows the finance role above. A switched-off module disappears from their navigation and pages; what’s shared with them stays shared.</span>
        </Section>
      ) : null}

      <Section title="Accounts">
        {privileged ? <InlineAlert tone="info">{person.role === "owner" ? "Owners" : "Partners"} see every household account.</InlineAlert> : !p.accounts.length ? <EmptyState compact icon="landmark" title="No household accounts yet" body="Connect a bank in Finance and they'll appear here." style={{ padding: "4px 0" }} /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {p.accounts.map((a) => <Row key={a.id} icon={a.type === "credit" ? "credit-card" : "landmark"} tint="sky" title={a.name} meta={[a.institution, a.mask ? `••${a.mask}` : null].filter(Boolean).join(" · ")} trailing={<SegmentedControl size="sm" items={[{ key: "none", label: "Off" }, { key: "view", label: "View" }, { key: "manage", label: "Manage" }]} value={grant(a.id)} onChange={(k) => run(`acct-${a.id}`, () => actions.setAccountAccessAction(a.id, person.id, k === "none" ? null : (k as "view" | "manage")))} />} chevron={false} />)}
            <span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)", padding: "6px 0" }}>Manage: in charge — categorizes and approves. View: sees the balance and activity, changes nothing. Shared groceries or bills accounts are usually View for everyone who isn’t in charge.</span>
          </div>
        )}
      </Section>

      {!isMe && person.role !== "owner" ? (
        <Section title="Remove">
          {confirm ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Button variant="danger" loading={busy === "remove"} onClick={() => run("remove", async () => { await removeMember(person.id); router.push("/people"); }, "Removed")}>Really remove {person.greetingName}</Button><Button variant="ghost" onClick={() => setConfirm(false)}>Keep</Button></div> : <Button variant="ghost" iconLeft="trash-2" onClick={() => setConfirm(true)}>Remove {person.greetingName} from the family</Button>}
          <span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}>Their login goes away. Transactions they categorized stay, marked Household.</span>
        </Section>
      ) : null}
    </Stagger>
  );
}

function AddSheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (id: string | null) => void }) {
  const [name, setName] = React.useState(""); const [email, setEmail] = React.useState(""); const [role, setRole] = React.useState("member"); const [kind, setKind] = React.useState<"adult" | "child">("adult"); const [invite, setInvite] = React.useState(true);
  const [busy, setBusy] = React.useState(false); const [error, setError] = React.useState<string | null>(null); const [note, setNote] = React.useState<string | null>(null);
  return (
    <BottomSheet open={open} onClose={onClose} title="Add a person" footer={<><Button size="lg" fullWidth loading={busy} disabled={!name.trim()} onClick={async () => {
      setBusy(true); setError(null); setNote(null);
      try {
        const r = await addMember({ name: name.trim(), email: email.trim() || null, role: kind === "child" ? "member" : role, invite: invite && !!email.trim() });
        const id = (r as { id?: string }).id ?? null;
        if (id && kind === "child") await actions.setKindAction(id, "child");
        if (r.inviteError) setNote(r.inviteError);
        onAdded(id); if (!r.inviteError) onClose();
      } catch (e) { setError(e instanceof Error ? e.message : "Couldn't add"); } finally { setBusy(false); }
    }}>Add</Button><Button size="lg" fullWidth variant="ghost" onClick={onClose}>Cancel</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} error={error ?? undefined} />
        <SegmentedControl items={[{ key: "adult", label: "Adult", icon: "user" }, { key: "child", label: "Kid", icon: "baby" }]} value={kind} onChange={(k) => setKind(k as "adult" | "child")} style={{ alignSelf: "flex-start" }} />
        {kind === "adult" ? <Select label="Finance role" value={role} options={[{ value: "member", label: "Member — their own Spendable view" }, { value: "partner", label: "Partner — sees the whole household" }, { value: "owner", label: "Owner" }]} onChange={(e) => setRole(e.target.value)} /> : null}
        <Input label="Email (for their login)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} hint={kind === "child" ? "Kids don't need a login yet — leave it empty." : undefined} />
        {email.trim() ? <Checkbox label="Email them an invite now" checked={invite} onChange={setInvite} /> : null}
        {note ? <InlineAlert tone="warning" title="Added, but the invite didn't send">{note}</InlineAlert> : null}
      </div>
    </BottomSheet>
  );
}

export function PeopleClient(props: Props) {
  return <ToastProvider><Inner {...props} /></ToastProvider>;
}
