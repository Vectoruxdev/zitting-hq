import React from 'react';
/* Overview — the owner's command center dashboard (computed from real data). */

function CashOp({ children }) {
  return <span style={{ fontSize: 20, fontWeight: 400, color: 'var(--text-tertiary)', flex: 'none' }}>{children}</span>;
}
function CashStep({ label, value, sub, tone, strong }) {
  const color = tone === 'pos' ? 'var(--accent)' : tone === 'neg' ? 'var(--text-primary)' : 'var(--text-primary)';
  return (
    <div style={{ minWidth: 0 }}>
      <div className="zt-eyebrow" style={{ marginBottom: 5 }}>{label}</div>
      <div className="zt-num" style={{ fontSize: strong ? 24 : 20, fontWeight: 600, letterSpacing: '-0.02em', color }}>{value}</div>
      {sub ? <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>{sub}</div> : null}
    </div>
  );
}

function ZHQOverview({ onNavigate }) {
  const {
    Card, SectionHeader, StatTile, Button, Icon, Avatar, Tag,
    DonutChart, DonutLegend, AreaChart, BudgetRow, ChecklistRow,
    DataTable, AmountCell,
  } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  const user = window.ZHQ_USER || {};

  const API = window.ZHQ_API || {};
  const txns = D.txns || [];
  const cats = D.categories || [];
  const budgets = D.budgets || [];
  const upcoming = D.upcoming || [];
  const cf = D.cashFlow || null;
  const moves = D.accountTransfers || [];
  const [unlinking, setUnlinking] = React.useState(null);

  async function unlinkMove(id) {
    if (!API.unlinkTransfer) return;
    setUnlinking(id);
    try {
      await API.unlinkTransfer(id);
      window.ZHQ_REFRESH && window.ZHQ_REFRESH();
    } finally {
      setUnlinking(null);
    }
  }

  // ---- empty state ----
  if (!txns.length) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', padding: '70px 20px' }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <span style={{ display: 'inline-flex', width: 56, height: 56, borderRadius: 999, placeItems: 'center', background: 'var(--surface-raised)', color: 'var(--accent)', marginBottom: 16 }}>
            <Icon name="dashboard" size={26} />
          </span>
          <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 600 }}>Welcome to Family HQ</h2>
          <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', fontSize: 14.5, lineHeight: 1.5 }}>
            Add an account and import a CSV from your bank. Your spending breakdown, trends, and totals fill in automatically.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Button variant="primary" iconLeft={<Icon name="arrowDown" size={16} />} onClick={() => onNavigate('import')}>Import transactions</Button>
            <Button variant="secondary" iconLeft={<Icon name="plus" size={16} />} onClick={() => onNavigate('accounts')}>Add account</Button>
          </div>
        </div>
      </div>
    );
  }

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const catTotal = cats.reduce((s, c) => s + c.value, 0);
  const fmtK = (v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`);

  // Stats reflect the most recent month that has data (D.statsMonth). When that
  // is the current calendar month, "This month" reads naturally; otherwise show
  // the actual month so it's clear the figures are from the latest import.
  const curMonthName = now.toLocaleString('en-US', { month: 'long' });
  const statsIsCurrent = !D.statsMonth || D.statsMonth === curMonthName;
  const monthEyebrow = statsIsCurrent ? 'This month' : D.statsMonth;
  const spendLabel = statsIsCurrent ? 'This-month spending' : `${D.statsMonth} spending`;
  const incomeLabel = statsIsCurrent ? 'This-month income' : `${D.statsMonth} income`;

  const tiles = [
    { label: 'Net worth', value: D.stats.netWorth ?? D.stats.totalCash, sub: 'cash + savings − card debt', nav: 'accounts' },
    { label: 'Total cash', value: D.stats.totalCash },
    { label: spendLabel, value: D.stats.spending },
    { label: incomeLabel, value: D.stats.income },
    { label: 'Transfers to make', value: D.stats.transfers, sub: upcoming.length ? `${upcoming.length} to send` : 'none pending', accent: true, icon: 'transfers', nav: 'transfers' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div className="zt-eyebrow" style={{ marginBottom: 7 }}>{dateStr}</div>
          <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{greeting}, {user.name || 'there'}</h2>
        </div>
        <Button variant="primary" iconLeft={<Icon name="arrowDown" size={16} />} style={{ flex: 'none' }} onClick={() => onNavigate('import')}>Import</Button>
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
        {tiles.map((t, i) => (
          <Card key={i} interactive={!!t.nav} onClick={t.nav ? () => onNavigate(t.nav) : undefined} style={t.accent ? { boxShadow: 'var(--shadow-md)', border: '1px solid var(--green-tint)' } : undefined}>
            <StatTile label={t.label} value={t.value} sub={t.sub} accent={t.accent} icon={t.icon} />
          </Card>
        ))}
      </div>

      {/* Cash-flow reconciliation — makes the month's numbers visibly add up */}
      {cf ? (
        <Card>
          <SectionHeader eyebrow={`${monthEyebrow} · checking + savings`} title="Where the cash went" />
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 18, paddingTop: 4 }}>
            <CashStep label="Money in" value={cf.inFlowDisplay} tone="pos" />
            <CashOp>−</CashOp>
            <CashStep label="Spending" value={cf.outFlowDisplay} tone="neg" />
            <CashOp>−</CashOp>
            <CashStep label={cf.transfersDirection === 'in' ? 'Transfers in' : 'Transfers out'} value={cf.transfersOutDisplay} tone={cf.transfersDirection === 'in' ? 'pos' : 'neg'} sub="to savings, cards, etc." />
            <CashOp>=</CashOp>
            <CashStep label="Net change in cash" value={cf.netDisplay} tone={cf.net < 0 ? 'neg' : 'pos'} strong />
          </div>
          <p style={{ margin: '14px 0 0', fontSize: 12.5, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            Income and spending exclude transfers, so money moved to savings or used to pay a credit card shows up under transfers — not as spending. <b style={{ color: 'var(--text-secondary)' }}>Total cash</b> above is your running balance across every imported month (opening balance + all activity), not just {cf.month || 'this month'}.
          </p>
        </Card>
      ) : null}

      {/* Money moved between accounts — detected internal transfers (review/undo) */}
      {moves.length ? (
        <Card>
          <SectionHeader eyebrow="Linked automatically" title="Money moved between accounts"
            action={<span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>not counted as spending or income</span>} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {moves.slice(0, 8).map((mv) => (
              <div key={mv.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}>
                  <Icon name="transfers" size={15} />
                </span>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{mv.fromAccount}</span>
                  <Icon name="arrowRight" size={14} style={{ color: 'var(--text-tertiary)' }} />
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{mv.toAccount}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>· {mv.date}</span>
                </div>
                <span className="zt-num" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>{mv.amount}</span>
                <button
                  onClick={() => unlinkMove(mv.id)}
                  disabled={unlinking === mv.id}
                  style={{ flexShrink: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: 'var(--text-tertiary)', opacity: unlinking === mv.id ? 0.5 : 1 }}
                  title="Not a transfer — unlink and count both as normal transactions"
                >
                  {unlinking === mv.id ? 'Unlinking…' : 'Unlink'}
                </button>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Money going + income vs spending */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.05fr', gap: 16 }}>
        <Card>
          <SectionHeader eyebrow={monthEyebrow} title="Where's our money going"
            action={<Button variant="ghost" size="sm" onClick={() => onNavigate('categories')}>Categories</Button>} />
          {cats.length ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
              <DonutChart segments={cats} size={148} thickness={15} centerTop="Spent" centervalue={fmtK(catTotal)} />
              <div style={{ flex: 1 }}><DonutLegend segments={cats} /></div>
            </div>
          ) : (
            <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13.5 }}>No spending categorized {statsIsCurrent ? 'this month' : `in ${D.statsMonth}`} yet.</div>
          )}
        </Card>
        <Card>
          <SectionHeader eyebrow="Last 6 months" title="Income vs spending"
            action={<div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}><span style={{ width: 14, height: 2, background: 'var(--accent)', borderRadius: 2 }} />Income</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}><span style={{ width: 14, height: 0, borderTop: '2px dotted var(--data-2)' }} />Spending</span>
            </div>} />
          <AreaChart data={D.trend.income} compare={D.trend.spending} labels={D.trend.labels} height={196} />
        </Card>
      </div>

      {/* Budgets + upcoming transfers (only if present) */}
      {(budgets.length || upcoming.length) ? (
        <div style={{ display: 'grid', gridTemplateColumns: budgets.length && upcoming.length ? '1fr 1fr' : '1fr', gap: 16 }}>
          {budgets.length ? (
            <Card>
              <SectionHeader title="Budgets at a glance" action={<Button variant="ghost" size="sm" onClick={() => onNavigate('budgets')}>See all</Button>} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 17 }}>
                {budgets.map((b, i) => {
                  const left = b.limit - b.spent;
                  const over = left < 0;
                  const near = !over && left / b.limit <= 0.15;
                  return (
                    <BudgetRow key={i} name={b.name} value={b.spent} max={b.limit}
                      left={b.who ? <Avatar name={b.who} size="xs" /> : <Icon name={b.icon} size={15} style={{ color: 'var(--text-tertiary)' }} />}
                      right={<span className="zt-num" style={{ fontSize: 13.5, color: over ? 'var(--negative)' : near ? 'var(--warning)' : 'var(--text-secondary)' }}>{over ? `$${Math.abs(left)} over` : `$${left} left`}</span>}
                      caption={`$${b.spent} of $${b.limit}`} />
                  );
                })}
              </div>
            </Card>
          ) : null}
          {upcoming.length ? (
            <Card>
              <SectionHeader title="Upcoming transfers" action={<Button variant="ghost" size="sm" onClick={() => onNavigate('transfers')}>Open</Button>} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {upcoming.slice(0, 4).map((t, i) => <ChecklistRow key={i} {...t} />)}
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}

      {/* Recent transactions */}
      <Card>
        <SectionHeader title="Recent transactions"
          action={<Button variant="ghost" size="sm" onClick={() => onNavigate('transactions')}>See all</Button>} />
        <DataTable
          columns={[
            { key: 'date', header: 'Date', render: (r) => <span style={{ color: 'var(--text-secondary)' }}>{r.date}</span> },
            { key: 'merchant', header: 'Merchant', render: (r) => (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
                <span style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.merchant}</span>{r.flagged ? <Icon name="flag" size={13} style={{ color: 'var(--warning)' }} /> : null}{r.pending ? <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>pending</span> : null}
              </span>
            ) },
            { key: 'cat', header: 'Category', render: (r) => <Tag color={r.color} size="sm">{r.cat}</Tag> },
            { key: 'who', header: 'Person', render: (r) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Avatar name={r.who} size="xs" /><span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{r.who}</span></span> },
            { key: 'account', header: 'Account', render: (r) => <span style={{ color: 'var(--text-tertiary)', fontSize: 12.5 }} className="zt-num">{r.account}</span> },
            { key: 'amt', header: 'Amount', align: 'right', sortable: true, render: (r) => <AmountCell value={r.amt} income={r.income} /> },
          ]}
          rows={txns.slice(0, 8)} sortKey="amt" />
      </Card>
    </div>
  );
}

Object.assign(window, { ZHQOverview });
