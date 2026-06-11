import React from 'react';
/* Bills & Recurring — auto-detected subscriptions and bills. */
function ZHQBills() {
  const { Card, SectionHeader, Button, Icon, Tag, Badge, StatTile, DataTable, EmptyState } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  const [group, setGroup] = React.useState('next');
  const [q, setQ] = React.useState('');
  const bills = D.bills || [];
  if (!bills.length) {
    return <EmptyState icon="repeat" title="No recurring bills yet" body="Recurring bills and subscriptions are detected from your transactions. Import more history to surface them here." />;
  }
  const monthly = bills.reduce((s, b) => s + b.amount, 0);
  const subs = bills.filter((b) => b.cat === 'Subscriptions').length;
  const newCount = bills.filter((b) => b.badge === 'new').length;
  const dueSoon = bills.filter((b) => b.badge === 'due soon').length;
  const dueSoonAmt = bills.filter((b) => b.badge === 'due soon').reduce((s, b) => s + b.amount, 0);

  const needle = q.trim().toLowerCase();
  const visible = !needle ? bills : bills.filter((b) => `${b.name} ${b.cat} ${b.account} ${b.freq}`.toLowerCase().includes(needle));
  const sorted = [...visible].sort((a, b) => group === 'next' ? String(a.next).localeCompare(String(b.next)) : a.cat.localeCompare(b.cat));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', gap: 40 }}>
        <StatTile label="Total monthly recurring" value={'$' + monthly.toLocaleString('en-US', { minimumFractionDigits: 2 })} />
        <StatTile label="Subscriptions" value={String(subs)} sub={newCount ? `${newCount} new this month` : undefined} />
        <StatTile label="Due in next 7 days" value={String(dueSoon)} sub={dueSoon ? '$' + dueSoonAmt.toFixed(2) : undefined} accent />
      </div>

      <Card padding={6}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 8px', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>All recurring</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 12px', background: 'var(--surface-sunken)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-pill)', color: 'var(--text-tertiary)', flex: '1 1 150px', minWidth: 130, maxWidth: 260 }}>
            <Icon name="search" size={14} style={{ flex: 'none' }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search bills…" aria-label="Search bills"
              style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', font: 'inherit', fontSize: 13, color: 'var(--text-primary)' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <Button variant={group === 'next' ? 'secondary' : 'ghost'} size="sm" onClick={() => setGroup('next')}>By next due</Button>
            <Button variant={group === 'cat' ? 'secondary' : 'ghost'} size="sm" onClick={() => setGroup('cat')}>By category</Button>
          </div>
        </div>
        <DataTable
          columns={[
            { key: 'name', header: 'Bill', render: (r) => (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontWeight: 500 }}>
                <span style={{ width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}><Icon name={r.cat === 'Subscriptions' ? 'repeat' : r.cat === 'Housing' ? 'bank' : 'creditCard'} size={15} /></span>
                {r.name}
                {r.badge === 'new' ? <Badge tone="info" size="sm">New</Badge> : r.badge === 'changed' ? <Badge status="changed" size="sm">Changed {r.delta}</Badge> : r.badge === 'due soon' ? <Badge status="due soon" size="sm" dot /> : null}
              </span>
            ) },
            { key: 'cat', header: 'Category', render: (r) => <Tag color={r.color} size="sm">{r.cat}</Tag> },
            { key: 'freq', header: 'Frequency', render: (r) => <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{r.freq}</span> },
            { key: 'next', header: 'Next due', render: (r) => <span className="zt-num" style={{ color: 'var(--text-primary)', fontSize: 13 }}>{r.next}</span> },
            { key: 'account', header: 'Account', render: (r) => <span className="zt-num" style={{ color: 'var(--text-tertiary)', fontSize: 12.5 }}>{r.account}</span> },
            { key: 'amount', header: 'Amount', align: 'right', sortable: true, render: (r) => <span className="zt-num" style={{ fontWeight: 600, fontSize: 13.5 }}>${r.amount.toFixed(2)}</span> },
          ]}
          rows={sorted} sortKey="amount" />
        {needle && !sorted.length ? (
          <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-tertiary)' }}>No bills match &quot;{q.trim()}&quot;.</div>
        ) : null}
      </Card>
    </div>
  );
}

Object.assign(window, { ZHQBills });
