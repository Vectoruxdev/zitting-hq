import React from 'react';
/* Hubs — tabbed wrapper screens for the consolidated 7-item nav. Each hub
   renders the DS Tabs row and then the ORIGINAL screen components unmodified
   (window.ZHQBulk, ZHQImport, ZHQAllocations, …). Tab state is owned by
   FinanceApp (controlled), so alias navigations like onNavigate('import') can
   land on a specific tab. */

// Build stamp — same inlined pattern as Shell.jsx.
const BUILD_LABEL = `Build ${process.env.NEXT_PUBLIC_BUILD_NUMBER || '0'} · ${process.env.NEXT_PUBLIC_BUILD_SHA || 'dev'}`;
const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME || '';

function HubTabs({ options, value, onChange }) {
  const { Tabs } = window.ZittingHQDesignSystem_c9e528;
  // overflowX so six Settings tabs survive a 375px viewport.
  return (
    <Tabs
      options={options}
      value={value}
      onChange={onChange}
      style={{ marginBottom: 22, overflowX: 'auto', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}
    />
  );
}

/* Transactions · Tidy up · Import */
function ZHQTransactionsHub({ onNavigate, tab, onTabChange }) {
  const active = tab || 'all';
  const w = window;
  return (
    <div>
      <HubTabs
        options={[
          { value: 'all', label: 'All transactions' },
          { value: 'tidy', label: 'Tidy up' },
          { value: 'import', label: 'Import' },
        ]}
        value={active}
        onChange={onTabChange}
      />
      <div key={active}>
        {active === 'tidy' ? React.createElement(w.ZHQBulk)
          : active === 'import' ? React.createElement(w.ZHQImport, { onNavigate })
          : React.createElement(w.ZHQTransactions, { onNavigate })}
      </div>
    </div>
  );
}

/* Transfers checklist · Rules (was Allocations) */
function ZHQTransfersHub({ onNavigate, tab, onTabChange }) {
  const active = tab || 'checklist';
  const w = window;
  const pending = (w.ZHQ_DATA && w.ZHQ_DATA.transfersPending) || 0;
  return (
    <div>
      <HubTabs
        options={[
          { value: 'checklist', label: 'Checklist', badge: pending > 0 ? pending : null },
          { value: 'rules', label: 'Rules' },
        ]}
        value={active}
        onChange={onTabChange}
      />
      <div key={active}>
        {active === 'rules'
          ? React.createElement(w.ZHQAllocations, { onNavigate })
          : React.createElement(w.ZHQTransfers, { onNavigate })}
      </div>
    </div>
  );
}

/* Income · Bills */
function ZHQIncomeBillsHub({ onNavigate, tab, onTabChange }) {
  const active = tab || 'income';
  const w = window;
  return (
    <div>
      <HubTabs
        options={[
          { value: 'income', label: 'Income' },
          { value: 'bills', label: 'Bills & recurring' },
        ]}
        value={active}
        onChange={onTabChange}
      />
      <div key={active}>
        {active === 'bills' ? React.createElement(w.ZHQBills) : React.createElement(w.ZHQIncome)}
      </div>
    </div>
  );
}

/* Appearance — theme switch + build info (lives only in the Settings hub). */
function AppearancePanel() {
  const { Card, SegmentedControl } = window.ZittingHQDesignSystem_c9e528;
  const [theme, setTheme] = React.useState((typeof window !== 'undefined' && window.__zhqTheme) || 'dark');
  const pick = (label) => {
    const t = label === 'Light' ? 'light' : 'dark';
    window.__zhqSetTheme && window.__zhqSetTheme(t);
    setTheme(t);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 560 }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>Theme</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 2 }}>OLED dark or clean light.</div>
          </div>
          <SegmentedControl
            options={['Dark', 'Light']}
            value={theme === 'light' ? 'Light' : 'Dark'}
            onChange={pick}
            size="sm"
          />
        </div>
      </Card>
      <Card>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>About this build</div>
        <div className="zt-num" title={BUILD_TIME} style={{ marginTop: 6, fontSize: 12.5, color: 'var(--text-tertiary)', letterSpacing: '0.02em' }}>{BUILD_LABEL}</div>
      </Card>
    </div>
  );
}

/* Settings hub — Access (default) · Categories · Learned · Notifications ·
   Receipts · Appearance. Default tab is Access & permissions: that's what the
   gear opened before this hub existed (least surprise). */
function ZHQSettingsHub({ onNavigate, tab, onTabChange }) {
  const active = tab || 'access';
  const w = window;
  const body =
    active === 'categories' ? React.createElement(w.ZHQCategories)
    : active === 'learned' ? React.createElement(w.ZHQLearned)
    : active === 'notifications' ? React.createElement(w.ZHQNotifications, { onNavigate })
    : active === 'receipts' ? React.createElement(w.ZHQReceipts)
    : active === 'appearance' ? React.createElement(AppearancePanel)
    : React.createElement(w.ZHQAccess);
  return (
    <div>
      <HubTabs
        options={[
          { value: 'access', label: 'Access & permissions' },
          { value: 'categories', label: 'Categories' },
          { value: 'learned', label: 'What it’s learned' },
          { value: 'notifications', label: 'Notifications' },
          { value: 'receipts', label: 'Receipts' },
          { value: 'appearance', label: 'Appearance' },
        ]}
        value={active}
        onChange={onTabChange}
      />
      <div key={active}>{body}</div>
    </div>
  );
}

Object.assign(window, { ZHQTransactionsHub, ZHQTransfersHub, ZHQIncomeBillsHub, ZHQSettingsHub });
