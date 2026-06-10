/**
 * Client-side Web Push bootstrap. Exposes window.ZHQ_PUSH.{status,enable,disable}
 * to the window-global screens. Talks to the server-action API (window.ZHQ_API)
 * and the public VAPID-key endpoint. No React — plain DOM/SW APIs.
 */
(function () {
  if (typeof window === "undefined") return;

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  const supported =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent || "");
  const isStandalone = () =>
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

  async function register() {
    try {
      return await navigator.serviceWorker.register("/sw.js");
    } catch (e) {
      return null;
    }
  }

  window.ZHQ_PUSH = {
    supported,
    isIOS,
    isStandalone,
    // 'unsupported' | 'ios-needs-install' | 'denied' | 'default' | 'subscribed'
    async status() {
      if (!supported) return "unsupported";
      if (isIOS() && !isStandalone()) return "ios-needs-install";
      if (Notification.permission === "denied") return "denied";
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (sub) return "subscribed";
      } catch (e) {
        /* ignore */
      }
      return "default";
    },
    async enable() {
      if (!supported) {
        alert("This browser doesn’t support notifications.");
        return false;
      }
      if (isIOS() && !isStandalone()) {
        alert(
          "On iPhone: tap the Share icon, choose “Add to Home Screen,” then open Family HQ from your home screen and turn on notifications there."
        );
        return false;
      }
      const reg = await register();
      if (!reg) {
        alert("Couldn’t start the notification service.");
        return false;
      }
      await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return false;
      let publicKey = "";
      try {
        const r = await fetch("/api/push/vapid");
        publicKey = (await r.json()).publicKey || "";
      } catch (e) {
        /* ignore */
      }
      if (!publicKey) {
        alert("Notifications aren’t configured on the server yet.");
        return false;
      }
      let sub;
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      } catch (e) {
        alert("Couldn’t subscribe to notifications: " + ((e && e.message) || e));
        return false;
      }
      const j = sub.toJSON();
      try {
        await window.ZHQ_API.subscribePush({
          endpoint: j.endpoint,
          p256dh: j.keys.p256dh,
          auth: j.keys.auth,
        });
      } catch (e) {
        return false;
      }
      return true;
    },
    async disable() {
      if (!supported) return true;
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();
          try {
            await window.ZHQ_API.unsubscribePush(endpoint);
          } catch (e) {
            /* ignore */
          }
        }
      } catch (e) {
        /* ignore */
      }
      return true;
    },
  };
})();
