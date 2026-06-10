import React from 'react';
/* Allocations — priority-ordered waterfall rule builder + live preview.
 * These rules ARE the transfer engine: when income arrives (on_income) OR on a
 * schedule (scheduled), they generate the pending transfers on the Transfers
 * tab. The app plans + reminds; your bank moves the money; Plaid sync checks it
 * off automatically. */

const CADENCE_OPTS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'semimonthly', label: 'Twice a month (1st & 15th)' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Every 3 months' },
  { value: 'yearly', label: 'Yearly' },
];

// Small client mirror of src/db/schedule.ts for the form's "next runs" preview.
function previewRuns(cadence, anchorISO, count) {
  if (!cadence) return [];
  const MS = 86400000;
  const toUTC = (s) => new Date(s.slice(0, 10) + 'T00:00:00Z');
  const fmt = (d) => d.toISOString().slice(0, 10);
  const clamp = (y, m, day) => Math.min(day, new Date(Date.UTC(y, m + 1, 0)).getUTCDate());
  const addMonths = (d, n, ad) => { const t = d.getUTCFullYear() * 12 + d.getUTCMonth() + n; const y = Math.floor(t / 12); const m = ((t % 12) + 12) % 12; return new Date(Date.UTC(y, m, clamp(y, m, ad))); };
  const today = new Date().toISOString().slice(0, 10);
  const out = [];
  if (cadence === 'semimonthly') {
    const semiOnAfter = (from) => { const a = toUTC(from); const y = a.getUTCFullYear(); const m = a.getUTCMonth(); const c = [Date.UTC(y, m, 1), Date.UTC(y, m, 15), Date.UTC(y, m + 1, 1)].map((t) => fmt(new Date(t))); return c.find((x) => x >= from) || c[2]; };
    let r = semiOnAfter(today);
    for (let i = 0; i < count; i++) { out.push(r); r = semiOnAfter(fmt(new Date(toUTC(r).getTime() + MS))); }
    return out;
  }
  const anchor = (anchorISO && /^\d{4}-\d{2}-\d{2}/.test(anchorISO)) ? anchorISO : today;
  const ad = toUTC(anchor).getUTCDate();
  const step = (d) => { switch (cadence) { case 'weekly': return new Date(d.getTime() + 7 * MS); case 'biweekly': return new Date(d.getTime() + 14 * MS); case 'monthly': return addMonths(d, 1, ad); case 'quarterly': return addMonths(d, 3, ad); case 'yearly': return addMonths(d, 12, ad); default: return new Date(d.getTime() + 7 * MS); } };
  const from = anchor > today ? anchor : today;
  let cur = toUTC(anchor); let g = 0;
  while (fmt(cur) < from && g++ < 6000) cur = step(cur);
  for (let i = 0; i < count; i++) { out.push(fmt(cur)); cur = step(cur); }
  return out;
}
function labelDate(iso) { const d = new Date(iso + 'T00:00:00'); return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }

