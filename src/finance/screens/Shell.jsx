import React from 'react';
import { buildLabel, buildTitle } from '../../lib/build';
/* Shell — sidebar + topbar layout for the Zitting Finance desktop app. */

// Build stamp — inlined at build time via next.config.ts. Updates on every
// commit + deploy (Vercel rebuilds each push). Falls back to 'dev' locally.
const BUILD_LABEL = buildLabel();
const BUILD_TIME = buildTitle();
function ZHQSidebar({ active, onNavigate, onLogout }) {
  const { Icon, Avatar } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  return (
    <aside className="zhq-sidebar" style={{
      width: 'var(--sidebar-w)', flex: 'none', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-app)', borderRight: '1px solid var(--border-hairline)',
      padding: '18px 12px',
    }}>
      <a href="/" title="Back to the family dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px 14px', textDecoration: 'none' }}>
        <img src="/finance/mark.svg" width="30" height="30" alt="" style={{ borderRadius: 9 }} />
        <span className="zt-wordmark" style={{ fontSize: 20, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Zitting <span style={{ color: 'var(--accent)' }}>HQ</span></span>
      </a>

      {/* Back to the family dashboard (calendar, meals, groceries, …) */}
      <a href="/" className="zhq-back-hq" title="Back to Zitting HQ">
        <Icon name="chevronLeft" size={16} className="zhq-nav-icon" />
        Zitting HQ
      </a>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflowY: 'auto' }}>
        {D.nav.map((item) => {
          const on = item.id === active;
          return (
            <button key={item.id} className="zhq-nav-item" data-active={on ? 'true' : 'false'} onClick={() => onNavigate && onNavigate(item.id)}>
              <Icon name={item.icon} size={18} className="zhq-nav-icon" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div style={{ borderTop: '1px solid var(--border-hairline)', paddingTop: 12, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <button className="zhq-nav-item" data-active="false" onClick={() => onNavigate && onNavigate('member')}>
          <Icon name="eye" size={18} className="zhq-nav-icon" /> View as member
        </button>
        <button className="zhq-nav-item" data-active={active === 'settings' ? 'true' : 'false'} onClick={() => onNavigate && onNavigate('settings')}>
          <Icon name="settings" size={18} className="zhq-nav-icon" /> Settings
        </button>
        {onLogout ? (
          <button className="zhq-nav-item" data-active="false" onClick={() => onLogout()}>
            <Icon name="logout" size={18} className="zhq-nav-icon" /> Log out
          </button>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 9px' }}>
          <Avatar name={(typeof window !== 'undefined' && window.ZHQ_USER && window.ZHQ_USER.name) || 'Jared'} size="sm" />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{(typeof window !== 'undefined' && window.ZHQ_USER && window.ZHQ_USER.name) || 'Jared'}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>Owner</div>
          </div>
        </div>
        <div className="zt-num" title={BUILD_TIME} style={{ padding: '6px 11px 2px', fontSize: 10.5, color: 'var(--text-tertiary)', letterSpacing: '0.02em' }}>{BUILD_LABEL}</div>
      </div>
    </aside>
  );
}

function ZHQTopbar({ title, onNavigate, embedded = false, active }) {
  const { Icon, IconButton, SegmentedControl } = window.ZittingHQDesignSystem_c9e528;
  // Count only real (DB-backed, numeric-id) unread alerts. Derived/synthetic
  // alerts use string ids and can't be marked read, so excluding them lets the
  // badge reach zero once everything's been viewed.
  const unread = ((window.ZHQ_DATA && window.ZHQ_DATA.notifications) || []).filter((n) => n.unread && typeof n.id === 'number').length;
  const [theme, setTheme] = React.useState((typeof window !== 'undefined' && window.__zhqTheme) || 'light');
  const toggleTheme = () => {
    const t = theme === 'light' ? 'dark' : 'light';
    window.__zhqSetTheme && window.__zhqSetTheme(t);
    setTheme(t);
  };
  return (
    <header className="zhq-topbar" style={{
      minHeight: 'calc(var(--topbar-h) + env(safe-area-inset-top))', flex: 'none', boxSizing: 'border-box',
      paddingBottom: embedded ? 10 : 0,
      display: 'flex', alignItems: 'center', gap: 16,
      paddingTop: 'env(safe-area-inset-top)', paddingLeft: 26, paddingRight: 26, borderBottom: '1px solid var(--border-hairline)',
    }}>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h1>
        {embedded && SECTION_HELP[active] ? <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{SECTION_HELP[active]}</p> : null}
      </div>
      <div style={{ flex: 1 }} />
      {embedded ? null : <button className="zhq-desktop-only" onClick={() => onNavigate && onNavigate('transactions')}
        style={{ display: 'flex', alignItems: 'center', gap: 9, height: 36, padding: '0 14px 0 12px', background: 'var(--surface-sunken)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-pill)', color: 'var(--text-tertiary)', minWidth: 200, font: 'inherit', cursor: 'pointer' }}>
        <Icon name="search" size={16} />
        <span style={{ fontSize: 13 }}>Search transactions…</span>
      </button>}
      {embedded ? null : <SegmentedControl className="zhq-desktop-only" options={['This month', 'Last month', 'Custom']} defaultValue="This month" size="sm" />}
      {/* Inside the app frame the shell already has Refresh + the bell, and theme lives in Profile — so none of these here. */}
      {embedded ? null : <IconButton icon={theme === 'light' ? 'moon' : 'sun'} label="Toggle theme" variant="solid" onClick={toggleTheme} />}
      {embedded ? null : <IconButton icon="sparkles" label="Ask AI" variant="solid" onClick={() => onNavigate && onNavigate('ask')} />}
      {embedded ? null : <div style={{ position: 'relative' }}>
        <IconButton icon="bell" label="Notifications" variant="solid" onClick={() => onNavigate && onNavigate('notifications')} />
        {unread > 0 ? (
          <span style={{ position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text-on-accent)', background: 'var(--accent)', borderRadius: 999, border: '2px solid var(--bg-app)' }}>{unread}</span>
        ) : null}
      </div>}
    </header>
  );
}

// Primary destinations for the mobile bottom tab bar (everything else lives in
// the "More" sheet). Ordered for the daily flow.
const BOTTOM_NAV_IDS = ['overview', 'transactions', 'accounts', 'transfers'];

function ZHQBottomNav({ active, onNavigate, onLogout }) {
  const { Icon } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  const nav = (D && D.nav) || [];
  const [moreOpen, setMoreOpen] = React.useState(false);
  const go = (id) => { setMoreOpen(false); onNavigate && onNavigate(id); };
  const primary = BOTTOM_NAV_IDS.map((id) => nav.find((n) => n.id === id)).filter(Boolean);
  const moreActive = moreOpen || !BOTTOM_NAV_IDS.includes(active);

  return (
    <>
      <nav className="zhq-bottomnav">
        {primary.map((item) => (
          <button key={item.id} type="button" className="zhq-bottomnav-item" data-active={item.id === active ? 'true' : 'false'} onClick={() => go(item.id)}>
            <Icon name={item.icon} size={21} />
            {item.label}
          </button>
        ))}
        <button type="button" className="zhq-bottomnav-item" data-active={moreActive ? 'true' : 'false'} onClick={() => setMoreOpen(true)}>
          <Icon name="grid" size={21} />
          More
        </button>
      </nav>

      {moreOpen ? (
        <div className="zhq-sheet-overlay" onClick={() => setMoreOpen(false)}>
          <div className="zhq-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="zhq-sheet-grip" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4 }}>
              {nav.map((item) => (
                <button key={item.id} type="button" className="zhq-nav-item" data-active={item.id === active ? 'true' : 'false'} onClick={() => go(item.id)}>
                  <Icon name={item.icon} size={18} className="zhq-nav-icon" />
                  {item.label}
                </button>
              ))}
            </div>
            <div style={{ height: 1, background: 'var(--border-hairline)', margin: '10px 4px' }} />
            <button type="button" className="zhq-nav-item" onClick={() => { window.location.href = '/'; }}>
              <Icon name="grid" size={18} className="zhq-nav-icon" /> Zitting HQ
            </button>
            <button type="button" className="zhq-nav-item" onClick={() => go('settings')}>
              <Icon name="settings" size={18} className="zhq-nav-icon" /> Settings
            </button>
            <button type="button" className="zhq-nav-item" onClick={() => go('member')}>
              <Icon name="eye" size={18} className="zhq-nav-icon" /> View as member
            </button>
            {onLogout ? (
              <button type="button" className="zhq-nav-item" onClick={() => { setMoreOpen(false); onLogout(); }}>
                <Icon name="logout" size={18} className="zhq-nav-icon" /> Log out
              </button>
            ) : null}
            <div className="zt-num" title={BUILD_TIME} style={{ padding: '12px 11px 4px', fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center' }}>{BUILD_LABEL}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/* What each section is for — one plain line under its title, so nobody has to
   guess what "Transfers" or "Income & Bills" means before tapping in. */
const SECTION_HELP = {
  overview: "Where the money stands this month.",
  accounts: "Every account, its balance, and who looks after it.",
  transactions: "Everything in and out. Review it, sort it, import more.",
  budgets: "What you plan to spend, by category, and how it's going.",
  transfers: "Money moving between accounts: scheduled, due, done.",
  savings: "The goals you're putting money toward.",
  income: "Paychecks and recurring bills, and when they land.",
  notifications: "Money alerts and reminders.",
  ask: "Ask about your money in plain English.",
  settings: "Rules, categories, bank sync, and who sees what.",
};

/* Finance section switcher when the app frame supplies primary navigation:
   the sections as icon tabs (scrolls on phones), then Ask AI and Settings. */
function ZHQSubnav({ active, onNavigate }) {
  const { Tabs } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  const nav = (D && D.nav) || [];
  const options = [
    ...nav.map((n) => ({ value: n.id, label: n.label, icon: n.icon })),
    { value: 'ask', label: 'Ask AI', icon: 'sparkles' },
    { value: 'settings', label: 'Settings', icon: 'settings' },
  ];
  const value = options.some((o) => o.value === active) ? active : undefined;
  return (
    <div className="zhq-hscroll" style={{ overflowX: 'auto', flex: 'none', padding: '0 20px', borderBottom: '1px solid var(--border-hairline)' }}>
      <Tabs options={options} value={value} onChange={(v) => onNavigate && onNavigate(v)} style={{ minWidth: 'max-content' }} />
    </div>
  );
}

function ZHQShell({ active, onNavigate, title, children, loading, onLogout, embedded = false }) {
  const { LoadingBar } = window.ZittingHQDesignSystem_c9e528;
  if (embedded) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-app)' }}>
        <ZHQSubnav active={active} onNavigate={onNavigate} />
        <ZHQTopbar title={title} onNavigate={onNavigate} embedded active={active} />
        <div style={{ height: 2, flex: 'none' }}>{loading && LoadingBar ? <LoadingBar /> : null}</div>
        <main className="zhq-main" style={{ flex: 1, overflowY: 'auto', padding: '26px 20px' }}>
          <div style={{ maxWidth: 'var(--content-max)', margin: '0 auto' }}>{children}</div>
        </main>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg-app)' }}>
      <ZHQSidebar active={active} onNavigate={onNavigate} onLogout={onLogout} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <ZHQTopbar title={title} onNavigate={onNavigate} />
        <div style={{ height: 2, flex: 'none' }}>{loading && LoadingBar ? <LoadingBar /> : null}</div>
        <main className="zhq-main" style={{ flex: 1, overflowY: 'auto', padding: '26px' }}>
          <div style={{ maxWidth: 'var(--content-max)', margin: '0 auto' }}>{children}</div>
        </main>
      </div>
      <ZHQBottomNav active={active} onNavigate={onNavigate} onLogout={onLogout} />
    </div>
  );
}

Object.assign(window, { ZHQSidebar, ZHQTopbar, ZHQShell, ZHQSubnav });
