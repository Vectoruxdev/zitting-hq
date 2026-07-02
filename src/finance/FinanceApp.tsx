"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Zitting Finance — client entry.
 *
 * The screens were authored to mount against a generated runtime bundle: each
 * screen registers itself on `window.ZHQ*`, reads design-system components off
 * `window.ZittingHQDesignSystem_c9e528`, data off `window.ZHQ_DATA`, and icons
 * off `window.ZT_ICONS`. We recreate that environment here, then port the
 * router that the prototype's index.html ran inline.
 *
 * This module is only ever loaded on the client (via a dynamic import with
 * ssr:false), so touching `window` at module scope is safe.
 */
import React from "react";
import { useRouter } from "next/navigation";
import { DS } from "./ds";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { MOCK_FINANCE_DATA } from "./data/mockData";
import { signOut } from "@/app/login/actions";
import * as ZHQApi from "@/app/finance/actions";

// Side-effect imports: populate window with icons, and register every screen as
// a window.ZHQ* global. Order doesn't matter — screens only read the namespace
// and window.ZHQ_DATA at render time, by which point the globals below are set.
// (Data now comes from the server via the `data` prop, not a static appdata.js.)
import "./assets/icons.js";
import "./screens/Shell.jsx";
import "./screens/Hubs.jsx";
import "./screens/Skeletons.jsx";
import "./screens/Overview.jsx";
import "./screens/Accounts.jsx";
import "./screens/Transactions.jsx";
import "./screens/Budgets.jsx";
import "./screens/Income.jsx";
import "./screens/Bills.jsx";
import "./screens/Transfers.jsx";
import "./screens/Allocations.jsx";
import "./screens/Savings.jsx";
import "./screens/Receipts.jsx";
import "./screens/Notifications.jsx";
import "./screens/NotificationDetail.jsx";
import "./screens/Ask.jsx";
import "./screens/Access.jsx";
import "./screens/Spendable.jsx";
import "./screens/Onboarding.jsx";
import "./screens/Import.jsx";
import "./screens/Categories.jsx";
import "./screens/Bulk.jsx";
import "./screens/Learned.jsx";
import "./screens/shared/pushPrompt.jsx";
import "./plaidLink.js";
import "./push.js";

const w = (typeof window !== "undefined" ? window : {}) as any;

// Old route ids → hub route + tab. Routes are pure client state (no URLs);
// "deep links" are the onNavigate('…') call sites across screens, and all of
// them must keep resolving after the nav consolidation.
const ALIASES: Record<string, { route: string; tab: string }> = {
  bulk: { route: "transactions", tab: "tidy" },
  import: { route: "transactions", tab: "import" },
  allocations: { route: "transfers", tab: "rules" },
  bills: { route: "income", tab: "bills" },
  categories: { route: "settings", tab: "categories" },
  learned: { route: "settings", tab: "learned" },
  receipts: { route: "settings", tab: "receipts" },
};

// Routes that may be restored after a page reload. The current position is
// kept in sessionStorage so a refresh re-opens the same screen instead of
// resetting to Overview; a brand-new tab/session still lands on the default.
// "member" is the owner's view-as-member preview.
const RESTORABLE_ROUTES = new Set([
  "overview", "accounts", "transactions", "budgets", "transfers", "savings",
  "income", "notifications", "ask", "settings", "member", "onboarding",
]);
function savedPosition(isMember: boolean): { route: string; tab: string | null } {
  const fallback = { route: isMember ? "member" : "overview", tab: null as string | null };
  if (isMember || typeof window === "undefined") return fallback;
  try {
    const route = sessionStorage.getItem("zhq-route");
    if (!route || !RESTORABLE_ROUTES.has(route)) return fallback;
    return { route, tab: sessionStorage.getItem("zhq-hub-tab") };
  } catch {
    return fallback; // storage blocked (private mode) — default position
  }
}

