import React from 'react';
/* Income — the curated income registry. Mark which payers count as income;
   only marked sources drive the transfer-coverage forecast + allowance paychecks. */

function IncomeSourceModal({ open, onClose, prefill }) {
  const { Modal, TextInput, Select, Button } = window.ZittingHQDesignSystem_c9e528;
  const API = window.ZHQ_API || {};
  const D = window.ZHQ_DATA || {};
  const members = D.members || [];
  const accts = (D.accountsFlat || []).map((a) => ({ value: a.id, label: a.label || a.name }));
  const editing = !!(prefill && prefill.id);
  const [name, setName] = React.useState('');
  const [memberId, setMemberId] = React.useState('');
  const [acct, setAcct] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (!open) return;
    setName(prefill?.name || '');
    setMemberId(prefill?.memberId || '');
    setAcct(prefill?.accountId || '');
  }, [open, prefill]);
  const valid = name.trim() && (prefill?.matchKey);
  async function save() {
    if (!valid || !API.markIncomeSource) return;
    setBusy(true);
    try {
      if (editing && API.updateIncomeSource) {
        await API.updateIncomeSource(prefill.id, { name: name.trim(), memberId: memberId || null, accountId: acct || null });
      } else {
        await API.markIncomeSource({ matchKey: prefill.matchKey, name: name.trim(), memberId: memberId || null, accountId: acct || null });
      }
      window.ZHQ_REFRESH && window.ZHQ_REFRESH();
      onClose();
    } finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit income source' : 'Mark as income'} width={420}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={busy || !valid}>{busy ? '…' : (editing ? 'Save' : 'Mark as income')}</Button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <TextInput label="Name" value={name} onChange={setName} placeholder="Jaelynn — Nursing paycheck" />
        <Select label="Whose income?" value={memberId} onChange={setMemberId} options={[{ value: '', label: 'Household' }, ...members.map((m) => ({ value: m.id, label: m.name }))]} />
        <Select label="Deposits into (optional)" value={acct} onChange={setAcct} options={[{ value: '', label: 'Any account' }, ...accts]} />
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          Every deposit from this payer — past and future — will count as income. Only marked sources drive the transfer forecast and allowance paychecks.
        </p>
      </div>
    </Modal>
  );
}

/* "Add income" picker — every payer that has ever deposited money, searchable
   and filterable, so the real paychecks (ADP, etc.) are always findable even
   when the cadence detector missed them. Marking is one tap → the existing
   mark-as-income modal, prefilled. */
