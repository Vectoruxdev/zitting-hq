"use client";
/* eslint-disable @next/next/no-img-element -- upload previews are local object URLs */
/**
 * Photos — the family library. Recent stream grouped by day, albums, people,
 * favorites, trash; upload from the phone with on-device prep; a lightbox with
 * favorite / share / info; per-photo audience. The soul of the redesign.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlbumTile, Avatar, Badge, BottomSheet, Button, Checkbox, EmptyState, IconButton, ImageCard, InlineAlert, Input, Lightbox, PhotoGrid, ProgressBar, RadioGroup, Reveal, Row, Section, Stagger, Tabs, Textarea, ToastProvider, useToast,
} from "@/ui";
import type { Album, Photo } from "@/db/photos";
import { groupByDay } from "@/lib/photo-utils";
import { preparePhoto } from "@/lib/photo-upload";
import * as actions from "./actions";

export interface PersonLite { id: string; name: string; greetingName: string; hue: number; avatarUrl: string | null }
interface Props {
  photos: Photo[]; albums: Album[]; people: PersonLite[]; counts: Record<string, number>; todayISO: string;
  viewer: { memberId: string | null; role: "owner" | "partner" | "member" };
  initialTab: string; personId: string | null; openPhotoId: string | null; addOpen: boolean; trash: boolean; album?: Album | null;
}

type UploadState = { name: string; progress: number; error?: string; preview?: string };

function Inner(p: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = React.useState(p.trash ? "trash" : p.initialTab);
  const [open, setOpen] = React.useState<number>(() => (p.openPhotoId ? Math.max(0, p.photos.findIndex((x) => x.id === p.openPhotoId)) : -1));
  const [add, setAdd] = React.useState(p.addOpen);
  const [info, setInfo] = React.useState<Photo | null>(null);
  const [newAlbum, setNewAlbum] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const me = p.viewer.memberId;
  const person = (id: string | null | undefined) => p.people.find((x) => x.id === id) || null;
  const run = async (key: string, fn: () => Promise<unknown>, done?: string) => { setBusy(key); try { const r = (await fn()) as { ok?: boolean; error?: string } | undefined; if (r && r.ok === false) toast({ title: r.error || "That didn't save", tone: "negative" }); else if (done) toast({ title: done, tone: "positive" }); router.refresh(); } finally { setBusy(null); } };

  const shown = tab === "favorites" ? p.photos.filter((x) => x.favorite) : p.photos;
  const groups = groupByDay(shown, p.todayISO);
  const items = shown.map((x) => ({ id: x.id, src: x.thumb ?? x.src ?? undefined, alt: x.caption ?? "" }));
  const lightboxItems = shown.map((x) => { const by = person(x.uploadedBy); return { id: x.id, src: x.src ?? x.thumb ?? "", alt: x.caption ?? "", title: x.caption ?? undefined, when: x.takenAt ? new Date(x.takenAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : undefined, album: x.albums.length ? p.albums.find((a) => a.id === x.albums[0])?.name : undefined, person: by ? { name: by.name, src: by.avatarUrl ?? undefined, person: by.hue } : undefined }; });
  const openPhoto = (id: string | number) => { const i = shown.findIndex((x) => x.id === id); if (i >= 0) { setOpen(i); router.replace(`/photos?photo=${id}`, { scroll: false }); } };
  const closeLightbox = () => { setOpen(-1); router.replace(p.album ? `/photos/albums/${p.album.id}` : "/photos", { scroll: false }); };
  const share = async (item: { src: string; title?: string }) => { try { if (navigator.share) await navigator.share({ title: item.title || "Photo", url: item.src }); else { await navigator.clipboard.writeText(item.src); toast({ title: "Link copied", body: "Good for the next hour.", tone: "positive" }); } } catch { /* cancelled */ } };

  const title = p.album ? p.album.name : tab === "albums" ? "Albums" : tab === "people" ? "People" : tab === "favorites" ? "Favorites" : tab === "trash" ? "Trash" : p.personId ? `${person(p.personId)?.greetingName ?? "Someone"}’s photos` : "Photos";

  return (
    <div style={{ width: "100%", maxWidth: "var(--content-max)", margin: "0 auto", padding: "16px var(--page-gutter-mobile) 64px", display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      <Reveal>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            {p.album ? <button type="button" onClick={() => router.push("/photos?tab=albums")} style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", font: "var(--type-overline)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: "var(--accent)", marginBottom: 6 }}>← Albums</button> : <p style={{ margin: "0 0 6px", font: "var(--type-overline)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: "var(--text-tertiary)" }}>The family library</p>}
            <h1 style={{ margin: 0, font: "var(--type-greeting)", fontSize: "clamp(var(--fs-3xl), 5vw, var(--fs-4xl))", letterSpacing: "var(--ls-display)" }}>{title}</h1>
            {p.album?.description ? <p style={{ margin: "6px 0 0", font: "var(--type-body-sm)", color: "var(--text-secondary)" }}>{p.album.description}</p> : null}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {tab === "albums" && !p.album ? <Button variant="secondary" iconLeft="plus" onClick={() => setNewAlbum(true)}>New album</Button> : null}
            <Button iconLeft="upload" onClick={() => setAdd(true)}>Add photos</Button>
          </div>
        </div>
      </Reveal>
      {!p.album && !p.personId ? <Reveal index={1}><Tabs size="sm" items={[{ key: "recent", label: "Recent", count: p.photos.length || undefined }, { key: "albums", label: "Albums", count: p.albums.length || undefined }, { key: "people", label: "People" }, { key: "favorites", label: "Favorites", icon: "heart" }, ...(p.viewer.role === "owner" ? [{ key: "trash", label: "Trash", icon: "trash-2" }] : [])]} value={tab} onChange={(k) => { setTab(k); if (k === "trash") router.replace("/photos?trash=1"); else if (p.trash) router.replace(`/photos?tab=${k}`); }} /></Reveal> : null}
      {p.personId ? <Reveal index={1}><Button size="sm" variant="ghost" iconLeft="chevron-left" onClick={() => router.push("/photos?tab=people")}>All people</Button></Reveal> : null}

      {(tab === "recent" || tab === "favorites" || tab === "trash" || p.album || p.personId) ? (
        tab === "trash" ? (
          <Stagger gap={20} start={2}>
            <InlineAlert tone="info" title="Trash empties itself after 30 days" action={p.viewer.role === "owner" && p.photos.length ? <Button size="sm" variant="secondary" loading={busy === "purge"} onClick={() => run("purge", () => actions.purgeTrashAction(), "Emptied")}>Empty now</Button> : undefined}>Anything here can still be put back.</InlineAlert>
            {!p.photos.length ? <EmptyState icon="trash-2" title="Nothing in the trash" body="Deleted photos wait here for 30 days." /> : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>{p.photos.map((x) => <div key={x.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}><ImageCard src={x.thumb ?? x.src} ratio="1 / 1" /><Button size="sm" variant="secondary" iconLeft="rotate-ccw" onClick={() => run(`r-${x.id}`, () => actions.restorePhoto(x.id), "Put back")}>Put back</Button></div>)}</div>
            )}
          </Stagger>
        ) : !shown.length ? (
          <Reveal index={2}><PhotoGrid items={[]} emptyTitle={tab === "favorites" ? "No favorites yet" : p.album ? "This album is empty" : "No photos yet"} emptyBody={tab === "favorites" ? "Tap the heart on a photo and it lands here." : "Add the first one from your phone and it will show up here for everyone."} emptyAction={<Button iconLeft="upload" onClick={() => setAdd(true)}>Add photos</Button>} /></Reveal>
        ) : (
          <Stagger gap={28} start={2}>
            {groups.map((g) => (
              <Section key={g.key} title={g.label} action={<span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}>{g.items.length}</span>}>
                <PhotoGrid items={g.items.map((x) => items.find((i) => i.id === x.id)!)} columns={3} gap={6} hero={g.items.length >= 5} onSelect={(it) => openPhoto(it.id)} />
              </Section>
            ))}
          </Stagger>
        )
      ) : null}

      {tab === "albums" && !p.album ? (
        <Stagger gap={24} start={2}>
          {!p.albums.length ? <EmptyState icon="image" title="No albums yet" body="Albums are moments — a lake weekend, kids’ art, the dinners you were proud of." action={<Button iconLeft="plus" onClick={() => setNewAlbum(true)}>Make the first album</Button>} /> : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 160px), 1fr))", gap: 16 }}>{p.albums.map((a) => <AlbumTile key={a.id} cover={a.cover} title={a.name} count={a.count} subtitle={a.visibility !== "family" ? (a.visibility === "private" ? "Just you" : `Shared with ${a.sharedWith.length}`) : undefined} onClick={() => router.push(`/photos/albums/${a.id}`)} />)}</div>
          )}
        </Stagger>
      ) : null}

      {tab === "people" ? (
        <Stagger gap={24} start={2}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 16 }}>
            {p.people.map((x) => <button key={x.id} type="button" onClick={() => router.push(`/photos?person=${encodeURIComponent(x.id)}`)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, border: 0, background: "transparent", cursor: "pointer", font: "inherit", color: "var(--text-primary)", padding: 8, borderRadius: "var(--radius-md)" }}><Avatar name={x.name} src={x.avatarUrl} person={x.hue} size="xl" /><span style={{ font: "var(--type-label)" }}>{x.greetingName}</span><span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}>{p.counts[x.id] ? `${p.counts[x.id]} photo${p.counts[x.id] === 1 ? "" : "s"}` : "No tags yet"}</span></button>)}
          </div>
          <p style={{ margin: 0, font: "var(--type-caption)", color: "var(--text-tertiary)" }}>Tag who’s in a photo from its info panel; people pages fill in from there.</p>
        </Stagger>
      ) : null}

      <Lightbox open={open >= 0} index={Math.max(0, open)} onIndexChange={(i) => { setOpen(i); const x = shown[i]; if (x) router.replace(`/photos?photo=${x.id}`, { scroll: false }); }} onClose={closeLightbox} items={lightboxItems} onFavorite={(it) => run(`fav-${it.id}`, () => actions.favoritePhoto(String(it.id)))} onShare={(it) => share({ src: it.src, title: it.title })} />
      {open >= 0 && shown[open] ? <div style={{ position: "fixed", right: 16, bottom: "calc(88px + env(safe-area-inset-bottom))", zIndex: "var(--z-modal)" }}><IconButton icon="info" label="Details" variant="onPhoto" size="lg" onClick={() => setInfo(shown[open])} /></div> : null}

      {info ? <InfoSheet photo={info} people={p.people} albums={p.albums} me={me} isOwner={p.viewer.role === "owner"} onClose={() => setInfo(null)} run={run} busy={busy} onDeleted={closeLightbox} /> : null}
      <UploadSheet open={add} onClose={() => { setAdd(false); if (p.addOpen) router.replace("/photos", { scroll: false }); }} people={p.people} albums={p.albums} me={me} defaultAlbum={p.album?.id ?? null} onDone={() => router.refresh()} />
      <AlbumSheet open={newAlbum} onClose={() => setNewAlbum(false)} people={p.people} me={me} onCreated={(id) => { setNewAlbum(false); router.push(`/photos/albums/${id}`); }} />
    </div>
  );
}

