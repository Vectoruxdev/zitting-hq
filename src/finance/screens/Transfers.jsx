import React from 'react';
/* Transfers — pending checklist (mark done / auto-completed from imports) +
 * full history. Pending items are generated from allocation rules when income
 * arrives, or added manually. */

const CADENCE_OPTS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'semimonthly', label: 'Twice a month (1st & 15th)' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

function ZHQNewTransferModal({ open, onClose }) {
  const { Modal, Select, TextInput, Button } = window.ZittingHQDesignSystem_c9e528;
  const API = window.ZHQ_API || {};
  const D = window.ZHQ_DATA;
  const accounts = D.accountsFlat || [];
  const members = D.members || [];
  const [freq, setFreq] = React.useState('once'); // once | repeat | income
  const [fromId, setFromId] = React.useState('');
  const [toId, setToId] = React.useState('');
  const [memberId, setMemberId] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [date, setDate] = React.useState('');
  const [cadence, setCadence] = React.useState('monthly');
  const [dayOfMonth, setDayOfMonth] = React.useState('1'); // for monthly/quarterly/yearly
  const [method, setMethod] = React.useState('Fixed'); // income: Fixed | %
  const [incomeMatch, setIncomeMatch] = React.useState('');
  const [name, setName] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setFreq('once'); setFromId(''); setToId(''); setMemberId(''); setAmount(''); setDate('');
    setCadence('monthly'); setDayOfMonth('1'); setMethod('Fixed'); setIncomeMatch(''); setName(''); setBusy(false);
  }, [open]);

  const monthlyLike = ['monthly', 'quarterly', 'yearly'].includes(cadence);
  // Build the schedule anchor: monthly-family uses the chosen day-of-month (in
  // the current month, clamped); weekly/biweekly uses the chosen start date.
  function repeatAnchor() {
    if (monthlyLike) {
      const now = new Date();
      const y = now.getFullYear(), m = now.getMonth();
      const last = new Date(y, m + 1, 0).getDate();
      const day = Math.min(Math.max(parseInt(dayOfMonth, 10) || 1, 1), last);
      return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return date || null; // weekly/biweekly: start date sets the weekday; semimonthly ignores
  }

  const amt = parseFloat(amount);
  const amtValid = Number.isFinite(amt) && amt > 0 && (method !== '%' || amt <= 100);
  const baseValid = toId && toId !== fromId;
  const valid = baseValid && amtValid;

  const toLabel = accounts.find((a) => a.id === toId)?.label;
  const autoName = toLabel ? `To ${toLabel}` : 'Transfer';

  async function save() {
    if (!valid) return;
    setBusy(true);
    try {
      if (freq === 'once') {
        if (!API.createManualTransfer) return;
        await API.createManualTransfer({ fromAccountId: fromId || null, toAccountId: toId, memberId: memberId || null, amount: amt, plannedDate: date || null });
      } else if (freq === 'repeat') {
        if (!API.createAllocationRule) return;
        await API.createAllocationRule({ name: name.trim() || autoName, method: 'Fixed', value: amt, fromAccountId: fromId || null, toAccountId: toId, memberId: memberId || null, trigger: 'scheduled', cadence, anchorDate: repeatAnchor(), enabled: true });
      } else {
        if (!API.createAllocationRule) return;
        await API.createAllocationRule({ name: name.trim() || autoName, method, value: amt, fromAccountId: fromId || null, toAccountId: toId, memberId: memberId || null, trigger: 'on_income', incomeMatch: incomeMatch.trim() || null, enabled: true });
      }
      window.ZHQ_REFRESH && window.ZHQ_REFRESH();
      onClose();
    } finally { setBusy(false); }
  }

  const acctOpts = accounts.map((a) => ({ value: a.id, label: a.label }));
  const freqOpts = [
    { k: 'once', label: 'One time' },
    { k: 'repeat', label: 'Repeat' },
    { k: 'income', label: 'On income' },
  ];
  const saveLabel = freq === 'once' ? 'Add transfer' : freq === 'repeat' ? 'Create recurring transfer' : 'Create income rule';
  const help = freq === 'once'
    ? "A future date stays off your checklist until that day, then appears and reminds you — and checks off automatically once the transfer posts."
    : freq === 'repeat'
    ? `Recurring ${monthlyLike ? `on day ${dayOfMonth || '1'} ${cadence === 'monthly' ? 'each month' : cadence === 'quarterly' ? 'each quarter' : 'each year'}` : cadence === 'semimonthly' ? 'on the 1st & 15th' : cadence === 'weekly' ? 'each week' : 'every 2 weeks'}. Each one appears on your checklist when it's due.`
    : "A rule: whenever income arrives, the amount (or %) is queued as a transfer to make. Manage it later under Allocations.";

  return (
    <Modal open={open} onClose={onClose} title="New transfer" width={460}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={busy || !valid}>{saveLabel}</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* frequency selector */}
        <div>
          <span className="zt-eyebrow" style={{ display: 'block', marginBottom: 6 }}>How often</span>
          <div style={{ display: 'flex', gap: 6, padding: 4, background: 'var(--surface-sunken)', borderRadius: 999 }}>
            {freqOpts.map((o) => (
              <button key={o.k} onClick={() => setFreq(o.k)} style={{ flex: 1, padding: '9px 0', borderRadius: 999, border: 'none', cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 600, background: freq === o.k ? 'var(--surface-card)' : 'transparent', color: freq === o.k ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{o.label}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <Select label="From account" value={fromId} onChange={setFromId} placeholder="Choose account" options={acctOpts} />
          <Select label="To account" value={toId} onChange={setToId} placeholder="Choose account" options={acctOpts} />
        </div>

        {/* amount / % + when */}
        {freq === 'income' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <Select label="Amount type" value={method} onChange={setMethod} options={[{ value: 'Fixed', label: 'Fixed amount' }, { value: '%', label: '% of income' }]} />
            <TextInput label={method === '%' ? 'Percent' : 'Amount'} value={amount} onChange={setAmount} prefix={method === '%' ? '' : '$'} type="number" inputMode="decimal" placeholder={method === '%' ? '15' : '500'} />
          </div>
        ) : (
          <>
            {freq === 'repeat' ? (
              <Select label="Repeats" value={cadence} onChange={setCadence} options={CADENCE_OPTS} />
            ) : null}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <TextInput label="Amount" value={amount} onChange={setAmount} prefix="$" type="number" inputMode="decimal" placeholder="500" />
              {freq === 'once' ? (
                <TextInput label="Planned date" value={date} onChange={setDate} type="date" />
              ) : monthlyLike ? (
                <TextInput label="On day (1–31)" value={dayOfMonth} onChange={setDayOfMonth} type="number" inputMode="numeric" placeholder="1" />
              ) : cadence === 'semimonthly' ? (
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 11, fontSize: 12.5, color: 'var(--text-tertiary)' }}>On the 1st &amp; 15th</div>
              ) : (
                <TextInput label="Start date" value={date} onChange={setDate} type="date" />
              )}
            </div>
          </>
        )}

        <Select label="For (optional)" value={memberId} onChange={setMemberId} placeholder="Household"
          options={[{ value: '', label: 'Household' }, ...members.map((m) => ({ value: m.id, label: m.name }))]} />

        {freq === 'income' ? (
          <TextInput label="Only for income matching (optional)" value={incomeMatch} onChange={setIncomeMatch} placeholder="e.g. paycheck, ADP — leave blank for any income" />
        ) : null}

        {freq !== 'once' ? (
          <TextInput label="Name (optional)" value={name} onChange={setName} placeholder={autoName} />
        ) : null}

        <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{help}</span>
        {toId && toId === fromId ? <span style={{ fontSize: 12, color: 'var(--negative)' }}>From and To must differ.</span> : null}
        {freq === 'income' && method === '%' && Number.isFinite(amt) && amt > 100 ? <span style={{ fontSize: 12, color: 'var(--negative)' }}>Percent can't exceed 100.</span> : null}
      </div>
    </Modal>
  );
}

function ZHQExpectedIncomeModal({ open, onClose, prefill }) {
  const { Modal, TextInput, Select, Button } = window.ZittingHQDesignSystem_c9e528;
  const API = window.ZHQ_API || {};
  const D = window.ZHQ_DATA || {};
  const accts = (D.accountsFlat || []).map((a) => ({ value: a.id, label: a.label || a.name }));
  const [label, setLabel] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [date, setDate] = React.useState('');
  const [acct, setAcct] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (!open) return;
    setLabel(prefill?.name || '');
    setAmount(prefill?.amount != null ? String(prefill.amount) : '');
    setDate(prefill?.dateISO || '');
    setAcct(prefill?.accountId || '');
  }, [open, prefill]);
  const numv = parseFloat(String(amount).replace(/[^0-9.-]/g, ''));
  const valid = label.trim() && !isNaN(numv) && numv > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date);
  async function save() {
    if (!valid || !API.addExpectedIncome) return;
    setBusy(true);
    try {
      await API.addExpectedIncome({ label: label.trim(), amount: numv, expectedDate: date, sourceKey: prefill?.sourceKey || null, accountId: acct || null });
      window.ZHQ_REFRESH && window.ZHQ_REFRESH();
      onClose();
    } finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title={prefill?.sourceKey ? 'Adjust expected paycheck' : 'Add expected income'} width={420}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={busy || !valid}>Save</Button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <TextInput label="Label" value={label} onChange={setLabel} placeholder="Paycheck, bonus…" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <TextInput label="Amount" value={amount} onChange={setAmount} inputMode="decimal" prefix="$" placeholder="2,950" />
          <TextInput label="Expected date" value={date} onChange={setDate} type="date" />
        </div>
        <Select label="Deposits into (optional)" value={acct} onChange={setAcct} options={[{ value: '', label: 'Any account' }, ...accts]} />
        {prefill?.sourceKey ? <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>This overrides the auto-estimate for this paycheck.</p> : null}
      </div>
    </Modal>
  );
}

