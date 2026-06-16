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
          Every deposit from this payer — past and future — is labeled as income and credited to this person. Marked sources drive your forecasts, allowances, and the day-before reminders.
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

/* Low-balance alert settings — the cash-runway cushion + on/off. */
function RunwaySettingsModal({ open, onClose, settings }) {
  const { Modal, TextInput, Toggle, Button } = window.ZittingHQDesignSystem_c9e528;
  const API = window.ZHQ_API || {};
  const [enabled, setEnabled] = React.useState(true);
  const [buffer, setBuffer] = React.useState('300');
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (!open) return;
    setEnabled(settings?.cashRunwayEnabled !== false);
    setBuffer(String(Math.round(settings?.cashRunwayBuffer ?? 300)));
  }, [open, settings]);
  async function save() {
    if (!API.updateFinanceSettings) return;
    setBusy(true);
    try {
      const amount = Math.max(0, Math.round(parseFloat(buffer) || 0));
      await API.updateFinanceSettings({ cashRunwayBuffer: amount, cashRunwayEnabled: enabled });
      window.ZHQ_REFRESH && window.ZHQ_REFRESH();
      onClose();
    } finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title="Low-balance alerts" width={420}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={busy}>{busy ? '…' : 'Save'}</Button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Warn me before we run low</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, lineHeight: 1.5 }}>Each day we check whether an account will dip below your cushion before the next income lands.</div>
          </div>
          <Toggle checked={enabled} onChange={setEnabled} />
        </div>
        <TextInput label="Safety cushion ($)" value={buffer} onChange={setBuffer} placeholder="300" />
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          We'll warn when a checking or savings account is projected to fall below this amount before your next paycheck lands.
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
  const upcoming = inc.upcoming || [];
  const runway = inc.runway || { dipsBelowBuffer: false };
  const byMemberStats = new Map((inc.byMember || []).map((m) => [m.memberId, m]));
  const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const [modal, setModal] = React.useState(null); // null | { prefill }
  const [picking, setPicking] = React.useState(false); // "Add income" payer picker
  const [runwayOpen, setRunwayOpen] = React.useState(false); // low-balance alert settings
  const [busy, setBusy] = React.useState(false);
  const refresh = () => window.ZHQ_REFRESH && window.ZHQ_REFRESH();
  const pickPayer = (p) => {
    setPicking(false);
    setModal({ prefill: { matchKey: p.matchKey, name: p.name, accountId: p.accountId } });
  };
  async function remove(srcId) {
    if (!window.confirm('Remove this income source? Its deposits will stop counting as income (forecasts + allowances), and it won’t be suggested again. You can re-add it anytime.')) return;
    setBusy(true);
    try {
      // Soft-remove: deactivate (not hard-delete) so it stays suppressed from the
      // "detected income" suggestions instead of popping back next sync. Drops the
      // learned auto-categorization memory; re-marking it reactivates the row.
      await window.ZHQ_API.updateIncomeSource(srcId, { active: false });
      refresh();
    } finally { setBusy(false); }
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

      {runway && runway.dipsBelowBuffer ? (
        <Card padding={16}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ width: 34, height: 34, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: 'var(--warning-soft)', color: 'var(--warning)' }}>
              <Icon name="alert" size={17} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Low balance ahead</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.5 }}>
                {runway.worstAccountName || 'An account'} is projected to dip to {runway.lowLabel}{runway.lowDateLabel ? ` around ${runway.lowDateLabel}` : ''} before your next income lands.
              </div>
            </div>
            {isOwner ? <Button variant="ghost" size="sm" onClick={() => setRunwayOpen(true)}>Adjust</Button> : null}
          </div>
        </Card>
      ) : null}

      {upcoming.length ? (
        <div>
          <SectionHeader title="Coming up" />
          <Card padding={6}>
            {upcoming.slice(0, 6).map((f, i) => (
              <div key={(f.key || '') + i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 14px', borderBottom: i === Math.min(upcoming.length, 6) - 1 ? 'none' : '1px solid var(--border-hairline)' }}>
                <span style={{ width: 38, height: 38, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: 'var(--green-glow)', color: 'var(--accent)' }}>
                  <Icon name="trendingUp" size={17} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {f.dateLabel || 'soon'}{f.memberName ? ` · ${f.memberName}` : ''}
                  </div>
                </div>
                {f.confidence && f.confidence !== 'high' ? <Badge tone={f.confidence === 'manual' || f.confidence === 'override' ? 'accent' : 'neutral'} size="sm">{f.confidence === 'manual' ? 'expected' : f.confidence === 'override' ? 'adjusted' : f.confidence}</Badge> : null}
                <span className="zt-num" style={{ flex: 'none', fontSize: 14.5, fontWeight: 600, color: 'var(--accent)' }}>{f.amountLabel || money(f.amount)}</span>
              </div>
            ))}
          </Card>
          <p style={{ margin: '8px 2px 0', fontSize: 12, color: 'var(--text-tertiary)' }}>Predicted from each source's history. We'll remind you the day before one lands.</p>
        </div>
      ) : null}

      {sources.length ? (
        <div>
          <SectionHeader title="Your income" />
          {groups.map((gkey) => {
            const g = byMember.get(gkey);
            const stat = byMemberStats.get(gkey);
            const hasSeries = stat && stat.series && stat.series.values && stat.series.values.some((v) => v > 0);
            return (
              <div key={gkey} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: '0 2px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={g.name} size="xs" />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>{g.name}</span>
                  </div>
                  {stat ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      {hasSeries ? <Sparkline data={stat.series.values} width={90} height={26} area /> : null}
                      <div style={{ textAlign: 'right' }}>
                        <div className="zt-num" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{stat.totalLabel}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>all time · {stat.monthLabel} this mo</div>
                      </div>
                    </div>
                  ) : null}
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

      {isOwner ? (
        <Card padding={16}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 34, height: 34, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-tertiary)' }}><Icon name="alert" size={16} /></span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>Low-balance alerts</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {inc.settings && inc.settings.cashRunwayEnabled === false ? 'Off' : `On · warns below ${money((inc.settings && inc.settings.cashRunwayBuffer) || 300)}`}
                </div>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setRunwayOpen(true)}>Edit</Button>
          </div>
        </Card>
      ) : null}

      {picking ? <AddIncomePicker onClose={() => setPicking(false)} onPick={pickPayer} /> : null}
      <IncomeSourceModal open={!!modal} onClose={() => setModal(null)} prefill={modal?.prefill} />
      <RunwaySettingsModal open={runwayOpen} onClose={() => setRunwayOpen(false)} settings={inc.settings} />
    </div>
  );
}

Object.assign(window, { ZHQIncome });
