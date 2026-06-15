/* Family HQ service worker — receives push and shows notifications. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// A fetch handler is REQUIRED for the app to be installable as a PWA (Android
// Chrome won't offer "Add to Home Screen" without one). We don't cache app data
// (it's authenticated + live), so this is a pass-through that lets the network
// handle every request normally.
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Family HQ", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Family HQ";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { url: data.url || "/finance", linkTo: data.linkTo || null, notifId: data.notifId || null },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  const url = d.url || "/finance";
  const notifId = d.notifId || null;
  event.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of list) {
        if (client.url.includes("/finance") && "focus" in client) {
          await client.focus();
          // Focus alone won't navigate the SPA — tell it which notification to open.
          if (notifId != null && "postMessage" in client) {
            client.postMessage({ type: "open-notif", notifId });
          }
          return;
        }
      }
      // No open window: cold-start at the deep-link URL (carries ?notif=<id>).
      if (self.clients.openWindow) await self.clients.openWindow(url);
    })()
  );
});