function ZHQCoverageCard({ R, onAdd, onAdjust, onDelete, busy }) {
  const { Card, Icon, Button } = window.ZittingHQDesignSystem_c9e528;
  if (!R) return null;
  const tone = R.verdict === 'covered' ? 'positive' : R.verdict === 'short' ? 'negative' : 'warning';
  const border = R.verdict === 'covered' ? 'var(--green-tint)' : R.verdict === 'short' ? 'var(--negative)' : 'var(--warning)';
  const icon = R.verdict === 'covered' ? 'check' : R.verdict === 'short' ? 'alert' : 'clock';
  const shorts = (R.bySource || []).filter((s) => s.short > 0);
  const Tile = ({ label, value, color }) => (
    <div style={{ flex: 1, minWidth: 92 }}>
      <div className="zt-eyebrow" style={{ marginBottom: 4 }}>{label}</div>
      <div className="zt-num" style={{ fontSize: 22, fontWeight: 600, color: color || 'var(--text-primary)' }}>{value}</div>
    </div>
  );
  return (
    <Card padding={20} style={{ border: `1px solid ${border}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16 }}>
        <Icon name={icon} size={18} style={{ color: `var(--${tone})`, flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>{R.message}</span>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Tile label="To move" value={R.upcomingTotalLabel} />
        <Tile label="Cash on hand" value={R.cashLabel} />
        <Tile label="Gap" value={R.gap > 0 ? R.gapLabel : '$0'} color={R.gap > 0 ? 'var(--negative)' : 'var(--accent)'} />
      </div>
      {shorts.length ? (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 12 }}>
          {shorts.map((s) => <div key={s.accountId} style={{ marginTop: 2 }}>Short {s.shortLabel} in {s.name}</div>)}
        </div>
      ) : null}
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-hairline)' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <span className="zt-eyebrow">Expected income</span>
          <span style={{ flex: 1 }} />
          <Button variant="ghost" size="sm" iconLeft={<Icon name="plus" size={13} />} onClick={onAdd}>Add</Button>
        </div>
        {(R.forecast || []).length ? R.forecast.map((f, i) => (
          <div key={(f.id || f.key || 'f') + i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{f.dateLabel}{f.source === 'auto' ? ` · ${f.confidence} confidence` : f.source === 'override' ? ' · adjusted' : ' · expected'}</div>
            </div>
            <span className="zt-num" style={{ fontSize: 14, fontWeight: 600, color: 'var(--positive)' }}>{f.amountLabel}</span>
            {f.source === 'auto' ? (
              <button onClick={() => onAdjust(f)} title="Adjust this estimate" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', minWidth: 28 }}><Icon name="pencil" size={14} /></button>
            ) : (
              <button onClick={() => onDelete(f)} disabled={busy} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', minWidth: 28 }}><Icon name="x" size={14} /></button>
            )}
          </div>
        )) : (
          <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            {(R.registrySources ?? 0) === 0
              ? 'No income sources are marked yet, so there’s nothing to forecast. Mark your paychecks as income sources on the Income tab (or add an expected paycheck here).'
              : 'No upcoming income detected yet — add an expected paycheck.'}
          </div>
        )}
      </div>
    </Card>
  );
}

function ZHQTransfers() {
  const { Card, Icon, Button, Tabs, ChecklistRow, EmptyState } = window.ZittingHQDesignSystem_c9e528;
  const API = window.ZHQ_API || {};
  const D = window.ZHQ_DATA;
  const upcoming = D.upcoming || [];
  const scheduled = D.scheduledTransfers || [];
  const scheduledCount = D.scheduledCount ?? scheduled.length;
  const past = D.past || [];
  const [tab, setTab] = React.useState('upcoming');
  const [showAdd, setShowAdd] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [confirmRepeat, setConfirmRepeat] = React.useState(null); // instance id pending "repeat monthly" confirm
  const [expModal, setExpModal] = React.useState(null); // null | { prefill }
  const readiness = D.transferReadiness || null;

  const pendingCount = D.transfersPending ?? upcoming.length;
  const pendingTotal = D.transfersPendingTotal ?? '$0';

  // Most recent genuine income — lets us regenerate the checklist on demand.
  const incomeTxns = (D.txns || []).filter((t) => t.income && !t.isTransfer);
  const lastIncome = incomeTxns[incomeTxns.length - 1];

  const refresh = () => window.ZHQ_REFRESH && window.ZHQ_REFRESH();

  async function mark(t, done) {
    if (typeof t.id !== 'number' || !API.markTransferInstance) return;
    setBusy(true);
    try { await API.markTransferInstance(t.id, done); refresh(); } finally { setBusy(false); }
  }
  async function markAll() {
    if (!API.markTransferInstance) return;
    setBusy(true);
    try {
      for (const t of upcoming) if (typeof t.id === 'number') await API.markTransferInstance(t.id, true);
      refresh();
    } finally { setBusy(false); }
  }
  async function generate() {
    if (!lastIncome || !API.generateTransfersForIncome) return;
    setBusy(true);
    try { await API.generateTransfersForIncome(lastIncome.id); refresh(); } finally { setBusy(false); }
  }
  async function cancel(t) {
    if (typeof t.id !== 'number' || !API.deleteTransferInstance) return;
    setBusy(true);
    try { await API.deleteTransferInstance(t.id); refresh(); } finally { setBusy(false); }
  }
  async function repeatMonthly(t) {
    if (typeof t.id !== 'number' || !API.makeTransferRecurring) return;
    setBusy(true);
    try { await API.makeTransferRecurring(t.id); setConfirmRepeat(null); refresh(); } finally { setBusy(false); }
  }
  async function deleteExpected(f) {
    if (!f.id || !API.deleteExpectedIncome) return;
    setBusy(true);
    try { await API.deleteExpectedIncome(f.id); refresh(); } finally { setBusy(false); }
  }
  const adjustForecast = (f) => setExpModal({ prefill: { name: f.name, amount: f.amount, dateISO: f.dateISO, accountId: f.accountId, sourceKey: f.key } });

  const modal = <ZHQNewTransferModal open={showAdd} onClose={() => setShowAdd(false)} />;
  const expIncomeModal = <ZHQExpectedIncomeModal open={!!expModal} onClose={() => setExpModal(null)} prefill={expModal?.prefill} />;
  const coverageCard = <ZHQCoverageCard R={readiness} busy={busy} onAdd={() => setExpModal({ prefill: null })} onAdjust={adjustForecast} onDelete={deleteExpected} />;

  if (!upcoming.length && !scheduled.length && !past.length) {
    return (
      <>
        <EmptyState icon="transfers" title="No transfers yet"
          body="When income arrives, your allocation rules generate a checklist of transfers to move money to tithing, bills, savings, and allowances. You can also add a transfer manually."
          actionLabel="New transfer" onAction={() => setShowAdd(true)}
          secondaryLabel={lastIncome ? 'Generate from last income' : undefined} onSecondary={generate} />
        {modal}
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Coverage cockpit — cash vs. due-soon transfers + paycheck forecast */}
      {coverageCard}

      {/* Pending banner */}
      <Card padding={24}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <span style={{ width: 46, height: 46, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)', background: pendingCount ? 'var(--green-tint)' : 'var(--surface-raised)', color: pendingCount ? 'var(--accent)' : 'var(--text-tertiary)' }}>
            <Icon name="transfers" size={24} />
          </span>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div className="zt-eyebrow" style={{ marginBottom: 6 }}>{pendingCount ? 'Transfers to make' : 'All caught up'}</div>
            <div className="zt-num" style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              {pendingCount ? <>{pendingCount} pending · <span style={{ color: 'var(--accent)' }}>{pendingTotal}</span> to move</> : 'No transfers pending'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flex: 'none' }}>
            {lastIncome ? <Button variant="secondary" size="sm" iconLeft={<Icon name="repeat" size={15} />} onClick={generate} disabled={busy}>Generate from income</Button> : null}
            <Button variant="primary" size="sm" iconLeft={<Icon name="plus" size={15} />} onClick={() => setShowAdd(true)}>New transfer</Button>
          </div>
        </div>
      </Card>

      <Tabs options={[{ value: 'upcoming', label: 'Pending', badge: pendingCount || undefined }, { value: 'scheduled', label: 'Scheduled', badge: scheduledCount || undefined }, { value: 'past', label: 'History' }]} value={tab} onChange={setTab} style={{ flex: 1 }} />

      {tab === 'upcoming' ? (
        upcoming.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Tap the circle as you move each one — or it auto-checks when the transfer shows up in an import.</span>
              <Button variant="accent" size="sm" iconLeft={<Icon name="check" size={15} />} onClick={markAll} disabled={busy}>Mark all sent</Button>
            </div>
            {upcoming.map((t, i) => (
              <div key={t.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <ChecklistRow to={t.to} from={t.from} amount={t.amount} due={t.due} icon={t.icon}
                    state={t.state === 'auto' ? 'auto' : 'todo'}
                    onToggle={() => mark(t, true)} />
                </div>
                {typeof t.id === 'number' && !t.ruleId && API.makeTransferRecurring ? (
                  confirmRepeat === t.id ? (
                    <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Button variant="primary" size="sm" disabled={busy} onClick={() => repeatMonthly(t)}>Repeat monthly</Button>
                      <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmRepeat(null)}>Cancel</Button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmRepeat(t.id)} disabled={busy} title="Make this a recurring monthly transfer" style={{ flex: 'none', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 40, minHeight: 40 }}><Icon name="repeat" size={16} /></button>
                  )
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon="check" title="Nothing pending" body="Every transfer is done. New ones appear here when income arrives." />
        )
      ) : tab === 'scheduled' ? (
        scheduled.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Set for a future date. Each moves to your Pending list and reminds you on its day. You can move one early or cancel it.</span>
            {scheduled.map((t, i) => (
              <div key={t.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <ChecklistRow to={t.to} from={t.from} amount={t.amount} due={t.due} icon={t.icon} state="todo" onToggle={() => mark(t, true)} />
                </div>
                {typeof t.id === 'number' && API.deleteTransferInstance ? (
                  <button onClick={() => cancel(t)} disabled={busy} title="Cancel this scheduled transfer" style={{ flex: 'none', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 40, minHeight: 40 }}><Icon name="x" size={16} /></button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon="calendar" title="Nothing scheduled" body="Add a transfer with a future date or a repeating schedule and it'll wait here until it's due." />
        )
      ) : (
        past.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Completed and detected transfers, newest first.</span>
            {past.map((t, i) => (
              <ChecklistRow key={t.id ?? i} to={t.to} from={t.from} amount={t.amount} due={t.due} icon={t.icon}
                state={t.state === 'auto' ? 'auto' : 'done'}
                onToggle={t.detected || typeof t.id !== 'number' ? undefined : () => mark(t, false)} />
            ))}
          </div>
        ) : (
          <EmptyState icon="transfers" title="No history yet" body="Completed transfers show up here." />
        )
      )}

      {modal}
      {expIncomeModal}
    </div>
  );
}

Object.assign(window, { ZHQTransfers });
