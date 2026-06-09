import React from 'react';
/*
 * Savings — goals funded by a contribution ledger. Goals can be shared with the
 * whole household or kept private to specific members (owners always see all;
 * the server filters private goals out for everyone else). Each goal shows a
 * progress ring, an On-track / Ahead / At-risk status from its target date +
 * monthly contribution, and supports add-money / manage (history) flows.
 *
 * All writes go through window.ZHQ_API (owner-gated server actions); the screen
 * re-reads via window.ZHQ_REFRESH after each change.
 */

const GOAL_TYPES = [
  { value: 'emergency', label: 'Emergency fund', icon: '🛟', color: 'var(--accent)' },
  { value: 'vacation', label: 'Vacation / trip', icon: '🌴', color: 'var(--indigo-500)' },
  { value: 'home', label: 'Home', icon: '🏠', color: 'var(--green-500)' },
  { value: 'car', label: 'Car / vehicle', icon: '🚗', color: 'var(--amber-500)' },
  { value: 'sinking', label: 'Sinking fund', icon: '🧾', color: 'var(--green-600)' },
  { value: 'custom', label: 'Custom', icon: '🎯', color: 'var(--accent)' },
];
const typePreset = (t) => GOAL_TYPES.find((g) => g.value === t) || GOAL_TYPES[5];

const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
const todayISO = () => new Date().toISOString().slice(0, 10);

// Mirror of src/db/savings.ts projection math, for live form previews.
function monthsUntil(iso) {
  if (!iso) return null;
  const t = new Date(iso + 'T00:00:00');
  if (isNaN(t.getTime())) return null;
  const now = new Date();
  const base = (t.getFullYear() - now.getFullYear()) * 12 + (t.getMonth() - now.getMonth());
  const extra = t.getDate() > now.getDate() ? 1 : 0;
  return Math.max(0, base + extra);
}
function requiredPerMonth(saved, target, iso) {
  const months = monthsUntil(iso);
  if (months == null) return null;
  const remaining = Math.max(0, (Number(target) || 0) - (Number(saved) || 0));
  return months > 0 ? Math.ceil(remaining / months) : remaining;
}

const STATUS = {
  complete: { tone: 'accent', label: 'Complete 🎉' },
  ahead: { tone: 'positive', label: 'Ahead' },
  'on-track': { tone: 'accent', label: 'On track' },
  'at-risk': { tone: 'warning', label: 'At risk' },
  none: { tone: 'neutral', label: null },
};

function ZHQGoalStatusBadge({ status }) {
  const { Badge } = window.ZittingHQDesignSystem_c9e528;
  const s = STATUS[status] || STATUS.none;
  if (!s.label) return null;
  return <Badge tone={s.tone} dot>{s.label}</Badge>;
}

function ZHQVisibilityChip({ g }) {
  const { Icon } = window.ZittingHQDesignSystem_c9e528;
  if (g.visibility !== 'private') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>
        <Icon name="users" size={13} /> Household
      </span>
    );
  }
  const names = (g.members || []).map((m) => m.name);
  const label = names.length ? names.join(', ') : 'Private';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>
      <Icon name="user" size={12} /> Private · {label}
    </span>
  );
}