// Expose the design-system namespace exactly as the screens expect it.
if (typeof window !== "undefined") {
  w.ZittingHQDesignSystem_c9e528 = DS;
  // Expose server-action API to the window-global screens.
  w.ZHQ_API = ZHQApi;

  // Theme bootstrap (ported from the prototype's index.html inline script).
  if (!w.__zhqSetTheme) {
    w.__zhqTheme = localStorage.getItem("zhq-theme") || "dark";
    if (w.__zhqTheme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    }
    w.__zhqSetTheme = (t: string) => {
      w.__zhqTheme = t;
      localStorage.setItem("zhq-theme", t);
      if (t === "light") document.documentElement.setAttribute("data-theme", "light");
      else document.documentElement.removeAttribute("data-theme");
      // Keep the browser chrome (notch/status bar) matched to the theme.
      const m = document.querySelector('meta[name="theme-color"]');
      if (m) m.setAttribute("content", t === "light" ? "#FFFFFF" : "#0E0E10");
    };
  }
}

export default function FinanceApp({
  data,
  role = "owner",
  name,
}: {
  data?: any;
  role?: "owner" | "partner" | "member";
  name?: string;
}) {
  // Make the finance data available to the window-global screens before they
  // render. Falls back to the curated mock when no server data was supplied.
  if (typeof window !== "undefined") {
    w.ZHQ_DATA = data || MOCK_FINANCE_DATA;
    w.ZHQ_USER = { name, role };
  }

  const router = useRouter();
  const isMember = role === "member";
  // Restore the pre-refresh position (sessionStorage); see savedPosition().
  const saved = savedPosition(isMember);
  const [route, setRoute] = React.useState(saved.route);
  // Active tab within a hub screen (Transactions/Transfers/Income/Settings).
  // Owned here (not in the hub) so alias navigations land on a specific tab.
  const [hubTab, setHubTab] = React.useState<string | null>(saved.tab);
  // True while a post-mutation router.refresh() is in flight. Drives the
  // topbar LoadingBar only — the current data stays on screen meanwhile.
  const [refreshing, startRefresh] = React.useTransition();
  const [booting, setBooting] = React.useState(true);
  const [bootFade, setBootFade] = React.useState(false);
  // Bumped whenever fresh server `data` arrives (after a mutation +
  // router.refresh()); used in the screen `key` to force a re-render.
  const [dataVersion, setDataVersion] = React.useState(0);
  // The notification whose detail overlay is open (id, string id, or full row).
  const [openNotif, setOpenNotif] = React.useState<number | string | Record<string, unknown> | null>(null);
  // Global error surface: most screens call server actions with try/finally
  // and no catch, so a thrown action (auth guard, DB blip, deployment skew
  // from auto-deploy + a long-lived tab) used to fail SILENTLY. One
  // unhandledrejection listener turns all of those into a visible toast.
  const [appError, setAppError] = React.useState<string | null>(null);

  if (typeof window !== "undefined") {
    w.ZHQ_REFRESH = () => startRefresh(() => router.refresh());
    w.ZHQ_LOGOUT = () => signOut();
    // Any surface (feed, bell, push) opens the notification detail via this.
    w.ZHQ_OPEN_NOTIF = (x: number | string | Record<string, unknown>) => setOpenNotif(x);
    w.ZHQ_CLOSE_NOTIF = () => setOpenNotif(null);
  }

  // Deep-link to a notification: ?notif=<id> on cold start, or a serviceWorker
  // postMessage when an already-open tab is focused by a push click.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const u = new URL(window.location.href);
      const nid = u.searchParams.get("notif");
      if (nid) {
        setOpenNotif(/^\d+$/.test(nid) ? Number(nid) : nid);
        u.searchParams.delete("notif");
        window.history.replaceState({}, "", u.pathname + u.search + u.hash);
      }
    } catch {
      /* no-op */
    }
    const onMsg = (e: MessageEvent) => {
      if (e.data && e.data.type === "open-notif" && e.data.notifId != null) setOpenNotif(e.data.notifId);
    };
    if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", onMsg);
    return () => {
      if ("serviceWorker" in navigator) navigator.serviceWorker.removeEventListener("message", onMsg);
    };
  }, []);

  // Register the service worker on load (not just when enabling push) so the app
  // is installable as a PWA ("Add to Home Screen") for everyone.
  React.useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onRejection = (e: PromiseRejectionEvent) => {
      const msg = String((e.reason && ((e.reason as Error).message || e.reason)) || "");
      // Next.js control-flow sentinels ride on rejections — never toast those.
      if (/NEXT_REDIRECT|AbortError/i.test(msg)) return;
      const skew = /Server Action|Failed to fetch|fetch failed|Load failed/i.test(msg);
      setAppError(
        skew
          ? "Zitting HQ was updated since this page loaded — refresh to continue."
          : "That didn’t save. Try again, or refresh the page."
      );
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);

  React.useEffect(() => {
    if (!appError) return;
    const t = setTimeout(() => setAppError(null), 8000);
    return () => clearTimeout(t);
  }, [appError]);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      w.ZHQ_DATA = data || MOCK_FINANCE_DATA;
      setDataVersion((v) => v + 1);
    }
  }, [data]);

  // Current position, mirrored in a ref so navigate() can no-op when asked to
  // go where we already are (otherwise loading would stick: the clearing
  // effect below only refires when route/hubTab actually change).
  const posRef = React.useRef<{ route: string; tab: string | null }>({
    route: saved.route,
    tab: saved.tab,
  });

  const setTab = React.useCallback((t: string) => {
    posRef.current = { ...posRef.current, tab: t };
    setHubTab(t);
  }, []);

  // Section switches are pure client state over data already in ZHQ_DATA, so
  // they render immediately — no artificial skeleton delay (the old fixed
  // 650ms setTimeout made every switch feel slow for no reason).
  const navigate = React.useCallback((r: string) => {
    const alias = ALIASES[r];
    const next = alias ? { route: alias.route, tab: alias.tab } : { route: r, tab: null };
    if (posRef.current.route === next.route && posRef.current.tab === next.tab) return;
    posRef.current = next;
    setRoute(next.route);
    setHubTab(next.tab);
  }, []);

  // Remember where the user is, so a refresh lands back on the same screen.
  React.useEffect(() => {
    if (isMember) return; // a member is always on Spendable (its own tab persists there)
    try {
      sessionStorage.setItem("zhq-route", route);
      if (hubTab) sessionStorage.setItem("zhq-hub-tab", hubTab);
      else sessionStorage.removeItem("zhq-hub-tab");
    } catch { /* storage blocked — losing the position on refresh is fine */ }
  }, [isMember, route, hubTab]);

  // boot splash sequence — long enough to cover the window-global bootstrap
  // and font swap on first paint, short enough not to feel like a gate.
  React.useEffect(() => {
    const t1 = setTimeout(() => setBootFade(true), 250);
    const t2 = setTimeout(() => setBooting(false), 550);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const ShellC = w.ZHQShell;
  const Spendable = w.ZHQSpendable;
  const Onboarding = w.ZHQOnboarding;
  // Notification detail overlay — rendered above whatever screen is showing
  // (owner Shell, member canvas, or onboarding) so feed/bell/push all reach it.
  const NotifDetail = w.ZHQNotificationDetail;
  const notifOverlay =
    openNotif != null && NotifDetail
      ? React.createElement(NotifDetail, {
          notif: openNotif,
          onClose: () => setOpenNotif(null),
          onNavigate: navigate,
          // The member canvas is showing for a real member OR an owner previewing
          // — either way render the member-style detail + route via member tabs.
          memberView: isMember || route === "member",
        })
      : null;
  const BootSplash = w.ZHQBootSplash;
  // Sourced as `any` (the JS components have no prop types) so JSX usage below
  // isn't constrained by types inferred from their default parameter values.
  const Icon = DS.Icon as any;
  const Button = DS.Button as any;

  // route id -> { title, render }. Old route ids (bulk, import, allocations,
  // bills, categories, learned, receipts) resolve via ALIASES in navigate().
  const hubProps = { tab: hubTab, onTabChange: setTab };
  const ROUTES: Record<string, { title: string; render: (nav: (r: string) => void) => React.ReactNode }> = {
    overview: { title: "Overview", render: (nav) => React.createElement(w.ZHQOverview, { onNavigate: nav }) },
    accounts: { title: "Accounts", render: (nav) => React.createElement(w.ZHQAccounts, { onNavigate: nav }) },
    transactions: { title: "Transactions", render: (nav) => React.createElement(w.ZHQTransactionsHub, { onNavigate: nav, ...hubProps }) },
    budgets: { title: "Budgets", render: () => React.createElement(w.ZHQBudgets) },
    transfers: { title: "Transfers", render: (nav) => React.createElement(w.ZHQTransfersHub, { onNavigate: nav, ...hubProps }) },
    savings: { title: "Savings", render: () => React.createElement(w.ZHQSavings) },
    income: { title: "Income & Bills", render: (nav) => React.createElement(w.ZHQIncomeBillsHub, { onNavigate: nav, ...hubProps }) },
    notifications: { title: "Notifications", render: (nav) => React.createElement(w.ZHQNotifications, { onNavigate: nav }) },
    ask: { title: "Ask AI", render: () => React.createElement(w.ZHQAsk) },
    settings: { title: "Settings", render: (nav) => React.createElement(w.ZHQSettingsHub, { onNavigate: nav, ...hubProps }) },
  };

  const splash = booting && BootSplash ? <BootSplash fading={bootFade} /> : null;

  // Failure surfaces shared by every branch below. The banner distinguishes
  // "the DB read failed" from "you have no data" (previously identical: a
  // convincing all-$0 dashboard). The toast voices swallowed action errors.
  const loadErrorBanner = data?.loadError ? (
    <div
      style={{
        position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 110,
        display: "flex", gap: 12, alignItems: "center",
        background: "var(--surface-card)", border: "1px solid var(--amber-500, #f5a623)",
        color: "var(--text-primary)", borderRadius: 10, padding: "10px 14px",
        boxShadow: "0 8px 30px rgba(0,0,0,.35)", fontSize: 13.5, maxWidth: "min(92vw, 560px)",
      }}
    >
      <span>Couldn’t load your data just now — this is a connection blip, not missing money.</span>
      <Button size="sm" variant="secondary" onClick={() => w.ZHQ_REFRESH && w.ZHQ_REFRESH()}>
        Retry
      </Button>
    </div>
  ) : null;
  const errorToast = appError ? (
    <div
      role="alert"
      onClick={() => setAppError(null)}
      style={{
        position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 110,
        background: "var(--surface-card)", border: "1px solid rgba(255,255,255,.14)",
        color: "var(--text-primary)", borderRadius: 10, padding: "10px 16px",
        boxShadow: "0 8px 30px rgba(0,0,0,.35)", fontSize: 13.5, cursor: "pointer",
        maxWidth: "min(92vw, 440px)",
      }}
    >
      {appError}
    </div>
  ) : null;
  const alerts = (
    <>
      {loadErrorBanner}
      {errorToast}
    </>
  );

  if (isMember || route === "member") {
    return (
      <>
        {splash}
        <div className="zhq-member-canvas">
          <ErrorBoundary label="member">{Spendable ? <Spendable /> : null}</ErrorBoundary>
          {/* Owner previewing a member: a back button. The actual member's Log
              out now lives in their in-app account menu (Spendable header). */}
          {!isMember ? (
            <div style={{ position: "fixed", top: 20, left: 20, zIndex: 60 }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate("overview")}
                iconLeft={<Icon name="chevronLeft" size={15} />}
              >
                Owner view
              </Button>
            </div>
          ) : null}
        </div>
        {notifOverlay}
        {alerts}
      </>
    );
  }

  if (route === "onboarding") {
    return (
      <>
        {splash}
        <div
          style={{
            minHeight: "100vh",
            overflow: "auto",
            background: "radial-gradient(120% 90% at 50% 0%, var(--surface-card) 0%, var(--bg-void) 72%)",
          }}
        >
          {Onboarding ? <Onboarding onDone={() => navigate("overview")} /> : null}
        </div>
        {notifOverlay}
        {alerts}
      </>
    );
  }

  const r = ROUTES[route] || ROUTES.overview;
  if (!ShellC) return null;
  return (
    <>
      {splash}
      <ShellC active={route} onNavigate={navigate} title={r.title} loading={refreshing} onLogout={() => signOut()}>
        <div key={`${route}:${dataVersion}`} className="zt-enter">
          <ErrorBoundary key={route} label={route} onReset={() => setDataVersion((v) => v + 1)}>
            {r.render(navigate)}
          </ErrorBoundary>
        </div>
      </ShellC>
      {notifOverlay}
      {alerts}
    </>
  );
}
