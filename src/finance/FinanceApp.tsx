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
import { MOCK_FINANCE_DATA } from "./data/mockData";
import { signOut } from "@/app/login/actions";
import * as ZHQApi from "@/app/finance/actions";

// Side-effect imports: populate window with icons, and register every screen as
// a window.ZHQ* global. Order doesn't matter — screens only read the namespace
// and window.ZHQ_DATA at render time, by which point the globals below are set.
// (Data now comes from the server via the `data` prop, not a static appdata.js.)
import "./assets/icons.js";
import "./screens/Shell.jsx";
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
import "./screens/Ask.jsx";
import "./screens/Access.jsx";
import "./screens/Spendable.jsx";
import "./screens/Onboarding.jsx";
import "./screens/Import.jsx";
import "./screens/Categories.jsx";
import "./plaidLink.js";

const w = (typeof window !== "undefined" ? window : {}) as any;

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
  const [route, setRoute] = React.useState(isMember ? "member" : "overview");
  const [loading, setLoading] = React.useState(true);
  const [booting, setBooting] = React.useState(true);
  const [bootFade, setBootFade] = React.useState(false);
  // Bumped whenever fresh server `data` arrives (after a mutation +
  // router.refresh()); used in the screen `key` to force a re-render.
  const [dataVersion, setDataVersion] = React.useState(0);

  if (typeof window !== "undefined") {
    w.ZHQ_REFRESH = () => router.refresh();
  }

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      w.ZHQ_DATA = data || MOCK_FINANCE_DATA;
      setDataVersion((v) => v + 1);
    }
  }, [data]);

  const navigate = React.useCallback((r: string) => {
    setLoading(true);
    setRoute(r);
  }, []);

  // boot splash sequence
  React.useEffect(() => {
    const t1 = setTimeout(() => setBootFade(true), 800);
    const t2 = setTimeout(() => setBooting(false), 1200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // clear the per-route skeleton shortly after each screen change
  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 650);
    return () => clearTimeout(t);
  }, [route]);

  const ShellC = w.ZHQShell;
  const Spendable = w.ZHQSpendable;
  const Onboarding = w.ZHQOnboarding;
  const BootSplash = w.ZHQBootSplash;
  const ScreenSkeleton = w.ZHQScreenSkeleton;
  // Sourced as `any` (the JS components have no prop types) so JSX usage below
  // isn't constrained by types inferred from their default parameter values.
  const Icon = DS.Icon as any;
  const Button = DS.Button as any;

  // route id -> { title, render }
  const ROUTES: Record<string, { title: string; render: (nav: (r: string) => void) => React.ReactNode }> = {
    overview: { title: "Overview", render: (nav) => React.createElement(w.ZHQOverview, { onNavigate: nav }) },
    accounts: { title: "Accounts", render: (nav) => React.createElement(w.ZHQAccounts, { onNavigate: nav }) },
    transactions: { title: "Transactions", render: (nav) => React.createElement(w.ZHQTransactions, { onNavigate: nav }) },
    import: { title: "Import transactions", render: (nav) => React.createElement(w.ZHQImport, { onNavigate: nav }) },
    categories: { title: "Categories", render: () => React.createElement(w.ZHQCategories) },
    budgets: { title: "Budgets", render: () => React.createElement(w.ZHQBudgets) },
    income: { title: "Income", render: () => React.createElement(w.ZHQIncome) },
    bills: { title: "Bills & recurring", render: () => React.createElement(w.ZHQBills) },
    transfers: { title: "Transfers", render: (nav) => React.createElement(w.ZHQTransfers, { onNavigate: nav }) },
    allocations: { title: "Allocations", render: (nav) => React.createElement(w.ZHQAllocations, { onNavigate: nav }) },
    savings: { title: "Savings", render: () => React.createElement(w.ZHQSavings) },
    receipts: { title: "Receipts", render: () => React.createElement(w.ZHQReceipts) },
    notifications: { title: "Notifications", render: () => React.createElement(w.ZHQNotifications) },
    ask: { title: "Ask AI", render: () => React.createElement(w.ZHQAsk) },
    settings: { title: "Access & permissions", render: () => React.createElement(w.ZHQAccess) },
  };

  const splash = booting && BootSplash ? <BootSplash fading={bootFade} /> : null;

  if (isMember || route === "member") {
    return (
      <>
        {splash}
        <div className="zhq-member-canvas">
          {Spendable ? <Spendable /> : null}
          <div style={{ position: "fixed", top: 20, left: 20 }}>
            {isMember ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => signOut()}
                iconLeft={<Icon name="logout" size={15} />}
              >
                Log out
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate("overview")}
                iconLeft={<Icon name="chevronLeft" size={15} />}
              >
                Owner view
              </Button>
            )}
          </div>
        </div>
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
      </>
    );
  }

  const r = ROUTES[route] || ROUTES.overview;
  if (!ShellC) return null;
  return (
    <>
      {splash}
      <ShellC active={route} onNavigate={navigate} title={r.title} loading={loading} onLogout={() => signOut()}>
        {loading && ScreenSkeleton ? (
          <ScreenSkeleton />
        ) : (
          <div key={`${route}:${dataVersion}`} className="zt-enter">
            {r.render(navigate)}
          </div>
        )}
      </ShellC>
    </>
  );
}