function ZHQGoalCard({ g, onAddMoney, onManage }) {
  const { Card, Icon, Button } = window.ZittingHQDesignSystem_c9e528;
  const { DonutChart } = window.ZittingHQDesignSystem_c9e528;
  const pct = g.pct != null ? g.pct : (g.target ? Math.round((g.saved / g.target) * 100) : 0);
  const remaining = g.remaining != null ? g.remaining : Math.max(0, g.target - g.saved);
  const icon = g.icon || typePreset(g.goalType).icon;
  const color = g.color || 'var(--accent)';
  return (
    <Card padding={22} style={g.archived ? { opacity: 0.62 } : undefined}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ position: 'relative', flex: 'none' }}>
          <DonutChart size={92} thickness={9} gap={0}
            segments={[{ value: g.saved, color }, { value: Math.max(0, g.target - g.saved), color: 'var(--surface-raised)' }]}
            centervalue={<span style={{ fontSize: 17 }}>{pct}%</span>} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ fontSize: 18, flex: 'none' }}>{icon}</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
            </div>
            <ZHQGoalStatusBadge status={g.status} />
          </div>
          <div className="zt-num" style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
            {money(g.saved)} <span style={{ color: 'var(--text-tertiary)' }}>of {money(g.target)}</span>
            {remaining > 0 ? <span style={{ color: 'var(--text-tertiary)' }}> · {money(remaining)} to go</span> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 9, fontSize: 12, color: 'var(--text-tertiary)' }}>
            {g.date ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="calendar" size={13} /> {g.date}</span> : null}
            {g.account ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="bank" size={13} /> {g.account}</span> : null}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-hairline)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {g.autoContrib > 0 ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--text-secondary)' }}>
              <Icon name="allocations" size={14} style={{ color: 'var(--accent)' }} /> <span className="zt-num">{money(g.autoContrib)}/mo</span>
              {g.requiredPerMonth != null && g.status !== 'complete' ? <span style={{ color: 'var(--text-tertiary)' }}> · need {money(g.requiredPerMonth)}/mo</span> : null}
            </span>
          ) : (
            g.requiredPerMonth != null && g.status !== 'complete'
              ? <span className="zt-num" style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Save {money(g.requiredPerMonth)}/mo to hit your date</span>
              : <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>No monthly plan set</span>
          )}
          <ZHQVisibilityChip g={g} />
        </div>
        <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
          {!g.archived ? <Button variant="secondary" size="sm" iconLeft={<Icon name="plus" size={14} />} onClick={() => onAddMoney(g)}>Add money</Button> : null}
          <Button variant="ghost" size="sm" iconRight={<Icon name="chevronRight" size={14} />} onClick={() => onManage(g)}>Manage</Button>
        </div>
      </div>
    </Card>
  );
}

function ZHQMemberPicker({ members, selected, onToggle }) {
  const { Checkbox } = window.ZittingHQDesignSystem_c9e528;
  if (!members.length) {
    return <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Add people on the Access screen to share a private goal.</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
      {members.map((m) => (
        <Checkbox key={m.id} checked={selected.includes(m.id)} onChange={() => onToggle(m.id)} label={m.name} />
      ))}
    </div>
  );
}