function ZHQAllocRuleModal({ open, onClose, editing }) {
  const { Modal, Select, TextInput, SegmentedControl, Toggle, Button } = window.ZittingHQDesignSystem_c9e528;
  const API = window.ZHQ_API || {};
  const D = window.ZHQ_DATA;
  const accounts = D.accountsFlat || [];
  const members = D.members || [];

  const [name, setName] = React.useState('');
  const [fromId, setFromId] = React.useState('');
  const [toId, setToId] = React.useState('');
  const [memberId, setMemberId] = React.useState('');
  const [method, setMethod] = React.useState('%');
  const [value, setValue] = React.useState('');
  const [trigger, setTrigger] = React.useState('on_income');
  const [cadence, setCadence] = React.useState('monthly');
  const [anchorDate, setAnchorDate] = React.useState('');
  const [enabled, setEnabled] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  const todayISO = () => new Date().toISOString().slice(0, 10);

  React.useEffect(() => {
    if (!open) return;
    setName(editing?.name || '');
    setFromId(editing?.fromAccountId || '');
    setToId(editing?.toAccountId || '');
    setMemberId(editing?.memberId || '');
    setMethod(editing?.method || '%');
    setValue(editing && editing.value != null ? String(editing.value) : '');
    setTrigger(editing?.trigger || 'on_income');
    setCadence(editing?.cadence || 'monthly');
    setAnchorDate(editing?.anchorDate || todayISO());
    setEnabled(editing?.enabled ?? true);
    setBusy(false);
  }, [open, editing]);

  const scheduled = trigger === 'scheduled';
  const needsValue = scheduled || method !== 'Remainder';
  const val = parseFloat(value);
  const valid = name.trim() && toId
    && (!needsValue || (Number.isFinite(val) && val > 0))
    && (!scheduled || (fromId && toId)); // scheduled needs both ends

  const runs = scheduled ? previewRuns(cadence, cadence === 'semimonthly' ? null : anchorDate, 3) : [];

  async function save() {
    if (!valid) return;
    const payload = {
      name: name.trim(),
      method: scheduled ? 'Fixed' : method,
      value: needsValue ? val : null,
      fromAccountId: fromId || null,
      toAccountId: toId,
      memberId: memberId || null,
      trigger,
      enabled,
      cadence: scheduled ? cadence : null,
      anchorDate: scheduled ? (cadence === 'semimonthly' ? todayISO() : (anchorDate || todayISO())) : null,
    };
    setBusy(true);
    try {
      if (editing && API.updateAllocationRule) await API.updateAllocationRule(editing.id, payload);
      else if (API.createAllocationRule) await API.createAllocationRule(payload);
      window.ZHQ_REFRESH && window.ZHQ_REFRESH();
      onClose();
    } finally { setBusy(false); }
  }

  const acctOpts = accounts.map((a) => ({ value: a.id, label: a.label }));

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit rule' : 'New allocation rule'} width={460}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={busy || !valid}>{editing ? 'Save' : 'Add rule'}</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <TextInput label="Rule name" value={name} onChange={setName} placeholder={scheduled ? 'Monthly savings' : 'Tithe'} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Select label="From account" value={fromId} onChange={setFromId} placeholder="Choose account" options={acctOpts} />
          <Select label="To account" value={toId} onChange={setToId} placeholder="Choose account" options={acctOpts} />
        </div>

        <Select label="Trigger" value={trigger} onChange={setTrigger}
          options={[
            { value: 'on_income', label: 'When income arrives' },
            { value: 'scheduled', label: 'On a schedule' },
            { value: 'manual', label: 'Manual only' },
          ]} />

        {scheduled ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: cadence === 'semimonthly' ? '1fr' : '1fr 1fr', gap: 12 }}>
              <Select label="How often" value={cadence} onChange={setCadence} options={CADENCE_OPTS} />
              {cadence !== 'semimonthly' ? (
                <TextInput label="Starts" value={anchorDate} onChange={setAnchorDate} type="date" />
              ) : null}
            </div>
            <TextInput label="Amount each transfer" value={value} onChange={setValue} prefix="$" type="number" inputMode="decimal" placeholder="500" />
            {runs.length ? (
              <div className="zt-num" style={{ fontSize: 12.5, color: 'var(--text-secondary)', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)', padding: '9px 12px' }}>
                Next: <strong style={{ color: 'var(--accent)' }}>{labelDate(runs[0])}</strong>{runs[1] ? `, then ${labelDate(runs[1])}, ${labelDate(runs[2])}…` : ''}
              </div>
            ) : null}
          </>
        ) : (
          <div>
            <div className="zt-eyebrow" style={{ marginBottom: 7 }}>Amount</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <SegmentedControl options={['%', 'Fixed', 'Remainder']} value={method} onChange={setMethod} />
              {needsValue ? (
                <TextInput value={value} onChange={setValue} prefix={method === '%' ? undefined : '$'} type="number" inputMode="decimal" placeholder={method === '%' ? '15' : '500'} style={{ flex: 1 }} />
              ) : (
                <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-tertiary)', paddingBottom: 10 }}>Sweeps whatever is left over.</span>
              )}
            </div>
          </div>
        )}

        <Select label="For (optional)" value={memberId} onChange={setMemberId} placeholder="Household"
          options={[{ value: '', label: 'Household' }, ...members.map((m) => ({ value: m.id, label: m.name }))]} />

        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 13.5, color: 'var(--text-secondary)' }}>
          Rule enabled
          <Toggle checked={enabled} onChange={setEnabled} size="sm" />
        </label>
        {scheduled ? (
          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            We'll add this to your transfer checklist each cycle and remind you. It's checked off automatically once your bank moves the money.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

function ZHQAllocations() {
  const { Card, Icon, Button, IconButton, Badge, EmptyState } = window.ZittingHQDesignSystem_c9e528;
  const API = window.ZHQ_API || {};
  const D = window.ZHQ_DATA;
  const rules = D.rules || [];
  const [amount, setAmount] = React.useState(4000);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(null);

  // compute the waterfall split in priority order (on-income rules only)
  const activeRules = rules.filter((r) => r.enabled !== false && r.trigger !== 'manual');
  const split = React.useMemo(() => {
    let remaining = amount;
    const rows = activeRules.map((r) => {
      let amt = 0;
      if (r.method === '%') amt = amount * ((r.value || 0) / 100);
      else if (r.method === 'Fixed') amt = r.value || 0;
      else amt = Math.max(0, remaining);
      amt = Math.min(amt, Math.max(0, remaining));
      remaining -= amt;
      return { ...r, amt };
    });
    return { rows, remaining };
  }, [amount, rules]);

  const fmt = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (r) => { setEditing(r); setModalOpen(true); };
  async function remove(r) {
    if (!API.deleteAllocationRule) return;
    if (typeof window !== 'undefined' && !window.confirm(`Delete the "${r.name}" rule?`)) return;
    await API.deleteAllocationRule(r.id);
    window.ZHQ_REFRESH && window.ZHQ_REFRESH();
  }
  const [running, setRunning] = React.useState(false);
  const hasScheduled = rules.some((r) => r.trigger === 'scheduled');
  async function runScheduledNow() {
    if (!API.runScheduledTransfersNow) return;
    setRunning(true);
    try { await API.runScheduledTransfersNow(); window.ZHQ_REFRESH && window.ZHQ_REFRESH(); }
    finally { setRunning(false); }
  }

  const modal = <ZHQAllocRuleModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />;

  if (!rules.length) {
    return (
      <>
        <EmptyState icon="allocations" title="Give every dollar a job"
          body="Allocation rules pre-split incoming income across tithing, bills, savings, and allowances — and generate the transfer checklist automatically when income arrives."
          actionLabel="New rule" onAction={openAdd} />
        {modal}
      </>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}>
      {/* Rule list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div className="zt-eyebrow" style={{ marginBottom: 7 }}>Priority order · top to bottom</div>
            <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>How income gets split</h2>
          </div>
          <span style={{ display: 'inline-flex', gap: 8 }}>
            {hasScheduled ? <Button variant="ghost" size="sm" iconLeft={<Icon name="transfers" size={15} />} onClick={runScheduledNow} disabled={running}>Run scheduled now</Button> : null}
            <Button variant="secondary" size="sm" iconLeft={<Icon name="plus" size={15} />} onClick={openAdd}>New rule</Button>
          </span>
        </div>

        {rules.map((r, i) => (
          <Card key={r.id} padding={16} bordered>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ width: 22, height: 22, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: 'var(--surface-raised)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }} className="zt-num">{i + 1}</span>
              <span style={{ width: 36, height: 36, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}>
                <Icon name={r.icon || 'transfers'} size={17} />
              </span>

              <div style={{ minWidth: 120, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</span>
                  {r.enabled === false ? <Badge tone="neutral" size="sm">Off</Badge> : null}
                  {r.trigger === 'manual' ? <Badge tone="neutral" size="sm">Manual</Badge> : null}
                  {r.trigger === 'scheduled' ? <Badge tone="accent" size="sm">Scheduled</Badge> : null}
                  {r.member ? <Badge tone="accent" size="sm">{r.member}</Badge> : null}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  {r.from || 'From account'} <Icon name="arrowRight" size={12} /> {r.dest || 'To account'}
                  {r.trigger === 'scheduled' && r.nextRunLabel ? <span style={{ color: 'var(--accent)' }}>· {r.nextRunLabel}</span> : null}
                </div>
              </div>

              <div style={{ width: 92, flex: 'none', textAlign: 'right' }}>
                {r.method === 'Remainder'
                  ? <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Remainder</span>
                  : <span className="zt-num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{r.method === '%' ? r.value + '%' : '$' + r.value}</span>}
              </div>
              <span style={{ display: 'inline-flex', gap: 2, flex: 'none' }}>
                <IconButton icon="pencil" size="sm" label="Edit rule" onClick={() => openEdit(r)} />
                <IconButton icon="x" size="sm" label="Delete rule" onClick={() => remove(r)} />
              </span>
            </div>
          </Card>
        ))}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-tertiary)', fontSize: 12.5, padding: '2px 4px' }}>
          <Icon name="allocations" size={15} /> Rules run top-to-bottom — each takes its cut before the next. Remainder sweeps what's left.
        </div>
      </div>

      {/* Sticky live preview */}
      <div style={{ position: 'sticky', top: 0 }}>
        <Card padding={20} style={{ boxShadow: 'var(--shadow-lg)' }}>
          <div className="zt-eyebrow" style={{ marginBottom: 12 }}>Live preview</div>
          <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 8 }}>If this income arrives →</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface-sunken)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-sm)', marginBottom: 16 }}>
            <span style={{ fontSize: 20, color: 'var(--text-tertiary)' }}>$</span>
            <input type="text" inputMode="numeric" value={amount.toLocaleString('en-US')}
              onChange={(e) => { const v = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10); setAmount(isNaN(v) ? 0 : v); }}
              className="zt-num"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', width: '100%' }} />
            <span style={{ display: 'flex', gap: 4 }}>
              {[2000, 4000, 6000].map((v) => (
                <button key={v} onClick={() => setAmount(v)} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: amount === v ? 'var(--text-on-accent)' : 'var(--text-secondary)', background: amount === v ? 'var(--accent)' : 'var(--surface-raised)', border: 'none', borderRadius: 999, padding: '3px 7px', cursor: 'pointer' }}>{v / 1000}k</button>
              ))}
            </span>
          </div>

          {split.rows.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {split.rows.map((r) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border-hairline)' }}>
                  <Icon name={r.icon || 'transfers'} size={15} style={{ color: 'var(--text-tertiary)' }} />
                  <span style={{ flex: 1, fontSize: 13.5, color: 'var(--text-primary)' }}>{r.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{r.method === '%' ? r.value + '%' : r.method === 'Remainder' ? 'rem' : 'fixed'}</span>
                  <span className="zt-num" style={{ fontSize: 14, fontWeight: 600, color: r.amt > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)', width: 86, textAlign: 'right' }}>{fmt(r.amt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '8px 0' }}>No on-income rules yet.</div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: split.remaining === 0 ? 'var(--green-tint)' : 'var(--amber-tint)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 600, color: split.remaining === 0 ? 'var(--accent)' : 'var(--warning)' }}>
              <Icon name={split.remaining === 0 ? 'check' : 'alert'} size={16} />
              {split.remaining === 0 ? 'Fully allocated' : 'Unallocated'}
            </span>
            <span className="zt-num" style={{ fontSize: 15, fontWeight: 600, color: split.remaining === 0 ? 'var(--accent)' : 'var(--warning)' }}>{fmt(split.remaining)}</span>
          </div>
        </Card>
      </div>

      {modal}
    </div>
  );
}

Object.assign(window, { ZHQAllocations });
