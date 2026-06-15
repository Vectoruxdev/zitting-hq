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

const TREND_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TREND_GRAN = [
  { id: 'weekly', label: 'Weekly', cap: 26, per: 'wk' },
  { id: 'monthly', label: 'Monthly', cap: 24, per: 'mo' },
  { id: 'yearly', label: 'Yearly', cap: 12, per: 'yr' },
  { id: '3y', label: '3-Year', cap: 8, per: '3yr' },
  { id: '5y', label: '5-Year', cap: 8, per: '5yr' },
];
function startOfWeek(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - x.getDay()); return x; }
function bucketIncome(points, gran) {
  const buckets = new Map();
  for (const p of points || []) {
    const d = new Date(String(p.date) + 'T00:00:00');
    if (isNaN(d.getTime())) continue;
    let key, t, label;
    if (gran === 'weekly') { const s = startOfWeek(d); key = 'w' + s.getTime(); t = s.getTime(); label = `${TREND_MON[s.getMonth()]} ${s.getDate()}`; }
    else if (gran === 'monthly') { key = `${d.getFullYear()}-${d.getMonth()}`; t = new Date(d.getFullYear(), d.getMonth(), 1).getTime(); label = `${TREND_MON[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`; }
    else if (gran === 'yearly') { key = `${d.getFullYear()}`; t = new Date(d.getFullYear(), 0, 1).getTime(); label = `${d.getFullYear()}`; }
    else { const span = gran === '3y' ? 3 : 5; const base = Math.floor(d.getFullYear() / span) * span; key = `${base}`; t = new Date(base, 0, 1).getTime(); label = `${base}–${base + span - 1}`; }
    const b = buckets.get(key) || { t, label, sum: 0 };
    b.sum += Number(p.amount) || 0;
    buckets.set(key, b);
  }
  const arr = [...buckets.values()].sort((a, b) => a.t - b.t);
  const cap = (TREND_GRAN.find((g) => g.id === gran) || {}).cap || 24;
  const recent = arr.slice(-cap);
  const sums = recent.map((b) => Math.round(b.sum * 100) / 100);
  const avg = sums.length ? sums.reduce((s, v) => s + v, 0) / sums.length : 0;
  // Thin x-labels to ~6 so the axis stays readable.
  const step = Math.ceil(recent.length / 6) || 1;
  const labels = recent.map((b, i) => (i % step === 0 || i === recent.length - 1 ? b.label : ''));
  return { data: sums, labels, avg, count: sums.length };
}
function IncomeTrend({ history }) {
  const { SegmentedControl, AreaChart } = window.ZittingHQDesignSystem_c9e528;
  const [gran, setGran] = React.useState('monthly');
  const points = (history && history.points) || [];
  const { data, labels, avg, count } = React.useMemo(() => bucketIncome(points, gran), [history, gran]);
  const money = (v) => '$' + Math.round(v).toLocaleString('en-US');
  const per = (TREND_GRAN.find((g) => g.id === gran) || {}).per;
  const setByLabel = (lbl) => { const g = TREND_GRAN.find((x) => x.label === lbl); if (g) setGran(g.id); };
  const curLabel = (TREND_GRAN.find((g) => g.id === gran) || {}).label;
  return (
    <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border-hairline)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="zt-eyebrow">Income over time</span>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{count} {count === 1 ? 'period' : 'periods'}</span>
      </div>
      <SegmentedControl size="sm" options={TREND_GRAN.map((g) => g.label)} value={curLabel} onChange={setByLabel} />
      <div style={{ marginTop: 14 }}>
        {count >= 2 ? (
          <AreaChart data={data} labels={labels} width={330} height={150} color="var(--positive)" />
        ) : count === 1 ? (
          <div className="zt-num" style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)' }}>{money(data[0])}</div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No income history from this source yet.</div>
        )}
      </div>
      {count >= 1 ? (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-hairline)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Average</span>
          <span className="zt-num" style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{money(avg)} <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 400 }}>/ {per}</span></span>
        </div>
      ) : null}
    </div>
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
        {txn.description ? (
          <div className="zt-num" style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 4, wordBreak: 'break-word', lineHeight: 1.4 }}>
            {txn.description}
          </div>
        ) : null}
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
          {txn.income && !txn.isTransfer ? (() => {
            const DD = window.ZHQ_DATA || {};
            const marked = ((DD.income && DD.income.sources) || []).find((s) => s.matchKey === txn.sourceKey);
            return (
              <div style={{ padding: '12px 0', borderTop: '1px solid var(--border-hairline)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: marked ? 'var(--accent)' : 'var(--text-tertiary)', lineHeight: 1.5 }}>
                  {marked
                    ? <>✓ Counts as income{marked.memberName ? ` · ${marked.memberName}` : ''}</>
                    : <>Not counted as income yet. Mark this payer so its deposits drive forecasts &amp; allowances.</>}
                </div>
                {!marked && window.ZHQ_API && window.ZHQ_API.markIncomeSource && txn.sourceKey ? (
                  <Button variant="secondary" size="sm" onClick={async () => {
                    await window.ZHQ_API.markIncomeSource({ matchKey: txn.sourceKey, name: txn.merchant, memberId: txn.memberId || null, accountId: txn.accountId || null });
                    window.ZHQ_REFRESH && window.ZHQ_REFRESH();
                  }}>Mark as income</Button>
                ) : null}
              </div>
            );
          })() : null}
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
          {txn.categorizedBy ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderTop: '1px solid var(--border-hairline)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Categorized by</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <Avatar name={txn.categorizedBy} size="xs" />
                <span style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>{txn.categorizedBy}</span>
                {txn.categorizedAt ? <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>· {txn.categorizedAt}</span> : null}
              </span>
            </div>
          ) : null}
        </div>

        {txn.income && !txn.isTransfer ? (
          <IncomeTrend history={(window.ZHQ_DATA && window.ZHQ_DATA.incomeHistory && window.ZHQ_DATA.incomeHistory[txn.sourceKey]) || null} />
        ) : null}

        {txn.receiptId ? (() => {
          const DD = window.ZHQ_DATA || {};
          const r = (DD.receipts || []).find((x) => x.id === txn.receiptId);
          if (!r) return null;
          const money = (v) => (v == null ? '' : (v < 0 ? '−$' : '$') + Math.abs(v).toFixed(2));
          return (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Icon name="receipt" size={15} style={{ color: 'var(--accent)' }} />
                <span className="zt-eyebrow">Receipt{r.uploadedBy ? ` · ${r.uploadedBy}` : ''}</span>
                <span style={{ flex: 1 }} />
                <button onClick={async () => {
                  const API = window.ZHQ_API || {};
                  if (!API.receiptSignedUrl) return;
                  const res = await API.receiptSignedUrl(r.id);
                  if (res && res.ok) window.open(res.url, '_blank', 'noopener');
                }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12.5, color: 'var(--text-tertiary)', font: 'inherit' }}>View photo</button>
              </div>
              {(r.lines || []).length ? (
                <div style={{ border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-md)', padding: '2px 12px', maxHeight: 260, overflowY: 'auto' }}>
                  {r.lines.map((l, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-hairline)' }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text-primary)' }}>
                        {l.name}{l.qty != null && l.qty !== 1 ? <span style={{ color: 'var(--text-tertiary)', fontSize: 11.5 }}> ×{l.qty}</span> : null}
                      </span>
                      <span className="zt-num" style={{ flex: 'none', fontSize: 12.5, color: l.price != null && l.price < 0 ? 'var(--accent)' : 'var(--text-secondary)' }}>{money(l.price)}</span>
                    </div>
                  ))}
                  {r.totalLabel ? (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '9px 0' }}>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Total</span>
                      <span className="zt-num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{r.totalLabel}</span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Photo attached — no line items{r.scanStatus === 'failed' ? " (couldn't read the photo)" : ''}.</div>
              )}
            </div>
          );
        })() : null}

        <Button variant="secondary" size="sm" full iconLeft={<Icon name="allocations" size={15} />} onClick={() => setSplitOpen(true)} style={{ marginTop: 18 }}>
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
  const [q, setQ] = React.useState(''); // live search
  const [selected, setSelected] = React.useState(() => new Set());
  const [picker, setPicker] = React.useState(null); // { kind:'category'|'person', ids:[] }
  const [busy, setBusy] = React.useState(false);

  // Newest-first: data.txns arrives ordered by id ASC (oldest first), so without
  // this the latest transactions sit at the very bottom of the list and the view
  // looks frozen. Sort by date desc, with id desc as a stable tiebreak.
  const all = React.useMemo(
    () => [...(D.txns || [])].sort((a, b) => String(b.isoDate || '').localeCompare(String(a.isoDate || '')) || b.id - a.id),
    [D.txns]
  );
  const scoped = scope === 'Review' ? all.filter((t) => !t.reviewed)
    : scope === 'Flagged' ? all.filter((t) => t.flagged)
    : scope === 'Income' ? all.filter((t) => t.income) : all;
  // Search across everything a person might remember about a charge:
  // merchant, raw bank text, category, person, account, amount, date.
  const needle = q.trim().toLowerCase();
  const rows = !needle ? scoped : scoped.filter((t) =>
    `${t.merchant} ${t.description || ''} ${t.cat} ${t.who} ${t.account} ${t.date} ${Math.abs(t.amt).toFixed(2)}`
      .toLowerCase()
      .includes(needle)
  );
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
          <span style={{ display: 'inline-flex', width: 52, height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center', background: 'var(--surface-raised)', color: 'var(--text-tertiary)', marginBottom: 14 }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, height: 40, padding: '0 8px 0 14px', background: 'var(--surface-sunken)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-pill)', color: 'var(--text-tertiary)', flex: '1 1 200px', minWidth: 160, maxWidth: 360 }}>
          <Icon name="search" size={16} style={{ flex: 'none' }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search merchant, amount…" aria-label="Search transactions"
            style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', font: 'inherit', fontSize: 13.5, color: 'var(--text-primary)' }} />
          {q ? (
            <button onClick={() => setQ('')} aria-label="Clear search" style={{ flex: 'none', width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
              <Icon name="x" size={13} />
            </button>
          ) : null}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', rowGap: 8, padding: '10px 14px', background: 'var(--surface-raised)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-md)' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{selected.size} selected</span>
          <span style={{ flex: 1 }} />
          <Button variant="secondary" size="sm" onClick={() => setPicker({ kind: 'category', ids })} disabled={busy}>Set category</Button>
          <Button variant="secondary" size="sm" onClick={() => setPicker({ kind: 'person', ids })} disabled={busy}>Set person</Button>
          <Button variant="secondary" size="sm" onClick={() => confirmIds(ids)} disabled={busy}>Confirm</Button>
          <Button variant="secondary" size="sm" onClick={() => markTransfer(ids)} disabled={busy}>Mark transfer</Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      ) : null}

      {needle && rows.length === 0 ? (
        <Card padding={20}>
          <div style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>
            No transactions match &quot;{q.trim()}&quot;{scope !== 'All' ? ` in ${scope}` : ''}. Try fewer words or clear the search.
          </div>
        </Card>
      ) : null}

      {/* Mobile: stacked rows — merchant + amount visible at a glance (the
          table's amount column lives off-screen at phone widths). Tap a row
          for the detail drawer; tap the chip to recategorize. */}
      <div className="zhq-mobile-block">
        <Card padding={6}>
          {rows.map((r, i) => (
            <div key={r.id} role="button" tabIndex={0} onClick={() => setSel(r)}
              onKeyDown={(e) => { if (e.key === 'Enter') setSel(r); }}
              style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 10px', cursor: 'pointer', borderTop: i ? '1px solid var(--border-hairline)' : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{r.merchant}</span>
                  {r.flagged ? <Icon name="flag" size={12} style={{ color: 'var(--warning)', flex: 'none' }} /> : null}
                  {r.pending ? <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', flex: 'none' }}>pending</span> : null}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 }}>
                  <span onClick={(e) => { e.stopPropagation(); setPicker({ kind: 'category', ids: [r.id] }); }}>
                    <Tag color={r.color} editable size="sm">{r.cat}</Tag>
                  </span>
                  {!r.reviewed ? <span style={{ width: 6, height: 6, borderRadius: 999, flex: 'none', background: (r.confidence || 0) >= 0.7 ? 'var(--accent)' : 'var(--warning)' }} /> : null}
                  <span className="zt-num" style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.date} · {r.account}</span>
                </div>
              </div>
              <span style={{ flex: 'none' }}><AmountCell value={r.amt} income={r.income} /></span>
            </div>
          ))}
        </Card>
      </div>

      <Card padding={6} className="zhq-desktop-only">
        <DataTable
          onRowClick={setSel}
          columns={[
            { key: '_sel', header: '', render: (r) => <span onClick={(e) => { e.stopPropagation(); toggle(r.id); }}><Checkbox checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></span> },
            { key: 'date', header: 'Date', render: (r) => <span style={{ color: 'var(--text-secondary)' }}>{r.date}</span> },
            { key: 'merchant', header: 'Merchant', render: (r) => (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 500 }}
                title={[r.merchant, r.description].filter(Boolean).join(' · ')}>
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
                {r.categorizedBy ? <span title={`Categorized by ${r.categorizedBy}${r.categorizedAt ? ` · ${r.categorizedAt}` : ''}`} style={{ display: 'inline-flex', flex: 'none' }}><Avatar name={r.categorizedBy} size="xs" /></span> : null}
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