function UploadSheet({ open, onClose, people, albums, me, defaultAlbum, onDone }: { open: boolean; onClose: () => void; people: PersonLite[]; albums: Album[]; me: string | null; defaultAlbum: string | null; onDone: () => void }) {
  const [queue, setQueue] = React.useState<UploadState[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [albumId, setAlbumId] = React.useState(defaultAlbum ?? "");
  const [tags, setTags] = React.useState<string[]>([]);
  const [visibility, setVisibility] = React.useState("family");
  const [shared, setShared] = React.useState<string[]>([]);
  const [caption, setCaption] = React.useState("");
  const input = React.useRef<HTMLInputElement>(null);
  const files = React.useRef<File[]>([]);
  const pick = (list: FileList | null) => { const arr = Array.from(list || []).filter((f) => f.type.startsWith("image/")).slice(0, 30); files.current = arr; setQueue(arr.map((f) => ({ name: f.name, progress: 0, preview: URL.createObjectURL(f) }))); };
  const start = async () => {
    if (!files.current.length) return;
    setUploading(true);
    for (let i = 0; i < files.current.length; i++) {
      const f = files.current[i];
      try {
        setQueue((q) => q.map((s, j) => (j === i ? { ...s, progress: 0.2 } : s)));
        const prepared = await preparePhoto(f);
        setQueue((q) => q.map((s, j) => (j === i ? { ...s, progress: 0.5 } : s)));
        const fd = new FormData();
        fd.append("full", new File([prepared.full], "full.jpg", { type: "image/jpeg" }));
        fd.append("thumb", new File([prepared.thumb], "thumb.jpg", { type: "image/jpeg" }));
        fd.append("width", String(prepared.width)); fd.append("height", String(prepared.height));
        if (prepared.takenAt) fd.append("takenAt", prepared.takenAt.toISOString());
        fd.append("visibility", visibility); if (albumId) fd.append("albumId", albumId); if (caption && files.current.length === 1) fd.append("caption", caption);
        for (const t of tags) fd.append("people", t); for (const s of shared) fd.append("sharedWith", s);
        const r = await actions.uploadPhoto(fd);
        setQueue((q) => q.map((s, j) => (j === i ? { ...s, progress: 1, error: r.ok ? undefined : r.error } : s)));
      } catch (e) { setQueue((q) => q.map((s, j) => (j === i ? { ...s, progress: 1, error: (e as Error).message || "Upload failed" } : s))); }
    }
    setUploading(false); onDone();
  };
  const done = queue.length > 0 && queue.every((q) => q.progress >= 1);
  const reset = () => { files.current = []; setQueue([]); setCaption(""); };
  return (
    <BottomSheet open={open} onClose={() => { if (!uploading) { reset(); onClose(); } }} title="Add photos" dismissible={!uploading} footer={<>{done ? <Button size="lg" fullWidth onClick={() => { reset(); onClose(); }}>Done</Button> : <Button size="lg" fullWidth iconLeft="upload" disabled={!queue.length} loading={uploading} onClick={start}>{queue.length ? `Add ${queue.length} photo${queue.length === 1 ? "" : "s"}` : "Choose photos first"}</Button>}{!uploading && !done ? <Button size="lg" fullWidth variant="ghost" onClick={() => { reset(); onClose(); }}>Cancel</Button> : null}</>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <input ref={input} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => pick(e.target.files)} />
        {!queue.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Button size="lg" iconLeft="camera" onClick={() => { if (input.current) { input.current.setAttribute("capture", "environment"); input.current.click(); } }}>Camera</Button>
            <Button size="lg" variant="secondary" iconLeft="image" onClick={() => { if (input.current) { input.current.removeAttribute("capture"); input.current.click(); } }}>Library</Button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 8 }}>
            {queue.map((q, i) => <div key={i} style={{ position: "relative", aspectRatio: "1 / 1", borderRadius: "var(--radius-photo-sm)", overflow: "hidden", background: "var(--photo-placeholder)" }}>{q.preview ? <img src={q.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: q.progress >= 1 && !q.error ? 1 : 0.6 }} /> : null}{q.progress > 0 && q.progress < 1 ? <div style={{ position: "absolute", left: 6, right: 6, bottom: 6 }}><ProgressBar value={q.progress} size="sm" /></div> : null}{q.error ? <Badge tone="negative" size="sm" style={{ position: "absolute", left: 4, bottom: 4 }}>Failed</Badge> : q.progress >= 1 ? <Badge tone="positive" size="sm" style={{ position: "absolute", right: 4, top: 4 }}>Added</Badge> : null}</div>)}
          </div>
        )}
        {queue.length && !uploading && !done ? <Button size="sm" variant="ghost" iconLeft="plus" onClick={() => input.current?.click()} style={{ alignSelf: "flex-start" }}>Choose different photos</Button> : null}
        {queue.length === 1 ? <Input label="Caption" placeholder="Saturday at the lake" value={caption} onChange={(e) => setCaption(e.target.value)} disabled={uploading} /> : null}
        <div><span style={{ font: "var(--type-label)", color: "var(--text-secondary)" }}>Who’s in them</span><div style={{ display: "flex", flexWrap: "wrap", gap: "0 14px" }}>{people.map((x) => <Checkbox key={x.id} label={x.greetingName} checked={tags.includes(x.id)} disabled={uploading} onChange={(v) => setTags((t) => (v ? [...t, x.id] : t.filter((i) => i !== x.id)))} style={{ minHeight: 36, padding: "6px 0" }} />)}</div></div>
        {albums.length ? <div style={{ display: "flex", flexDirection: "column", gap: 6 }}><span style={{ font: "var(--type-label)", color: "var(--text-secondary)" }}>Album</span><select value={albumId} onChange={(e) => setAlbumId(e.target.value)} disabled={uploading} style={{ height: 44, borderRadius: "var(--radius-control)", border: "1px solid var(--control-border)", background: "var(--control-bg)", color: "var(--text-primary)", padding: "0 12px", font: "var(--type-control)" }}><option value="">No album</option>{albums.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div> : null}
        <RadioGroup label="Who can see them" layout="cards" columns={3} value={visibility} onChange={setVisibility} options={[{ value: "family", label: "Family", description: "Everyone" }, { value: "custom", label: "Some people", description: "Pick who" }, { value: "private", label: "Just me", description: "Owner still sees it" }]} />
        {visibility === "custom" ? <div style={{ display: "flex", flexWrap: "wrap", gap: "0 14px" }}>{people.filter((x) => x.id !== me).map((x) => <Checkbox key={x.id} label={x.greetingName} checked={shared.includes(x.id)} onChange={(v) => setShared((s) => (v ? [...s, x.id] : s.filter((i) => i !== x.id)))} style={{ minHeight: 36, padding: "6px 0" }} />)}</div> : null}
      </div>
    </BottomSheet>
  );
}