function ZHQGoalModal({ open, onClose, editing }) {
  const { Modal, Select, TextInput, SegmentedControl, Button } = window.ZittingHQDesignSystem_c9e528;
  const API = window.ZHQ_API || {};
  const D = window.ZHQ_DATA || {};
  const members = D.members || [];
  const savingsAccounts = (D.accounts && D.accounts.savings) || [];

  const [name, setName] = React.useState('');
  const [goalType, setGoalType] = React.useState('custom');
  const [icon, setIcon] = React.useState('🎯');
  const [target, setTarget] = React.useState('');
  const [targetDate, setTargetDate] = React.useState('');
  const [accountId, setAccountId] = React.useState('');
  const [autoContrib, setAutoContrib] = React.useState('');
  const [visibility, setVisibility] = React.useState('household');
  const [memberIds, setMemberIds] = React.useState([]);
  const [initialSaved, setInitialSaved] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name || '');
      setGoalType(editing.goalType || 'custom');
      setIcon(editing.icon || typePreset(editing.goalType).icon);
      setTarget(String(editing.target ?? ''));
      setTargetDate(editing.targetDate || '');
      setAccountId(editing.accountId || '');
      setAutoContrib(String(editing.autoContrib ?? ''));
      setVisibility(editing.visibility || 'household');
      setMemberIds((editing.members || []).map((m) => m.id));
    } else {
      setName(''); setGoalType('custom'); setIcon('🎯'); setTarget(''); setTargetDate('');
      setAccountId(''); setAutoContrib(''); setVisibility('household'); setMemberIds([]); setInitialSaved('');
    }
    setBusy(false);
  }, [open, editing]);

  const onTypeChange = (t) => {
    setGoalType(t);
    const preset = typePreset(t);
    // Only auto-fill the emoji if it still matches the previous preset (don't stomp a custom one).
    setIcon((prev) => (GOAL_TYPES.some((g) => g.icon === prev) ? preset.icon : prev));
  };

  const targetNum = parseFloat(target);
  const valid = name.trim() && Number.isFinite(targetNum) && targetNum > 0 && (visibility !== 'private' || memberIds.length > 0);

  // Live "save $X/mo" preview.
  const savedForPreview = editing ? editing.saved : (parseFloat(initialSaved) || 0);
  const need = targetDate && Number.isFinite(targetNum) ? requiredPerMonth(savedForPreview, targetNum, targetDate) : null;

  async function save() {
    if (!valid) return;
    const payload = {
      name: name.trim(),
      target: targetNum,
      targetDate: targetDate || null,
      accountId: accountId || null,
      autoContrib: parseFloat(autoContrib) || 0,
      icon: icon || null,
      color: typePreset(goalType).color,
      goalType,
      visibility,
      memberIds: visibility === 'private' ? memberIds : [],
    };
    setBusy(true);
    try {
      if (editing && API.updateSavingsGoal) {
        await API.updateSavingsGoal(editing.id, payload);
      } else if (API.createSavingsGoal) {
        const init = parseFloat(initialSaved);
        await API.createSavingsGoal({ ...payload, initialSaved: Number.isFinite(init) && init > 0 ? init : undefined });
      }
      window.ZHQ_REFRESH && window.ZHQ_REFRESH();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const acctOpts = savingsAccounts.map((a) => ({ value: a.id, label: a.mask ? `${a.name} ••${a.mask}` : a.name }));

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit goal' : 'New savings goal'} width={480}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={busy || !valid}>{editing ? 'Save' : 'Create goal'}</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Select label="Type" value={goalType} onChange={onTypeChange} options={GOAL_TYPES.map((g) => ({ value: g.value, label: `${g.icon}  ${g.label}` }))} />
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <TextInput label="Emoji" value={icon} onChange={setIcon} placeholder="🎯" style={{ width: 76, flex: 'none' }} />
          <TextInput label="Goal name" value={name} onChange={setName} placeholder="e.g. Hawaii trip" style={{ flex: 1 }} />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <TextInput label="Target amount" value={target} onChange={setTarget} prefix="$" type="number" inputMode="decimal" placeholder="9,000" style={{ flex: 1 }} />
          <TextInput label="Target date" value={targetDate} onChange={setTargetDate} type="date" style={{ flex: 1 }} />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <TextInput label="Monthly contribution" value={autoContrib} onChange={setAutoContrib} prefix="$" type="number" inputMode="decimal" placeholder="400" style={{ flex: 1 }} />
          {!editing ? <TextInput label="Starting balance" value={initialSaved} onChange={setInitialSaved} prefix="$" type="number" inputMode="decimal" placeholder="0" style={{ flex: 1 }} /> : <span style={{ flex: 1 }} />}
        </div>
        {need != null ? (
          <div className="zt-num" style={{ fontSize: 12.5, color: 'var(--text-secondary)', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', padding: '9px 12px' }}>
            Save <strong style={{ color: 'var(--accent)' }}>{money(need)}/mo</strong> to reach {money(targetNum)} by then.
          </div>
        ) : null}
        {acctOpts.length ? (
          <Select label="Linked savings account (optional)" value={accountId} onChange={setAccountId} placeholder="None"
            options={[{ value: '', label: 'None' }, ...acctOpts]} />
        ) : null}
        <div>
          <div className="zt-eyebrow" style={{ marginBottom: 7 }}>Who can see this</div>
          <SegmentedControl full value={visibility} onChange={setVisibility}
            options={[{ value: 'household', label: 'Whole household' }, { value: 'private', label: 'Only certain people' }]} />
        </div>
        {visibility === 'private' ? (
          <div>
            <div className="zt-eyebrow" style={{ marginBottom: 5 }}>Members on this goal</div>
            <ZHQMemberPicker members={members} selected={memberIds} onToggle={(id) => setMemberIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])} />
            <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', margin: '6px 0 0' }}>Only these people (and account owners) will see this goal.</p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function ZHQAddMoneyModal({ open, onClose, goal }) {
  const { Modal, TextInput, Button } = window.ZittingHQDesignSystem_c9e528;
  const API = window.ZHQ_API || {};
  const [amount, setAmount] = React.useState('');
  const [date, setDate] = React.useState(todayISO());
  const [note, setNote] = React.useState('');
  const [withdraw, setWithdraw] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setAmount(''); setDate(todayISO()); setNote(''); setWithdraw(false); setBusy(false);
  }, [open, goal]);

  const amt = parseFloat(amount);
  const valid = Number.isFinite(amt) && amt > 0;

  async function save() {
    if (!valid || !goal || !API.addContribution) return;
    setBusy(true);
    try {
      await API.addContribution(goal.id, { amount: withdraw ? -Math.abs(amt) : Math.abs(amt), date, kind: 'manual', note: note || null });
      window.ZHQ_REFRESH && window.ZHQ_REFRESH();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={goal ? `${withdraw ? 'Withdraw from' : 'Add to'} ${goal.name}` : 'Add money'} width={420}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={busy || !valid}>{withdraw ? 'Withdraw' : 'Add money'}</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant={!withdraw ? 'primary' : 'secondary'} size="sm" onClick={() => setWithdraw(false)} style={{ flex: 1 }}>Deposit</Button>
          <Button variant={withdraw ? 'primary' : 'secondary'} size="sm" onClick={() => setWithdraw(true)} style={{ flex: 1 }}>Withdraw</Button>
        </div>
        <TextInput label="Amount" value={amount} onChange={setAmount} prefix="$" type="number" inputMode="decimal" placeholder="100" />
        <TextInput label="Date" value={date} onChange={setDate} type="date" />
        <TextInput label="Note (optional)" value={note} onChange={setNote} placeholder="e.g. tax refund" />
      </div>
    </Modal>
  );
}

function ZHQManageModal({ open, onClose, goal, onEdit }) {
  const { Modal, Button, IconButton, Icon } = window.ZittingHQDesignSystem_c9e528;
  const API = window.ZHQ_API || {};
  const [busy, setBusy] = React.useState(false);
  if (!goal) return null;
  const contributions = goal.contributions || [];

  async function run(fn) {
    setBusy(true);
    try { await fn(); window.ZHQ_REFRESH && window.ZHQ_REFRESH(); } finally { setBusy(false); }
  }
  const removeContribution = (c) => run(() => API.deleteContribution(c.id));
  const toggleArchive = () => run(async () => { await API.archiveSavingsGoal(goal.id, !goal.archived); onClose(); });
  const remove = () => {
    if (typeof window !== 'undefined' && !window.confirm(`Delete the "${goal.name}" goal and its contribution history?`)) return;
    run(async () => { await API.deleteSavingsGoal(goal.id); onClose(); });
  };

  return (
    <Modal open={open} onClose={onClose} title={`Manage · ${goal.name}`} width={480}
      footer={<>
        <Button variant="ghost" onClick={remove} disabled={busy} style={{ color: 'var(--negative)', marginRight: 'auto' }}>Delete goal</Button>
        <Button variant="secondary" onClick={toggleArchive} disabled={busy}>{goal.archived ? 'Reopen' : 'Mark complete'}</Button>
        <Button variant="primary" onClick={() => onEdit(goal)} disabled={busy}>Edit details</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="zt-num" style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
          {money(goal.saved)} of {money(goal.target)} saved{goal.date ? ` · target ${goal.date}` : ''}
        </div>
        <div>
          <div className="zt-eyebrow" style={{ marginBottom: 8 }}>Contribution history</div>
          {contributions.length ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {contributions.map((c, i) => (
                <div key={c.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i === contributions.length - 1 ? 'none' : '1px solid var(--border-hairline)' }}>
                  <span style={{ width: 30, height: 30, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9, background: 'var(--surface-raised)', color: c.amount < 0 ? 'var(--negative)' : 'var(--accent)' }}>
                    <Icon name={c.amount < 0 ? 'arrowDownRight' : 'arrowUpRight'} size={15} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="zt-num" style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)' }}>{c.amount < 0 ? '−' : '+'}{money(Math.abs(c.amount))}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{[c.date, c.kind, c.member, c.note].filter(Boolean).join(' · ')}</div>
                  </div>
                  {c.id != null ? <IconButton icon="x" size="sm" label="Remove contribution" onClick={() => removeContribution(c)} /> : null}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>No contributions yet. Use “Add money” to fund this goal.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ZHQSavings() {
  const { Button, Icon, StatTile, EmptyState } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA || {};
  const goals = D.goals || [];
  const stats = D.savingsStats || {};

  const [goalModalOpen, setGoalModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [addGoal, setAddGoal] = React.useState(null);
  const [manageOpen, setManageOpen] = React.useState(false);
  const [manageGoal, setManageGoal] = React.useState(null);

  const openAdd = () => { setEditing(null); setGoalModalOpen(true); };
  const openEdit = (g) => { setManageOpen(false); setEditing(g); setGoalModalOpen(true); };
  const openAddMoney = (g) => { setAddGoal(g); setAddOpen(true); };
  const openManage = (g) => { setManageGoal(g); setManageOpen(true); };

  const modals = (
    <>
      <ZHQGoalModal open={goalModalOpen} onClose={() => setGoalModalOpen(false)} editing={editing} />
      <ZHQAddMoneyModal open={addOpen} onClose={() => setAddOpen(false)} goal={addGoal} />
      <ZHQManageModal open={manageOpen} onClose={() => setManageOpen(false)} goal={manageGoal} onEdit={openEdit} />
    </>
  );

  if (!goals.length) {
    return (
      <>
        <EmptyState icon="target" title="No savings goals yet"
          body="Track progress toward big things — an emergency fund, a trip, a new car. Set a target and date, fund it manually or monthly, and keep some goals private to certain people."
          actionLabel="New goal" onAction={openAdd} />
        {modals}
      </>
    );
  }

  const active = goals.filter((g) => !g.archived);
  const archived = goals.filter((g) => g.archived);
  const household = active.filter((g) => g.visibility !== 'private');
  const privateGoals = active.filter((g) => g.visibility === 'private');

  const Section = ({ label, items }) => items.length ? (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span className="zt-eyebrow">{label}</span><span style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        {items.map((g) => <ZHQGoalCard key={g.id} g={g} onAddMoney={openAddMoney} onManage={openManage} />)}
      </div>
    </div>
  ) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', gap: 40 }}>
          <StatTile label="Saved across goals" value={stats.totalSavedDisplay || money(active.reduce((s, g) => s + g.saved, 0))} accent />
          <StatTile label="Monthly contributions" value={stats.monthlyContribDisplay || money(active.reduce((s, g) => s + (g.autoContrib || 0), 0))} sub="planned each month" />
          <StatTile label="On track" value={`${stats.onTrackCount ?? active.filter((g) => g.status === 'on-track' || g.status === 'ahead' || g.status === 'complete').length} / ${active.length}`} />
        </div>
        <Button variant="primary" iconLeft={<Icon name="plus" size={16} />} onClick={openAdd} style={{ flex: 'none' }}>New goal</Button>
      </div>

      <Section label="Household goals" items={household} />
      <Section label="Private goals" items={privateGoals} />
      <Section label="Completed & archived" items={archived} />

      {modals}
    </div>
  );
}

Object.assign(window, { ZHQSavings });