function AddIncomePicker({ onClose, onPick }) {
  const { Modal, TextInput, Badge } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA || {};
  const payers = ((D.income || {}).allPayers || []).filter((p) => !p.registered);
  const [q, setQ] = React.useState('');
  const [filter, setFilter] = React.useState('likely'); // likely | recurring | large | all
  const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

  const FILTERS = [
    { k: 'likely', label: 'Likely income' }, // repeat payers with real money
    { k: 'recurring', label: 'Recurring' },
    { k: 'large', label: 'Large' },
    { k: 'all', label: `All payers · ${payers.length}` },
  ];
  const needle = q.trim().toLowerCase();
  const rows = payers
    .filter((p) => !needle || `${p.name} ${p.matchKey}`.toLowerCase().includes(needle))
    .filter((p) => {
      if (filter === 'recurring') return !!p.cadence;
      if (filter === 'large') return p.avg >= 500;
      if (filter === 'likely') return p.count >= 2 && p.avg >= 100;
      return true;
    })
    .slice(0, 60);

  return (
    <Modal open onClose={onClose} title="Add income" width={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <TextInput placeholder="Search payers… (ADP, Venmo, employer name)" value={q} onChange={setQ} autoFocus />
        <div className="zhq-hscroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {FILTERS.map((f) => (
            <button key={f.k} onClick={() => setFilter(f.k)} style={{
              flex: 'none', padding: '8px 13px', borderRadius: 999, border: '1px solid var(--border-hairline)',
              background: filter === f.k ? 'var(--green-glow)' : 'var(--surface-sunken)',
              color: filter === f.k ? 'var(--accent)' : 'var(--text-tertiary)',
              font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', minHeight: 38, whiteSpace: 'nowrap',
            }}>{f.label}</button>
          ))}
        </div>
        <div style={{ maxHeight: '52vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {rows.length === 0 ? (
            <div style={{ padding: '22px 6px', fontSize: 13.5, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
              {payers.length === 0
                ? 'No deposits found yet — sync or import transactions first.'
                : 'Nothing matches. Try "All payers" or a different search.'}
            </div>
          ) : rows.map((p) => (
            <button key={p.matchKey} onClick={() => onPick(p)} style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
              padding: '12px 8px', background: 'none', border: 'none', borderBottom: '1px solid var(--border-hairline)',
              cursor: 'pointer', font: 'inherit', minHeight: 56,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{p.name}</span>
                  {p.cadence ? <Badge tone="accent" size="sm">{p.cadence}</Badge> : null}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>
                  {p.count} deposit{p.count === 1 ? '' : 's'} · avg {p.avgLabel || money(p.avg)}{p.last ? ` · last ${p.last}` : ''}{p.accountLabel ? ` · ${p.accountLabel}` : ''}
                </div>
              </div>
              <span className="zt-num" style={{ flex: 'none', fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>{p.totalLabel || money(p.total)}</span>
              <span style={{ flex: 'none', fontSize: 12.5, fontWeight: 700, color: 'var(--accent)' }}>Mark →</span>
            </button>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          Pick a payer and every deposit it has ever sent — and will send — counts as income.
          Set incomes stay set; you'll only come back here when something changes (like a new job).
        </p>
      </div>
    </Modal>
  );
}

function ZHQIncome() {
  const { Card, SectionHeader, Button, Icon, Badge, AreaChart, Sparkline, StatTile, Avatar, EmptyState } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  const me = window.ZHQ_USER || {};
  const isOwner = me.role === 'owner';
  const inc = D.income || { sources: [], candidates: [], totalMonthly: 0, totalMonthlyLabel: '$0' };
  const sources = inc.sources || [];
  const candidates = inc.candidates || [];
  const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const [modal, setModal] = React.useState(null); // null | { prefill }
  const [picking, setPicking] = React.useState(false); // "Add income" payer picker
  const [busy, setBusy] = React.useState(false);
  const refresh = () => window.ZHQ_REFRESH && window.ZHQ_REFRESH();
  const pickPayer = (p) => {
    setPicking(false);
    setModal({ prefill: { matchKey: p.matchKey, name: p.name, accountId: p.accountId } });
  };
  async function remove(srcId) {
    if (!window.confirm('Remove this income source? Its deposits will stop counting toward forecasts and allowances.')) return;
    setBusy(true);
    try { await window.ZHQ_API.deleteIncomeSource(srcId); refresh(); } finally { setBusy(false); }
  }

  // Group registered sources by person (Household last).
  const groups = [];
  const byMember = new Map();
  for (const s of sources) {
    const key = s.memberId || '__household__';
    if (!byMember.has(key)) { byMember.set(key, { name: s.memberName || 'Household', items: [] }); groups.push(key); }
    byMember.get(key).items.push(s);
  }

  if (!sources.length && !candidates.length) {
    return (
      <>
        <EmptyState icon="trendingUp" title="No income marked yet"
          body="Mark which payers are real income (e.g. each paycheck). Only marked sources drive your transfer forecast and allowances."
          actionLabel={isOwner ? 'Add income' : undefined}
          onAction={isOwner ? () => setPicking(true) : undefined} />
        {picking ? <AddIncomePicker onClose={() => setPicking(false)} onPick={pickPayer} /> : null}
        <IncomeSourceModal open={!!modal} onClose={() => setModal(null)} prefill={modal?.prefill} />
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Card padding={24}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 8 }}>
          <div>
            <div className="zt-eyebrow" style={{ marginBottom: 8 }}>Marked monthly income</div>
            <div className="zt-num" style={{ fontSize: 44, fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>{inc.totalMonthlyLabel || money(inc.totalMonthly || 0)}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
            <StatTile label="Sources" value={String(sources.length)} size="sm" />
            {isOwner ? (
              <Button variant="primary" iconLeft={<Icon name="plus" size={16} />} onClick={() => setPicking(true)}>Add income</Button>
            ) : null}
          </div>
        </div>
        {D.trend ? <AreaChart data={D.trend.income} labels={D.trend.labels} height={200} /> : null}
      </Card>

      {sources.length ? (
        <div>
          <SectionHeader title="Your income" />
          {groups.map((gkey) => {
            const g = byMember.get(gkey);
            return (
              <div key={gkey} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 2px 8px' }}>
                  <Avatar name={g.name} size="xs" />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>{g.name}</span>
                </div>
                <Card padding={6}>
                  {g.items.map((s, i) => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 14px', borderBottom: i === g.items.length - 1 ? 'none' : '1px solid var(--border-hairline)' }}>
                      <span style={{ width: 38, height: 38, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: 'var(--surface-raised)', color: s.status === 'late' ? 'var(--warning)' : 'var(--accent)' }}>
                        <Icon name={s.status === 'late' ? 'clock' : 'trendingUp'} size={17} />
                      </span>
                      <div style={{ minWidth: 140, flex: '1 1 140px' }}>
                        <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{s.accountLabel || 'Any account'}{s.cadence ? ` · ${s.cadence}` : ''}</div>
                      </div>
                      {s.spark && s.spark.length ? <Sparkline data={s.spark} width={84} height={28} area /> : null}
                      <div style={{ width: 116, textAlign: 'right' }}>
                        <div className="zt-num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{money(s.monthly)}<span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>/mo</span></div>
                        {s.next ? <div style={{ fontSize: 11.5, color: s.status === 'late' ? 'var(--warning)' : 'var(--text-tertiary)', marginTop: 2 }}>{s.status === 'late' ? `Late · exp. ${s.next}` : `next ${s.next}`}</div> : null}
                      </div>
                      {isOwner ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => setModal({ prefill: { id: s.id, matchKey: s.matchKey, name: s.name, memberId: s.memberId, accountId: s.accountId } })} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', minWidth: 30 }}><Icon name="pencil" size={14} /></button>
                          <button onClick={() => remove(s.id)} disabled={busy} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', minWidth: 30 }}><Icon name="x" size={15} /></button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </Card>
              </div>
            );
          })}
        </div>
      ) : null}

      {isOwner && candidates.length ? (
        <div>
          <SectionHeader title="Detected — not income yet" />
          <Card padding={6}>
            {candidates.map((c, i) => (
              <div key={c.matchKey} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 14px', borderBottom: i === candidates.length - 1 ? 'none' : '1px solid var(--border-hairline)' }}>
                <span style={{ width: 38, height: 38, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-tertiary)' }}>
                  <Icon name="trendingUp" size={17} />
                </span>
                <div style={{ minWidth: 140, flex: '1 1 140px' }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{c.sub || ''}{c.cadence ? ` · ${c.cadence}` : ''}</div>
                </div>
                <div className="zt-num" style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>{money(c.monthly)}/mo</div>
                <Button variant="secondary" size="sm" onClick={() => setModal({ prefill: { matchKey: c.matchKey, name: c.name, accountId: c.accountId } })}>Mark as income</Button>
              </div>
            ))}
          </Card>
          <p style={{ margin: '8px 2px 0', fontSize: 12, color: 'var(--text-tertiary)' }}>These are recurring deposits we detected. Mark the ones that are real income so they count toward forecasts and allowances.</p>
        </div>
      ) : null}

      {picking ? <AddIncomePicker onClose={() => setPicking(false)} onPick={pickPayer} /> : null}
      <IncomeSourceModal open={!!modal} onClose={() => setModal(null)} prefill={modal?.prefill} />
    </div>
  );
}

Object.assign(window, { ZHQIncome });
