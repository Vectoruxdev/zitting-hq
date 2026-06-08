import React from 'react';
/* Transactions — powerful filterable table + detail drawer with receipt panel. */
function ZHQTxnDrawer({ txn, onClose }) {
  const { Icon, IconButton, Tag, Avatar, Badge, Button, DataTable } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  const money = window.ZHQMoney;
  const hasReceipt = txn.cat === 'Groceries';
  const total = D.receiptItems.reduce((s, r) => s + r.total, 0);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
      <div style={{ position: 'relative', width: 420, height: '100%', background: 'var(--surface-card)', borderLeft: '1px solid var(--border-hairline)', boxShadow: 'var(--shadow-pop)', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <span className="zt-eyebrow">Transaction</span>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          {txn.income ? <Badge tone="positive" size="sm" dot>Income</Badge> : null}
          {txn.pending ? <Badge status="pending" size="sm" dot /> : null}
          {txn.flagged ? <Badge tone="warning" size="sm">Flagged</Badge> : null}
        </div>
        <div style={{ fontSize: 19, fontWeight: 600, color: 'var(--text-primary)' }}>{txn.merchant}</div>
        <div className="zt-num" style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-0.03em', color: txn.income ? 'var(--positive)' : 'var(--text-primary)', marginTop: 8 }}>
          {txn.income ? '+' : '−'}${Math.abs(txn.amt).toFixed(2)}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: '20px 0' }}>
          {[['Date', txn.date + ', 2026'], ['Account', txn.account], ['Category', null], ['Attributed to', null], ['Linked budget', txn.cat === 'Groceries' ? 'Groceries · $600' : '—']].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid var(--border-hairline)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{k}</span>
              {k === 'Category' ? <Tag color={txn.color} editable size="sm">{txn.cat}</Tag>
                : k === 'Attributed to' ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Avatar name={txn.who} size="xs" /><span style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>{txn.who}</span><Icon name="pencil" size={13} style={{ color: 'var(--text-tertiary)' }} /></span>
                : <span className="zt-num" style={{ fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 500 }}>{v}</span>}
            </div>
          ))}
        </div>

        {txn.flagged ? (
          <div style={{ display: 'flex', gap: 11, padding: '13px 15px', background: 'var(--warning-soft)', borderRadius: 'var(--radius-md)', marginBottom: 18 }}>
            <Icon name="sparkles" size={17} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12.5, color: 'var(--paper-200)', lineHeight: 1.5 }}>Flagged because it’s over your <span style={{ color: 'var(--warning)' }}>$35 charge alert</span> for Sarah. Categorized as Shopping from the merchant name.</div>
          </div>
        ) : null}

        {/* receipt panel */}
        <div className="zt-eyebrow" style={{ marginBottom: 12 }}>Receipt</div>
        {hasReceipt ? (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 64, height: 80, flex: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--surface-raised)', border: '1px solid var(--border-hairline)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}><Icon name="receipt" size={24} /></div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Harmons Grocery<br />Jun 4, 2026 · 6 items<br /><span style={{ color: 'var(--text-tertiary)' }}>Auto-extracted</span></div>
            </div>
            <div style={{ border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <DataTable dense
                columns={[
                  { key: 'item', header: 'Item', render: (r) => <span style={{ fontSize: 13 }}>{r.item}</span> },
                  { key: 'qty', header: 'Qty', align: 'right', render: (r) => <span className="zt-num" style={{ color: 'var(--text-tertiary)' }}>{r.qty}</span> },
                  { key: 'total', header: 'Total', align: 'right', render: (r) => <span className="zt-num">${r.total.toFixed(2)}</span> },
                ]}
                rows={D.receiptItems} style={{ padding: '0 8px' }} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '26px', border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-md)' }}>
            <Icon name="camera" size={26} style={{ color: 'var(--text-tertiary)' }} />
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No receipt attached</div>
            <Button variant="secondary" size="sm" iconLeft={<Icon name="plus" size={14} />}>Add receipt</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ZHQTransactions() {
  const { Card, Icon, Button, Tag, Avatar, DataTable, AmountCell, SegmentedControl } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  const [sel, setSel] = React.useState(null);
  const [scope, setScope] = React.useState('All');
  const rows = scope === 'Flagged' ? D.txns.filter((t) => t.flagged) : scope === 'Income' ? D.txns.filter((t) => t.income) : D.txns;

  const chips = ['This month', 'All categories', 'All people', 'All accounts'];

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, height: 36, padding: '0 14px', background: 'var(--surface-sunken)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-pill)', color: 'var(--text-tertiary)', minWidth: 220 }}>
          <Icon name="search" size={16} /><span style={{ fontSize: 13 }}>Search merchant, amount…</span>
        </div>
        {chips.map((c) => (
          <button key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 13px', background: 'var(--surface-raised)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-pill)', color: 'var(--text-secondary)', font: 'inherit', fontSize: 13, cursor: 'pointer' }}>{c}<Icon name="chevronDown" size={13} /></button>
        ))}
        <div style={{ flex: 1 }} />
        <SegmentedControl options={['All', 'Income', 'Flagged']} value={scope} onChange={setScope} size="sm" />
      </div>

      <Card padding={6}>
        <DataTable
          onRowClick={setSel}
          columns={[
            { key: 'date', header: 'Date', render: (r) => <span style={{ color: 'var(--text-secondary)' }}>{r.date}</span> },
            { key: 'merchant', header: 'Merchant', render: (r) => (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
                {r.merchant}
                {r.flagged ? <Icon name="flag" size={13} style={{ color: 'var(--warning)' }} /> : null}
                {r.pending ? <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400 }}>pending</span> : null}
              </span>
            ) },
            { key: 'cat', header: 'Category', render: (r) => <Tag color={r.color} editable size="sm">{r.cat}</Tag> },
            { key: 'who', header: 'Person', render: (r) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Avatar name={r.who} size="xs" /><span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{r.who}</span></span> },
            { key: 'account', header: 'Account', render: (r) => <span className="zt-num" style={{ color: 'var(--text-tertiary)', fontSize: 12.5 }}>{r.account}</span> },
            { key: 'amt', header: 'Amount', align: 'right', sortable: true, render: (r) => <AmountCell value={r.amt} income={r.income} /> },
          ]}
          rows={rows} sortKey="amt" />
      </Card>

      {sel ? <ZHQTxnDrawer txn={sel} onClose={() => setSel(null)} /> : null}
    </div>
  );
}

Object.assign(window, { ZHQTransactions });
