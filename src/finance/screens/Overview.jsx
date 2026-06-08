import React from 'react';
/* Overview — the owner's command center dashboard. */
function ZHQOverview({ onNavigate }) {
  const {
    Card, SectionHeader, StatTile, Delta, Button, Icon, Avatar, Tag,
    DonutChart, DonutLegend, AreaChart, BudgetRow, ChecklistRow,
    DataTable, AmountCell,
  } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;

  const tiles = [
    { label: 'Total cash', value: D.stats.totalCash, delta: { value: 4330, percent: 1.8 } },
    { label: 'This-month spending', value: D.stats.spending, delta: { value: 240, percent: 4, invert: true } },
    { label: 'This-month income', value: D.stats.income, delta: { value: 650, percent: 7 } },
    { label: 'Transfers to make', value: D.stats.transfers, sub: '5 transfers · 3 left', accent: true, icon: 'transfers', nav: 'transfers' },
  ];

  const catTotal = D.categories.reduce((s, c) => s + c.value, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div className="zt-eyebrow" style={{ marginBottom: 7 }}>Saturday, June 8</div>
          <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Good morning, Jared</h2>
        </div>
        <Button variant="primary" iconLeft={<Icon name="plus" size={16} />} style={{ flex: 'none' }} onClick={() => onNavigate('onboarding')}>Connect account</Button>
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {tiles.map((t, i) => (
          <Card key={i} interactive={!!t.nav} onClick={t.nav ? () => onNavigate(t.nav) : undefined} style={t.accent ? { boxShadow: 'var(--shadow-md)', border: '1px solid var(--green-tint)' } : undefined}>
            <StatTile {...t} />
          </Card>
        ))}
      </div>

      {/* Coach insight banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: 'var(--olive-fill)', borderRadius: 'var(--radius-lg)' }}>
        <span style={{ width: 38, height: 38, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: 'var(--paper-tint)', color: 'var(--olive-text)' }}>
          <Icon name="sparkles" size={20} />
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14.5, color: 'var(--text-primary)', fontWeight: 500 }}>Dining is up 60% vs your 3-month average — <span className="zt-num" style={{ color: 'var(--olive-text)' }}>$240 over</span>.</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>Mostly weekend takeout. Want to set a tighter Dining budget?</div>
        </div>
        <Button variant="ghost" size="sm" iconRight={<Icon name="chevronRight" size={15} />} style={{ color: 'var(--olive-text)' }}>Ask coach</Button>
      </div>

      {/* Money going + income vs spending */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.05fr', gap: 16 }}>
        <Card>
          <SectionHeader eyebrow="This month" title="Where's our money going"
            action={<Button variant="ghost" size="sm">Merchants</Button>} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            <DonutChart segments={D.categories} size={148} thickness={15} centerTop="Spent" centervalue="$5.4k" centerSub="of $6.4k" />
            <div style={{ flex: 1 }}><DonutLegend segments={D.categories} /></div>
          </div>
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

      {/* Budgets + upcoming transfers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <SectionHeader title="Budgets at a glance"
            action={<Button variant="ghost" size="sm" onClick={() => onNavigate('budgets')}>See all</Button>} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 17 }}>
            {D.budgets.map((b, i) => {
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
        <Card>
          <SectionHeader title="Upcoming transfers"
            action={<Button variant="ghost" size="sm" onClick={() => onNavigate('transfers')}>Open</Button>} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {D.upcoming.slice(0, 3).map((t, i) => (
              <ChecklistRow key={i} {...t} />
            ))}
            <button onClick={() => onNavigate('transfers')} style={{ marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px', background: 'transparent', border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', font: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              2 more · $1,800 to move <Icon name="arrowRight" size={15} />
            </button>
          </div>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card>
        <SectionHeader title="Recent transactions"
          action={<Button variant="ghost" size="sm" onClick={() => onNavigate('transactions')}>See all</Button>} />
        <DataTable
          columns={[
            { key: 'date', header: 'Date', render: (r) => <span style={{ color: 'var(--text-secondary)' }}>{r.date}</span> },
            { key: 'merchant', header: 'Merchant', render: (r) => (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
                {r.merchant}{r.flagged ? <Icon name="flag" size={13} style={{ color: 'var(--warning)' }} /> : null}{r.pending ? <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>pending</span> : null}
              </span>
            ) },
            { key: 'cat', header: 'Category', render: (r) => <Tag color={r.color} size="sm">{r.cat}</Tag> },
            { key: 'who', header: 'Person', render: (r) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Avatar name={r.who} size="xs" /><span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{r.who}</span></span> },
            { key: 'account', header: 'Account', render: (r) => <span style={{ color: 'var(--text-tertiary)', fontSize: 12.5 }} className="zt-num">{r.account}</span> },
            { key: 'amt', header: 'Amount', align: 'right', sortable: true, render: (r) => <AmountCell value={r.amt} income={r.income} /> },
          ]}
          rows={D.txns} sortKey="amt" />
      </Card>
    </div>
  );
}

Object.assign(window, { ZHQOverview });
