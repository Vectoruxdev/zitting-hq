"use client";
/**
 * "Add to Home Screen" — shows once the browser offers the install event
 * (Android/desktop Chrome), or walks iPhone users through Share → Add to Home
 * Screen. Hidden when already installed; dismissal remembered per device.
 */
import * as React from "react";
import { Button, Row, Section } from "@/ui";

interface BeforeInstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }
const KEY = "zhq-install-dismissed";

export function InstallSection() {
  const [evt, setEvt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [state, setState] = React.useState<"unknown" | "installed" | "ios" | "waiting" | "dismissed">("unknown");
  React.useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true);
    let dismissed = false;
    try { dismissed = localStorage.getItem(KEY) === "1"; } catch { /* storage blocked */ }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !("MSStream" in window);
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as BeforeInstallPromptEvent); setState((s) => (s === "installed" || s === "dismissed" ? s : "waiting")); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const onInstalled = () => setState("installed");
    window.addEventListener("appinstalled", onInstalled);
    // setTimeout, not rAF: a hidden tab never gets an animation frame, and the section would stay blank.
    const t = setTimeout(() => setState(standalone ? "installed" : dismissed ? "dismissed" : ios ? "ios" : "waiting"), 0);
    return () => { clearTimeout(t); window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  if (state === "unknown" || state === "installed" || state === "dismissed") return null;
  const dismiss = () => { try { localStorage.setItem(KEY, "1"); } catch { /* storage blocked */ } setState("dismissed"); };
  return (
    <Section title="On your phone" eyebrow="Install">
      <Row icon="house" tint="coral" title="Add Zitting HQ to your home screen" meta={state === "ios" ? "Tap Share, then “Add to Home Screen”. It opens full-screen, like an app." : evt ? "Opens full-screen, like an app, with notifications." : "Your browser will offer it after a couple of visits."} trailing={<span style={{ display: "flex", gap: 6 }}>{evt ? <Button size="sm" iconLeft="download" onClick={async () => { await evt.prompt(); const c = await evt.userChoice; if (c.outcome === "accepted") setState("installed"); }}>Install</Button> : null}<Button size="sm" variant="ghost" onClick={dismiss}>Not now</Button></span>} chevron={false} />
    </Section>
  );
}
