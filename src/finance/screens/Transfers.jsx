import React from 'react';
/* Transfers — pending checklist (mark done / auto-completed from imports) +
 * full history. Pending items are generated from allocation rules when income
 * arrives, or added manually. */

function ZHQNewTransferModal({ open, onClose }) {
  const { Modal, Select, TextInput, Button } = window.ZittingHQDesignSystem_c9e528;
  const API = window.ZHQ_API || {};
  const D = window.ZHQ_DATA;
  const accounts = D.accountsFlat || [];
  const members = D.members || [];
  const [fromId, setFromId] = React.useState('');
  const [toId, setToId] = React.useState('');
  const [memberId, setMemberId] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [date, setDate] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setFromId(''); setToId(''); setMemberId(''); setAmount(''); setDate(''); setBusy(false);
  }, [open]);

  const amt = parseFloat(amount);
  const valid = toId && Number.isFinite(amt) && amt > 0 && toId !== fromId;

  async function save() {
    if (!valid || !API.createManualTransfer) return;
    setBusy(true);
    try {
      await API.createManualTransfer({
        fromAccountId: fromId || null,
        toAccountId: toId,
        memberId: memberId || null,
        amount: amt,
        plannedDate: date || null,
      });
      window.ZHQ_REFRESH && window.ZHQ_REFRESH();
      onClose();
    } finally { setBusy(false); }
  }

  const acctOpts = accounts.map((a) => ({ value: a.id, label: a.label }));

  return (
    <Modal open={open} onClose={onClose} title="New transfer" width={440}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={busy || !valid}>Add transfer</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <Select label="From account" value={fromId} onChange={setFromId} placeholder="Choose account" options={acctOpts} />
          <Select label="To account" value={toId} onChange={setToId} placeholder="Choose account" options={acctOpts} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <TextInput label="Amount" value={amount} onChange={setAmount} prefix="$" type="number" inputMode="decimal" placeholder="500" />
          <TextInput label="Planned date" value={date} onChange={setDate} type="date" />
        </div>
        <Select label="For (optional)" value={memberId} onChange={setMemberId} placeholder="Household"
          options={[{ value: '', label: 'Household' }, ...members.map((m) => ({ value: m.id, label: m.name }))]} />
        <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>Set a future planned date to schedule it — it'll wait on your checklist and check off automatically once the transfer posts.</span>
        {toId && toId === fromId ? <span style={{ fontSize: 12, color: 'var(--negative)' }}>From and To must differ.</span> : null}
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
          <div style={{ flex: 1, minWidth: 220 }}>
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
