/* Zitting HQ service worker — push notifications + an offline shell.
   App data is authenticated and live, so it is never cached: pages go to the
   network first and fall back to /offline when there is none. Static assets
   (Next chunks, icons, self-hosted fonts) are cached stale-while-revalidate. */
const VERSION = "zhq-v3";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(PAGES);
    await cache.addAll([OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"]).catch(() => {});
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

const isStatic = (url) => url.origin === self.location.origin && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest" || /\.(woff2?|png|svg|ico)$/.test(url.pathname));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, Plaid, fonts CDN: untouched
  if (url.pathname.startsWith("/api/")) return;     // live, authenticated

  if (isStatic(url)) {
    // Stale-while-revalidate: instant from cache, refreshed in the background.
    event.respondWith((async () => {
      const cache = await caches.open(STATIC);
      const hit = await cache.match(req);
      const refresh = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
      return hit || (await refresh) || Response.error();
    })());
    return;
  }

  if (req.mode === "navigate") {
    // Network first; the offline shell only when the network is truly gone.
    event.respondWith((async () => {
      try {
        return await fetch(req);
      } catch {
        const cache = await caches.open(PAGES);
        return (await cache.match(OFFLINE_URL)) || new Response("You're offline.", { status: 503, headers: { "Content-Type": "text/plain" } });
      }
    })());
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Zitting HQ", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Zitting HQ";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { url: data.url || "/notifications", linkTo: data.linkTo || null, notifId: data.notifId || null },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  const url = d.url || "/notifications";
  const notifId = d.notifId || null;
  event.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const isFinance = url.startsWith("/finance");
      for (const client of list) {
        if (!("focus" in client)) continue;
        if (isFinance && client.url.includes("/finance")) {
          await client.focus();
          // Focus alone won't navigate the SPA — tell it which notification to open.
          if (notifId != null && "postMessage" in client) {
            client.postMessage({ type: "open-notif", notifId });
          }
          return;
        }
        if (!isFinance) {
          // Any open app window: bring it forward and take it to the page (Cleaning, Calendar, …).
          await client.focus();
          if ("navigate" in client) { try { await client.navigate(url); } catch (e) { /* uncontrolled window: fall through to a new one */ if (self.clients.openWindow) await self.clients.openWindow(url); } }
          return;
        }
      }
      // No open window: cold-start at the deep-link URL (carries ?notif=<id>).
      if (self.clients.openWindow) await self.clients.openWindow(url);
    })()
  );
});
