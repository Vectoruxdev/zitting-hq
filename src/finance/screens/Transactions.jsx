import React from 'react';
/* Transactions — filterable table with inline + bulk category/person editing,
   import CTA, empty state, and a detail drawer. */

function CategoryList({ cats, onPick }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 360, overflowY: 'auto' }}>
      {cats.map((c) => (
        <button key={c.id} onClick={() => onPick(c.id)} className="zhq-nav-item" data-active="false" style={{ width: '100%' }}>
          <span style={{ width: 9, height: 9, borderRadius: 999, background: c.color, flex: 'none' }} />
          {c.name}
        </button>
      ))}
    </div>
  );
}

function SplitEditor({ txn, onClose }) {
  const { Modal, Select, TextInput, Button, Icon } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  const API = window.ZHQ_API || {};
  const cats = (D.allCategories || []).filter((c) => c.kind !== 'transfer');
  const target = Math.abs(txn.amt);
  const [splits, setSplits] = React.useState([{ categoryId: txn.categoryId || 'uncategorized', amount: String(target) }]);
  const [busy, setBusy] = React.useState(false);
  const sum = splits.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const remaining = Math.round((target - sum) * 100) / 100;

  const set = (i, patch) => setSplits((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const add = () => setSplits((rs) => [...rs, { categoryId: 'uncategorized', amount: String(Math.max(0, remaining)) }]);
  const remove = (i) => setSplits((rs) => rs.filter((_, j) => j !== i));

  async function save() {
    if (Math.abs(remaining) > 0.01 || !API.splitTransaction) return;
    setBusy(true);
    try {
      await API.splitTransaction(txn.id, splits.map((r) => ({ categoryId: r.categoryId, amount: parseFloat(r.amount) || 0 })));
      window.ZHQ_REFRESH && window.ZHQ_REFRESH();
      onClose();
    } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title="Split transaction" width={460}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={busy || Math.abs(remaining) > 0.01}>Save split</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {splits.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <Select value={r.categoryId} onChange={(v) => set(i, { categoryId: v })} options={cats.map((c) => ({ value: c.id, label: c.name }))} style={{ flex: 1 }} />
            <TextInput value={r.amount} onChange={(v) => set(i, { amount: v })} prefix="$" inputMode="decimal" style={{ width: 120 }} />
            {splits.length > 1 ? <Button variant="ghost" size="sm" onClick={() => remove(i)} iconLeft={<Icon name="x" size={14} />} /> : null}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Button variant="ghost" size="sm" iconLeft={<Icon name="plus" size={14} />} onClick={add}>Add split</Button>
          <span className="zt-num" style={{ fontSize: 13, color: Math.abs(remaining) > 0.01 ? 'var(--warning)' : 'var(--accent)' }}>
            {Math.abs(remaining) > 0.01 ? `$${remaining.toFixed(2)} unallocated` : `Fully split · $${target.toFixed(2)}`}
          </span>
        </div>
      </div>
    </Modal>
  );
}

function ZHQTxnDrawer({ txn, onClose, onPickCategory, onPickPerson, onToggleTransfer, onUnlink }) {
  const { Icon, IconButton, Tag, Avatar, Badge, Toggle, Button } = window.ZittingHQDesignSystem_c9e528;
  const [splitOpen, setSplitOpen] = React.useState(false);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
      <div style={{ position: 'relative', width: 'min(420px, 100%)', height: '100%', background: 'var(--surface-card)', borderLeft: '1px solid var(--border-hairline)', boxShadow: 'var(--shadow-pop)', overflowY: 'auto', padding: 'clamp(16px, 5vw, 24px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <span className="zt-eyebrow">Transaction</span>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          {txn.income ? <Badge tone="positive" size="sm" dot>Income</Badge> : null}
          {txn.pending ? <Badge status="pending" size="sm" dot /> : null}
          {txn.isTransfer ? <Badge tone="neutral" size="sm">Transfer</Badge> : null}
          {txn.flagged ? <Badge tone="warning" size="sm">Flagged</Badge> : null}
        </div>
        <div style={{ fontSize: 19, fontWeight: 600, color: 'var(--text-primary)' }}>{txn.merchant}</div>
        <div className="zt-num" style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-0.03em', color: txn.income ? 'var(--positive)' : 'var(--text-primary)', marginTop: 8 }}>
          {txn.income ? '+' : '−'}${Math.abs(txn.amt).toFixed(2)}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: '20px 0' }}>
          {[['Date', txn.date], ['Account', txn.account], ['Category', 'cat'], ['Attributed to', 'who']].map(([k, kind]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid var(--border-hairline)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{k}</span>
              {kind === 'cat' ? (
                <span style={{ cursor: 'pointer' }} onClick={() => onPickCategory([txn.id])}><Tag color={txn.color} editable size="sm">{txn.cat}</Tag></span>
              ) : kind === 'who' ? (
                <span onClick={() => onPickPerson([txn.id])} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
                  <Avatar name={txn.who} size="xs" /><span style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>{txn.who}</span>
                  <Icon name="pencil" size={13} style={{ color: 'var(--text-tertiary)' }} />
                </span>
              ) : (
                <span className="zt-num" style={{ fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 500 }}>{k === 'Date' ? `${txn.date}, 2026` : txn.account}</span>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Transfer (exclude from spending)</span>
            <Toggle checked={!!txn.isTransfer} onChange={() => onToggleTransfer(txn)} />
          </div>
          {txn.transferPairId ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '13px 0', borderTop: '1px solid var(--border-hairline)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Linked transfer</div>
                <div style={{ fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{txn.transferWith || 'another account'}</div>
              </div>
              {onUnlink ? (
                <button onClick={() => onUnlink(txn)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12.5, color: 'var(--text-tertiary)', font: 'inherit' }} title="Not a transfer — unlink both legs and count them normally">
                  Unlink
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <Button variant="secondary" size="sm" full iconLeft={<Icon name="allocations" size={15} />} onClick={() => setSplitOpen(true)}>
          {txn.hasSplit ? 'Edit split' : 'Split into categories'}
        </Button>

        {splitOpen ? <SplitEditor txn={txn} onClose={() => setSplitOpen(false)} /> : null}
      </div>
    </div>
  );
}

function ZHQTransactions({ onNavigate }) {
  const { Card, Icon, Button, Tag, Avatar, DataTable, AmountCell, SegmentedControl, Checkbox, Modal } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  const API = window.ZHQ_API || {};
  const cats = D.allCategories || [];
  const members = D.members || [];

  const [sel, setSel] = React.useState(null);
  const [scope, setScope] = React.useState('All');
  const [selected, setSelected] = React.useState(() => new Set());
  const [picker, setPicker] = React.useState(null); // { kind:'category'|'person', ids:[] }
  const [busy, setBusy] = React.useState(false);

  const all = D.txns || [];
  const rows = scope === 'Review' ? all.filter((t) => !t.reviewed)
    : scope === 'Flagged' ? all.filter((t) => t.flagged)
    : scope === 'Income' ? all.filter((t) => t.income) : all;
  const reviewCount = all.filter((t) => !t.reviewed).length;
  const refresh = () => window.ZHQ_REFRESH && window.ZHQ_REFRESH();

  async function run(fn) {
    setBusy(true);
    try { await fn(); refresh(); } finally { setBusy(false); setPicker(null); setSelected(new Set()); }
  }
  const applyCategory = (ids, categoryId) => run(async () => {
    if (ids.length === 1) await API.updateTransaction(ids[0], { categoryId }, { learn: true });
    else await API.bulkUpdateTransactions(ids, { categoryId });
  });
  const applyPerson = (ids, memberId) => run(async () => {
    if (ids.length === 1) await API.updateTransaction(ids[0], { memberId });
    else await API.bulkUpdateTransactions(ids, { memberId });
  });
  const markTransfer = (ids) => run(async () => { await API.bulkUpdateTransactions(ids, { isTransfer: true, categoryId: 'transfer' }); });
  const toggleTransfer = (txn) => run(async () => { await API.markTransfer(txn.id, !txn.isTransfer); });
  const unlinkTransfer = (txn) => run(async () => { await API.unlinkTransfer(txn.id); });
  const confirmIds = (idsArg) => run(async () => { await API.confirmTransactions(idsArg); });

  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const ids = [...selected];

  // ---- empty state ----
  if (!all.length) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', padding: '60px 20px' }}>
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <span style={{ display: 'inline-flex', width: 52, height: 52, borderRadius: 999, placeItems: 'center', background: 'var(--surface-raised)', color: 'var(--text-tertiary)', marginBottom: 14 }}>
            <Icon name="list" size={24} />
          </span>
          <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 600 }}>No transactions yet</h2>
          <p style={{ margin: '0 0 18px', color: 'var(--text-secondary)', fontSize: 14 }}>Import a CSV from your bank to get started — your dashboard fills in automatically.</p>
          <Button variant="primary" iconLeft={<Icon name="arrowDown" size={16} />} onClick={() => onNavigate && onNavigate('import')}>Import transactions</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div className="zhq-desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 9, height: 36, padding: '0 14px', background: 'var(--surface-sunken)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-pill)', color: 'var(--text-tertiary)', minWidth: 220 }}>
          <Icon name="search" size={16} /><span style={{ fontSize: 13 }}>Search merchant, amount…</span>
        </div>
        {reviewCount > 0 ? (
          <button onClick={() => setScope('Review')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 13px', background: scope === 'Review' ? 'var(--surface-raised)' : 'var(--warning-soft)', border: '1px solid var(--warning)', borderRadius: 'var(--radius-pill)', color: 'var(--warning)', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {reviewCount} to review
          </button>
        ) : null}
        <div style={{ flex: 1 }} />
        <SegmentedControl options={['All', 'Review', 'Income', 'Flagged']} value={scope} onChange={setScope} size="sm" />
        <Button variant="primary" size="sm" iconLeft={<Icon name="arrowDown" size={15} />} onClick={() => onNavigate && onNavigate('import')}>Import</Button>
      </div>

      {/* bulk bar */}
      {selected.size > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface-raised)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-md)' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{selected.size} selected</span>
          <span style={{ flex: 1 }} />
          <Button variant="secondary" size="sm" onClick={() => setPicker({ kind: 'category', ids })} disabled={busy}>Set category</Button>
          <Button variant="secondary" size="sm" onClick={() => setPicker({ kind: 'person', ids })} disabled={busy}>Set person</Button>
          <Button variant="secondary" size="sm" onClick={() => confirmIds(ids)} disabled={busy}>Confirm</Button>
          <Button variant="secondary" size="sm" onClick={() => markTransfer(ids)} disabled={busy}>Mark transfer</Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      ) : null}

      <Card padding={6}>
        <DataTable
          onRowClick={setSel}
          columns={[
            { key: '_sel', header: '', render: (r) => <span onClick={(e) => { e.stopPropagation(); toggle(r.id); }}><Checkbox checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></span> },
            { key: 'date', header: 'Date', render: (r) => <span style={{ color: 'var(--text-secondary)' }}>{r.date}</span> },
            { key: 'merchant', header: 'Merchant', render: (r) => (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
                <span style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.merchant}</span>
                {r.flagged ? <Icon name="flag" size={13} style={{ color: 'var(--warning)' }} /> : null}
                {r.pending ? <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400 }}>pending</span> : null}
              </span>
            ) },
            { key: 'cat', header: 'Category', render: (r) => (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <span onClick={(e) => { e.stopPropagation(); setPicker({ kind: 'category', ids: [r.id] }); }} style={{ cursor: 'pointer' }}>
                  <Tag color={r.color} editable size="sm">{r.cat}</Tag>
                </span>
                {!r.reviewed ? <span title={`${Math.round((r.confidence || 0) * 100)}% confident · ${r.source || 'auto'}`} style={{ width: 6, height: 6, borderRadius: 999, flex: 'none', background: (r.confidence || 0) >= 0.7 ? 'var(--accent)' : 'var(--warning)' }} /> : null}
              </span>
            ) },
            { key: 'who', header: 'Person', render: (r) => (
              <span onClick={(e) => { e.stopPropagation(); setPicker({ kind: 'person', ids: [r.id] }); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <Avatar name={r.who} size="xs" /><span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{r.who}</span>
              </span>
            ) },
            { key: 'account', header: 'Account', render: (r) => <span className="zt-num" style={{ color: 'var(--text-tertiary)', fontSize: 12.5 }}>{r.account}</span> },
            { key: 'amt', header: 'Amount', align: 'right', sortable: true, render: (r) => <AmountCell value={r.amt} income={r.income} /> },
          ]}
          rows={rows} sortKey="amt" />
      </Card>

      {sel ? (
        <ZHQTxnDrawer
          txn={sel}
          onClose={() => setSel(null)}
          onPickCategory={(pids) => setPicker({ kind: 'category', ids: pids })}
          onPickPerson={(pids) => setPicker({ kind: 'person', ids: pids })}
          onToggleTransfer={(t) => { toggleTransfer(t); setSel(null); }}
          onUnlink={(t) => { unlinkTransfer(t); setSel(null); }}
        />
      ) : null}

      <Modal open={!!picker} onClose={() => setPicker(null)} title={picker?.kind === 'person' ? 'Assign person' : 'Choose category'} width={360}>
        {picker?.kind === 'category' ? (
          <CategoryList cats={cats} onPick={(cid) => applyCategory(picker.ids, cid)} />
        ) : picker?.kind === 'person' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {members.map((m) => (
              <button key={m.id} onClick={() => applyPerson(picker.ids, m.id)} className="zhq-nav-item" data-active="false" style={{ width: '100%' }}>
                <Avatar name={m.name} size="xs" />{m.name}
              </button>
            ))}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

Object.assign(window, { ZHQTransactions });