function InfoSheet({ photo, people, albums, me, isOwner, onClose, run, busy, onDeleted }: { photo: Photo; people: PersonLite[]; albums: Album[]; me: string | null; isOwner: boolean; onClose: () => void; run: (k: string, fn: () => Promise<unknown>, done?: string) => Promise<void>; busy: string | null; onDeleted: () => void }) {
  const mine = isOwner || photo.uploadedBy === me;
  const [caption, setCaption] = React.useState(photo.caption ?? "");
  const [tags, setTags] = React.useState<string[]>(photo.people);
  const [visibility, setVisibility] = React.useState(photo.visibility);
  const [shared, setShared] = React.useState<string[]>(photo.sharedWith);
  const [album, setAlbum] = React.useState("");
  const by = people.find((x) => x.id === photo.uploadedBy);
  const save = () => run("meta", () => actions.updatePhotoMeta(photo.id, { caption, people: tags, visibility, sharedWith: shared }), "Saved");
  return (
    <BottomSheet open onClose={onClose} title="Photo details" footer={mine ? <><Button size="lg" fullWidth loading={busy === "meta"} onClick={async () => { await save(); onClose(); }}>Save</Button><Button size="lg" fullWidth variant="ghost" onClick={() => run("trash", async () => { const r = await actions.trashPhoto(photo.id); onClose(); onDeleted(); return r; }, "Moved to trash")}>Delete</Button></> : <Button size="lg" fullWidth variant="ghost" onClick={onClose}>Close</Button>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Row avatar={by ? { name: by.name, src: by.avatarUrl, person: by.hue } : undefined} icon={by ? undefined : "user"} title={by ? `Added by ${by.greetingName}` : "Added"} meta={[photo.takenAt ? new Date(photo.takenAt).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" }) : null, photo.width && photo.height ? `${photo.width}×${photo.height}` : null].filter(Boolean).join(" · ")} chevron={false} />
        {mine ? <Textarea label="Caption" rows={2} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="What’s happening here" /> : photo.caption ? <p style={{ margin: 0, font: "var(--type-body)" }}>{photo.caption}</p> : null}
        <div><span style={{ font: "var(--type-label)", color: "var(--text-secondary)" }}>Who’s in it</span><div style={{ display: "flex", flexWrap: "wrap", gap: "0 14px" }}>{people.map((x) => <Checkbox key={x.id} label={x.greetingName} checked={tags.includes(x.id)} disabled={!mine} onChange={(v) => setTags((t) => (v ? [...t, x.id] : t.filter((i) => i !== x.id)))} style={{ minHeight: 36, padding: "6px 0" }} />)}</div></div>
        {albums.length ? <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}><div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}><span style={{ font: "var(--type-label)", color: "var(--text-secondary)" }}>Add to album</span><select value={album} onChange={(e) => setAlbum(e.target.value)} style={{ height: 44, borderRadius: "var(--radius-control)", border: "1px solid var(--control-border)", background: "var(--control-bg)", color: "var(--text-primary)", padding: "0 12px", font: "var(--type-control)" }}><option value="">Choose…</option>{albums.filter((a) => !photo.albums.includes(a.id)).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div><Button variant="secondary" disabled={!album} onClick={() => run("album", () => actions.addPhotosToAlbum(album, [photo.id]), "Added to the album")}>Add</Button></div> : null}
        {photo.albums.length ? <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{photo.albums.map((id) => <Badge key={id} tone="neutral" icon="image">{albums.find((a) => a.id === id)?.name ?? "Album"}</Badge>)}</div> : null}
        {mine ? <><RadioGroup label="Who can see it" layout="cards" columns={3} value={visibility} onChange={setVisibility} options={[{ value: "family", label: "Family" }, { value: "custom", label: "Some people" }, { value: "private", label: "Just me" }]} />{visibility === "custom" ? <div style={{ display: "flex", flexWrap: "wrap", gap: "0 14px" }}>{people.filter((x) => x.id !== me).map((x) => <Checkbox key={x.id} label={x.greetingName} checked={shared.includes(x.id)} onChange={(v) => setShared((s) => (v ? [...s, x.id] : s.filter((i) => i !== x.id)))} style={{ minHeight: 36, padding: "6px 0" }} />)}</div> : null}</> : null}
        {photo.src ? <a href={photo.src} download target="_blank" rel="noreferrer" style={{ font: "var(--type-label)", color: "var(--accent)" }}>Download original</a> : null}
      </div>
    </BottomSheet>
  );
}

function AlbumSheet({ open, onClose, people, me, onCreated }: { open: boolean; onClose: () => void; people: PersonLite[]; me: string | null; onCreated: (id: string) => void }) {
  const [name, setName] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [visibility, setVisibility] = React.useState("family");
  const [shared, setShared] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  return (
    <BottomSheet open={open} onClose={onClose} title="New album" footer={<><Button size="lg" fullWidth disabled={!name.trim()} loading={busy} onClick={async () => { setBusy(true); const r = await actions.createAlbumAction({ name, description: desc, visibility, sharedWith: shared }); setBusy(false); if (r.ok) onCreated(r.id); }}>Create</Button><Button size="lg" fullWidth variant="ghost" onClick={onClose}>Cancel</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Input label="Name" placeholder="Lake weekend" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="A line about it (optional)" placeholder="Labor Day at Grandma’s" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <RadioGroup label="Who can see it" layout="cards" columns={3} value={visibility} onChange={setVisibility} options={[{ value: "family", label: "Family" }, { value: "custom", label: "Some people" }, { value: "private", label: "Just me" }]} />
        {visibility === "custom" ? <div style={{ display: "flex", flexWrap: "wrap", gap: "0 14px" }}>{people.filter((x) => x.id !== me).map((x) => <Checkbox key={x.id} label={x.greetingName} checked={shared.includes(x.id)} onChange={(v) => setShared((s) => (v ? [...s, x.id] : s.filter((i) => i !== x.id)))} style={{ minHeight: 36, padding: "6px 0" }} />)}</div> : null}
      </div>
    </BottomSheet>
  );
}

export function PhotosClient(props: Props) {
  return <ToastProvider><Inner {...props} /></ToastProvider>;
}
