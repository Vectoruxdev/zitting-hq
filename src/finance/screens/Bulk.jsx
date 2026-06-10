import React from 'react';
/* Tidy up — bulk categorization by merchant cluster. The engine groups
   transactions by merchant and suggests a category for each group; the user
   clears dozens at once (accept a suggestion, set a group, or select many groups
   and assign one category). Every apply trains the learner. Undo restores the
   exact prior state. Reads D.bulkGroups. */

function BulkCatPicker({ title, onPick, onClose }) {
  const { Modal } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA || {};
  const groups = D.categoryGroups || [];
  const cats = (D.allCategories || []).filter((c) => c.id !== 'uncategorized');
  const byGroup = groups.map((g) => ({ g, items: cats.filter((c) => c.groupId === g.id) })).filter((x) => x.items.length);
  const ungrouped = cats.filter((c) => !groups.some((g) => g.id === c.groupId));
  return (
    <Modal open onClose={onClose} title={title || 'Pick a category'} width={440}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '60vh', overflowY: 'auto' }}>
        {[...byGroup, ...(ungrouped.length ? [{ g: { id: '_', name: 'Other' }, items: ungrouped }] : [])].map(({ g, items }) => (
          <div key={g.id}>
            <div className="zt-eyebrow" style={{ marginBottom: 8 }}>{g.name}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {items.map((c) => (
                <button key={c.id} onClick={() => onPick(c.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 13px', borderRadius: 999, border: '1px solid var(--border-hairline)', background: 'var(--surface-card)', cursor: 'pointer', font: 'inherit', fontSize: 13.5, color: 'var(--text-primary)' }}>
                  <span style={{ width: 9, height: 9, borderRadius: 999, background: c.color || 'var(--gray-500)' }} />
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function ZHQBulk() {
  const { Card, Button, Icon, Badge, Tag, Tabs, TextInput, Checkbox, EmptyState } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA || {};
  const API = window.ZHQ_API || {};
  const all = D.bulkGroups || [];

  const [filter, setFilter] = React.useState('needs');
  const [q, setQ] = React.useState('');
  const [selected, setSelected] = React.useState(() => new Set());
  const [picker, setPicker] = React.useState(null); // { mode:'group'|'multi', group? }
  const [busy, setBusy] = React.useState(false);
  // Undo snapshot survives the data-refresh remount via window.
  const [undo, setUndo] = React.useState(() => (typeof window !== 'undefined' ? window.__ZHQ_BULK_UNDO || null : null));

  const refresh = () => window.ZHQ_REFRESH && window.ZHQ_REFRESH();
  const setUndoSnap = (snap) => { if (typeof window !== 'undefined') window.__ZHQ_BULK_UNDO = snap; setUndo(snap); };

  async function apply(groups, label) {
    if (!groups.length || !API.applyBulkCategories) return;
    setBusy(true);
    try {
      const res = await API.applyBulkCategories(groups.map((g) => ({ ids: g.ids, categoryId: g.categoryId })));
      const count = groups.reduce((s, g) => s + g.ids.length, 0);
      if (res && res.undo) setUndoSnap({ pairs: res.undo, count, label });
      setSelected(new Set());
      refresh();
    } finally { setBusy(false); }
  }
  const acceptSuggestion = (g) => apply([{ ids: g.ids, categoryId: g.suggestion.categoryId }], `${g.merchant} → ${g.suggestion.name}`);
  const setGroup = (g, categoryId) => apply([{ ids: g.ids, categoryId }], g.merchant);
  const acceptAll = () => {
    const targets = visible.filter((g) => g.suggestion && g.suggestion.confidence >= 0.7 && (g.unreviewed > 0 || g.uncategorized > 0));
    apply(targets.map((g) => ({ ids: g.ids, categoryId: g.suggestion.categoryId })), `${targets.length} suggestions`);
  };
  const applyMulti = (categoryId) => {
    const groups = visible.filter((g) => selected.has(g.key));
    const ids = groups.flatMap((g) => g.ids);
    apply([{ ids, categoryId }], `${groups.length} merchants`);
  };
  async function doUndo() {
    if (!undo || !API.restoreTransactionCategories) return;
    setBusy(true);
    try { await API.restoreTransactionCategories(undo.pairs); setUndoSnap(null); refresh(); }
    finally { setBusy(false); }
  }

  const toggle = (key) => setSelected((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const needs = all.filter((g) => g.unreviewed > 0 || g.uncategorized > 0);
  const base = filter === 'needs' ? needs : all;
  const visible = q.trim()
    ? base.filter((g) => g.merchant.toLowerCase().includes(q.trim().toLowerCase()) || (g.suggestion?.name || '').toLowerCase().includes(q.trim().toLowerCase()) || (g.currentCategory || '').toLowerCase().includes(q.trim().toLowerCase()))
    : base;
  const confidentSuggestions = visible.filter((g) => g.suggestion && g.suggestion.confidence >= 0.7 && (g.unreviewed > 0 || g.uncategorized > 0)).length;
  const needsTxns = needs.reduce((s, g) => s + (g.unreviewed || g.uncategorized || 0), 0);

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 80 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Tidy up</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Transactions grouped by merchant. Accept a suggestion, set a whole group, or pick several and categorize them together. Everything you set teaches the auto-categorizer.
          </p>
        </div>
        {confidentSuggestions > 0 ? (
          <Button variant="primary" size="sm" disabled={busy} onClick={acceptAll} iconLeft={<Icon name="sparkles" size={15} />}>
            Accept {confidentSuggestions} suggestion{confidentSuggestions === 1 ? '' : 's'}
          </Button>
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Tabs options={[{ value: 'needs', label: `Needs review${needs.length ? ` (${needs.length})` : ''}` }, { value: 'all', label: 'All merchants' }]} value={filter} onChange={setFilter} />
        <span style={{ flex: 1 }} />
        <div style={{ minWidth: 200, flex: '1 1 200px' }}><TextInput value={q} onChange={setQ} placeholder="Search merchants…" /></div>
      </div>

      {!all.length ? (
        <EmptyState icon="sparkles" title="Nothing to tidy" body="Import or sync some transactions and they'll show up here, grouped by merchant for fast categorizing." />
      ) : !visible.length ? (
        <div style={{ textAlign: 'center', padding: '40px 10px' }}>
          <span style={{ display: 'inline-flex', width: 56, height: 56, borderRadius: 999, placeItems: 'center', background: 'var(--green-glow)', color: 'var(--accent)', marginBottom: 12 }}><Icon name="check" size={26} /></span>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{filter === 'needs' ? 'All caught up' : 'No matches'}</div>
          <div style={{ fontSize: 13.5, color: 'var(--text-tertiary)', marginTop: 6 }}>{filter === 'needs' ? 'Every merchant is reviewed. Switch to “All merchants” to re-categorize anything.' : `Nothing matches “${q}”.`}</div>
        </div>
      ) : (
        <Card padding={2}>
          {visible.map((g, i) => {
            const sel = selected.has(g.key);
            return (
              <div key={g.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderBottom: i === visible.length - 1 ? 'none' : '1px solid var(--border-hairline)', background: sel ? 'var(--surface-hover)' : 'transparent' }}>
                <Checkbox checked={sel} onChange={() => toggle(g.key)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>{g.merchant}</span>
                    <Badge tone="neutral" size="sm">{g.count}</Badge>
                    {g.unreviewed > 0 ? <span className="zt-num" style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 600 }}>{g.unreviewed} to review</span> : null}
                    {g.currentCategory && g.unreviewed === 0 ? <Tag color={g.currentColor} size="sm">{g.mixed ? 'Mixed' : g.currentCategory}</Tag> : null}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    {g.spendLabel}{g.dateRange ? ` · ${g.dateRange}` : ''}{g.accounts && g.accounts.length ? ` · ${g.accounts.join(', ')}` : ''}
                  </div>
                </div>
                {g.suggestion && (g.unreviewed > 0 || g.uncategorized > 0) ? (
                  <button onClick={() => acceptSuggestion(g)} disabled={busy} title={g.suggestion.reason || ''} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 11px', borderRadius: 999, border: `1px solid ${g.suggestion.confidence >= 0.7 ? 'var(--green-tint)' : 'var(--border-hairline)'}`, background: 'var(--surface-card)', cursor: 'pointer', font: 'inherit' }}>
                    <span style={{ width: 9, height: 9, borderRadius: 999, background: g.suggestion.color, flex: 'none' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{g.suggestion.name}</span>
                    <span className="zt-num" style={{ fontSize: 11, color: g.suggestion.confidence >= 0.7 ? 'var(--accent)' : 'var(--text-tertiary)' }}>{g.suggestion.confidencePct}%</span>
                    <Icon name="check" size={14} style={{ color: 'var(--accent)' }} />
                  </button>
                ) : null}
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setPicker({ mode: 'group', group: g })}>Set…</Button>
              </div>
            );
          })}
        </Card>
      )}

      {/* selected → assign one category to all */}
      {selected.size > 0 ? (
        <div style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 40, display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 'var(--radius-lg)', background: 'var(--surface-raised)', border: '1px solid var(--border-hairline)', boxShadow: 'var(--shadow-pop)' }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
            {selected.size} merchant{selected.size === 1 ? '' : 's'} · {visible.filter((g) => selected.has(g.key)).reduce((s, g) => s + g.count, 0)} transactions
          </span>
          <Button variant="primary" size="sm" disabled={busy} onClick={() => setPicker({ mode: 'multi' })}>Set category</Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      ) : undo ? (
        <div style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 40, display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 'var(--radius-lg)', background: 'var(--surface-raised)', border: '1px solid var(--border-hairline)', boxShadow: 'var(--shadow-pop)' }}>
          <Icon name="check" size={16} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>Categorized {undo.count} transaction{undo.count === 1 ? '' : 's'}{undo.label ? ` · ${undo.label}` : ''}</span>
          <Button variant="ghost" size="sm" disabled={busy} onClick={doUndo}>Undo</Button>
          <button onClick={() => setUndoSnap(null)} title="Dismiss" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'inline-flex', padding: 2 }}><Icon name="x" size={15} /></button>
        </div>
      ) : null}

      {picker ? (
        <BulkCatPicker
          title={picker.mode === 'multi' ? `Categorize ${selected.size} merchants` : `Categorize all “${picker.group.merchant}”`}
          onClose={() => setPicker(null)}
          onPick={(categoryId) => { const p = picker; setPicker(null); p.mode === 'multi' ? applyMulti(categoryId) : setGroup(p.group, categoryId); }}
        />
      ) : null}
    </div>
  );
}

Object.assign(window, { ZHQBulk });
