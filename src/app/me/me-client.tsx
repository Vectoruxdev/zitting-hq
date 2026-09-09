"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button, IconButton, Input, Reveal, Row, SegmentedControl, Section, Toggle, useToast, ToastProvider } from "@/ui";
import { resizeImage } from "@/lib/image";
import { signOut } from "@/app/login/actions";
import type { Person } from "@/db/profiles";
import { MEMBER_NOTIFICATION_EVENTS, type MemberPref } from "@/lib/notification-events";
import * as actions from "./actions";

const HUES: { n: number; label: string }[] = [{ n: 1, label: "Coral" }, { n: 2, label: "Sky" }, { n: 3, label: "Mint" }, { n: 4, label: "Butter" }, { n: 5, label: "Lilac" }, { n: 6, label: "Rose" }];

function Inner({ person, prefs, canEdit }: { person: Person | null; prefs: MemberPref[]; canEdit: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [greeting, setGreeting] = React.useState(person?.greetingName ?? "");
  const [birthday, setBirthday] = React.useState(person?.birthday ?? "");
  const [hue, setHue] = React.useState(person?.hue ?? 1);
  const [theme, setTheme] = React.useState<"light" | "dark" | "system">(person?.theme ?? "system");
  const [avatar, setAvatar] = React.useState<string | null>(person?.avatarUrl ?? null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [prefState, setPrefState] = React.useState(prefs);
  const file = React.useRef<HTMLInputElement>(null);

  const save = async () => {
    setBusy("profile");
    const r = await actions.updateMyProfile({ greetingName: greeting, hue, birthday: birthday || null });
    setBusy(null);
    toast(r.ok ? { title: "Saved", tone: "positive" } : { title: r.error || "Couldn't save", tone: "negative" });
    if (r.ok) router.refresh();
  };
  const pickTheme = async (t: string) => {
    const v = t as "light" | "dark" | "system";
    setTheme(v);
    try {
      if (v === "dark") { document.documentElement.setAttribute("data-zh-theme", "dark"); localStorage.setItem("zhq-theme", "dark"); }
      else if (v === "light") { document.documentElement.removeAttribute("data-zh-theme"); localStorage.setItem("zhq-theme", "light"); }
      else { document.documentElement.removeAttribute("data-zh-theme"); localStorage.removeItem("zhq-theme"); }
    } catch { /* storage blocked */ }
    await actions.setMyTheme(v);
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy("avatar");
    const blob = await resizeImage(f, { max: 512, square: true });
    const fd = new FormData();
    fd.append("file", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
    const r = await actions.uploadMyAvatar(fd);
    setBusy(null);
    if (r.ok) { setAvatar(r.url ?? null); router.refresh(); toast({ title: "Photo updated", tone: "positive" }); }
    else toast({ title: r.error || "Upload failed", tone: "negative" });
  };
  const togglePref = async (event: string, key: "inApp" | "push" | "email", value: boolean) => {
    setPrefState((ps) => ps.map((p) => (p.event === event ? { ...p, [key]: value } : p)));
    await actions.setMyNotificationPref(event, { [key]: value });
  };

  return (
    <div style={{ width: "100%", maxWidth: "var(--content-max-narrow)", margin: "0 auto", padding: "16px var(--page-gutter-mobile) 64px", display: "flex", flexDirection: "column", gap: "var(--section-gap)" }}>
      <Reveal>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Avatar name={person?.name ?? "You"} src={avatar} person={hue} size="xl" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            <h1 style={{ margin: 0, font: "var(--type-greeting)", fontSize: "var(--fs-3xl)", letterSpacing: "var(--ls-display)" }}>{person?.name ?? "Your profile"}</h1>
            {canEdit ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input ref={file} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => onFile(e.target.files?.[0])} />
                <Button size="sm" variant="secondary" iconLeft="camera" loading={busy === "avatar"} onClick={() => file.current?.click()}>{avatar ? "Change photo" : "Add a photo"}</Button>
                {avatar ? <IconButton icon="trash-2" label="Remove photo" variant="outline" size="sm" onClick={async () => { await actions.removeMyAvatar(); setAvatar(null); router.refresh(); }} /> : null}
              </div>
            ) : <span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}>Your login isn&apos;t linked to a family member yet — the owner can link it in Finance → Settings → Access.</span>}
          </div>
        </div>
      </Reveal>

      <Reveal index={1}>
        <Section title="About you">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input label="What the app calls you" hint="“Good morning, …”" value={greeting} onChange={(e) => setGreeting(e.target.value)} placeholder={person?.name.split(" ")[0] ?? "Name"} disabled={!canEdit} />
            <Input label="Birthday" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} disabled={!canEdit} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ font: "var(--type-label)", color: "var(--text-secondary)" }}>Your color</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {HUES.map((h) => (
                  <button key={h.n} type="button" aria-label={h.label} aria-pressed={hue === h.n} onClick={() => canEdit && setHue(h.n)} style={{ width: 36, height: 36, borderRadius: 18, border: 0, background: `var(--person-${h.n})`, cursor: canEdit ? "pointer" : "default", boxShadow: hue === h.n ? "0 0 0 2px var(--bg-app), 0 0 0 4px var(--text-primary)" : "none", transition: "box-shadow var(--dur-fast)" }} />
                ))}
              </div>
            </div>
            {canEdit ? <div><Button onClick={save} loading={busy === "profile"}>Save</Button></div> : null}
          </div>
        </Section>
      </Reveal>

      <Reveal index={2}>
        <Section title="Appearance">
          <SegmentedControl items={[{ key: "light", label: "Light", icon: "sun" }, { key: "dark", label: "Dark", icon: "moon" }, { key: "system", label: "Auto" }]} value={theme} onChange={pickTheme} />
          <span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}>Light is made for the kitchen in daylight; dark for phones at night. Auto follows the device.</span>
        </Section>
      </Reveal>

      <Reveal index={3}>
        <Section title="Notifications" eyebrow="What reaches you">
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {MEMBER_NOTIFICATION_EVENTS.map((e) => {
              const p = prefState.find((x) => x.event === e.key) || { event: e.key, inApp: true, push: true, email: true };
              return (
                <div key={e.key} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 0" }}>
                  <span style={{ font: "var(--type-body)", fontWeight: 500 }}>{e.label}</span>
                  <span style={{ font: "var(--type-caption)", color: "var(--text-secondary)" }}>{e.body}</span>
                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 2 }}>
                    <Toggle size="sm" label="In app" checked={p.inApp} disabled={!canEdit} onChange={(v) => togglePref(e.key, "inApp", v)} style={{ minHeight: 32 }} />
                    <Toggle size="sm" label="Push" checked={p.push} disabled={!canEdit} onChange={(v) => togglePref(e.key, "push", v)} style={{ minHeight: 32 }} />
                    <Toggle size="sm" label="Email" checked={p.email} disabled={!canEdit} onChange={(v) => togglePref(e.key, "email", v)} style={{ minHeight: 32 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      </Reveal>

      <Reveal index={4}>
        <Section title="Account">
          <Row icon="log-out" tint="coral" title="Sign out" meta="On this device" onClick={() => signOut()} />
        </Section>
      </Reveal>
    </div>
  );
}

export function MeClient(props: { person: Person | null; prefs: MemberPref[]; canEdit: boolean }) {
  return <ToastProvider><Inner {...props} /></ToastProvider>;
}
