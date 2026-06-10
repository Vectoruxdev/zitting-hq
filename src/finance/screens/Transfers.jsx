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
  const [method, setMethod] = React.useState('Fixed'); // income: Fixed | %
  const [incomeMatch, setIncomeMatch] = React.useState('');
  const [name, setName] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setFreq('once'); setFromId(''); setToId(''); setMemberId(''); setAmount(''); setDate('');
    setCadence('monthly'); setMethod('Fixed'); setIncomeMatch(''); setName(''); setBusy(false);
  }, [open]);

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
        await API.createAllocationRule({ name: name.trim() || autoName, method: 'Fixed', value: amt, fromAccountId: fromId || null, toAccountId: toId, memberId: memberId || null, trigger: 'scheduled', cadence, anchorDate: date || null, enabled: true });
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
    ? "Set a future planned date to schedule it — it waits on your checklist and checks off automatically once the transfer posts."
    : freq === 'repeat'
    ? `This creates a recurring transfer. We'll add it to your checklist ${cadence === 'yearly' ? 'each year' : cadence === 'quarterly' ? 'each quarter' : cadence === 'weekly' ? 'each week' : cadence === 'biweekly' ? 'every 2 weeks' : 'each ' + (cadence === 'semimonthly' ? 'payday (1st & 15th)' : 'month')}, starting from the date you choose.`
    : "This creates a rule: whenever income arrives, the amount (or %) is queued as a transfer to make. Manage it later under Allocations.";

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

        {/* amount / % + mode-specific fields */}
        {freq === 'income' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <Select label="Amount type" value={method} onChange={setMethod} options={[{ value: 'Fixed', label: 'Fixed amount' }, { value: '%', label: '% of income' }]} />
            <TextInput label={method === '%' ? 'Percent' : 'Amount'} value={amount} onChange={setAmount} prefix={method === '%' ? '' : '$'} type="number" inputMode="decimal" placeholder={method === '%' ? '15' : '500'} />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <TextInput label="Amount" value={amount} onChange={setAmount} prefix="$" type="number" inputMode="decimal" placeholder="500" />
            <TextInput label={freq === 'repeat' ? 'Start date' : 'Planned date'} value={date} onChange={setDate} type="date" />
          </div>
        )}

        {freq === 'repeat' ? (
          <Select label="Repeats" value={cadence} onChange={setCadence} options={CADENCE_OPTS} />
        ) : null}

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

function ZHQTransfers() {
  const { Card, Icon, Button, Tabs, ChecklistRow, EmptyState } = window.ZittingHQDesignSystem_c9e528;
  const API = window.ZHQ_API || {};
  const D = window.ZHQ_DATA;
  const upcoming = D.upcoming || [];
  const past = D.past || [];
  const [tab, setTab] = React.useState('upcoming');
  const [showAdd, setShowAdd] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

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

  const modal = <ZHQNewTransferModal open={showAdd} onClose={() => setShowAdd(false)} />;

  if (!upcoming.length && !past.length) {
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

      <Tabs options={[{ value: 'upcoming', label: 'Pending', badge: pendingCount || undefined }, { value: 'past', label: 'History' }]} value={tab} onChange={setTab} style={{ flex: 1 }} />

      {tab === 'upcoming' ? (
        upcoming.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Tap the circle as you move each one — or it auto-checks when the transfer shows up in an import.</span>
              <Button variant="accent" size="sm" iconLeft={<Icon name="check" size={15} />} onClick={markAll} disabled={busy}>Mark all sent</Button>
            </div>
            {upcoming.map((t) => (
              <ChecklistRow key={t.id} to={t.to} from={t.from} amount={t.amount} due={t.due} icon={t.icon}
                state={t.state === 'auto' ? 'auto' : 'todo'}
                onToggle={() => mark(t, true)} />
            ))}
          </div>
        ) : (
          <EmptyState icon="check" title="Nothing pending" body="Every transfer is done. New ones appear here when income arrives." />
        )
      ) : (
        past.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Completed and detected transfers, newest first.</span>
            {past.map((t) => (
              <ChecklistRow key={t.id} to={t.to} from={t.from} amount={t.amount} due={t.due} icon={t.icon}
                state={t.state === 'auto' ? 'auto' : 'done'}
                onToggle={t.detected || typeof t.id !== 'number' ? undefined : () => mark(t, false)} />
            ))}
          </div>
        ) : (
          <EmptyState icon="transfers" title="No history yet" body="Completed transfers show up here." />
        )
      )}

      {modal}
    </div>
  );
}

Object.assign(window, { ZHQTransfers });
