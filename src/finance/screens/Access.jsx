import React from 'react';
/* People & Access — manage family members, roles, and invitations. */

const ROLE_OPTS = [
  { value: 'owner', label: 'Owner — full control + manage people' },
  { value: 'partner', label: 'Partner — full financial access' },
  { value: 'member', label: 'Member — Spendable view only' },
];
const ROLE_LABEL = { owner: 'Owner', partner: 'Partner', member: 'Member' };

function AddPersonModal({ open, onClose, onResult }) {
  const { Modal, TextInput, Select, Toggle, Button } = window.ZittingHQDesignSystem_c9e528;
  const API = window.ZHQ_API || {};
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState('member');
  const [invite, setInvite] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  const reset = () => { setName(''); setEmail(''); setRole('member'); setInvite(true); };
  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await API.addMember({ name: name.trim(), email: email.trim() || null, role, invite: invite && !!email.trim() });
      window.ZHQ_REFRESH && window.ZHQ_REFRESH();
      reset(); onClose();
      onResult && onResult({ ...res, email: email.trim() || null });
    } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a person" width={440}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={busy || !name.trim()}>Add person</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <TextInput label="Name" value={name} onChange={setName} placeholder="Katelynn" />
        <TextInput label="Email (for login — optional)" value={email} onChange={setEmail} type="email" placeholder="katelynn@example.com" />
        <Select label="Permission level" value={role} onChange={setRole} options={ROLE_OPTS} />
        {email.trim() ? (
          <Toggle label="Send an email invitation to set up their login" checked={invite} onChange={setInvite} />
        ) : (
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-tertiary)' }}>No email = a name for tagging transactions only (no login). Add an email to invite them.</p>
        )}
      </div>
    </Modal>
  );
}

function MemberAllowanceCell({ m }) {
  const { TextInput, Button } = window.ZittingHQDesignSystem_c9e528;
  const API = window.ZHQ_API || {};
  const cur = Number(m.allowance || 0);
  const [editing, setEditing] = React.useState(false);
  const [val, setVal] = React.useState(String(cur || ''));
  const [busy, setBusy] = React.useState(false);
  async function save() {
    if (!API.setMemberAllowance) { setEditing(false); return; }
    const raw = String(val).replace(/[^0-9.-]/g, '');
    const num = raw === '' ? null : parseFloat(raw);
    setBusy(true);
    try {
      await API.setMemberAllowance(m.id, num != null && isNaN(num) ? null : num);
      window.ZHQ_REFRESH && window.ZHQ_REFRESH();
      setEditing(false);
    } finally { setBusy(false); }
  }
  if (editing) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <TextInput value={val} onChange={setVal} placeholder="0" inputMode="decimal" style={{ width: 84 }} />
        <Button variant="primary" size="sm" onClick={save} disabled={busy}>{busy ? '…' : 'Save'}</Button>
      </span>
    );
  }
  return (
    <button onClick={() => { setVal(String(cur || '')); setEditing(true); }} title="Monthly allowance" style={{ background: 'none', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-sm)', padding: '5px 10px', cursor: 'pointer', font: 'inherit', fontSize: 12.5, color: cur ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
      {cur ? `$${cur.toLocaleString('en-US')}/mo` : 'Set allowance'}
    </button>
  );
}

const num = (v) => { const n = parseFloat(String(v).replace(/[^0-9.-]/g, '')); return isNaN(n) ? 0 : n; };

function ZHQAllowanceRuleModal({ open, onClose, rule }) {
  const { Modal, TextInput, Select, SegmentedControl, Toggle, Button, Icon } = window.ZittingHQDesignSystem_c9e528;
  const API = window.ZHQ_API || {};
  const D = window.ZHQ_DATA || {};
  const members = D.members || [];
  const accts = (D.accountsFlat || []).map((a) => ({ value: a.id, label: a.label || a.name }));
  const editing = !!(rule && rule.id);

  const [memberId, setMemberId] = React.useState('');
  const [name, setName] = React.useState('');
  const [period, setPeriod] = React.useState('monthly'); // monthly | per_paycheck
  const [goal, setGoal] = React.useState('');
  const [min, setMin] = React.useState('');
  const [bonusType, setBonusType] = React.useState('percent'); // percent | fixed
  const [bonusBasis, setBonusBasis] = React.useState('overage'); // overage | gross
  const [bonusValue, setBonusValue] = React.useState('');
  const [fromAccountId, setFromAccountId] = React.useState('');
  const [toAccountId, setToAccountId] = React.useState('');
  const [gateOnReview, setGateOnReview] = React.useState(true);
  const [enabled, setEnabled] = React.useState(true);
  const [splits, setSplits] = React.useState([]); // [{memberId,pct,toAccountId}]
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (rule && rule.id) {
      setMemberId(rule.memberId); setName(rule.name || '');
      setPeriod(rule.period || 'monthly');
      setGoal(String(rule.goal ?? '')); setMin(String(rule.min ?? ''));
      setBonusType(rule.bonusType || 'percent'); setBonusBasis(rule.bonusBasis || 'overage');
      setBonusValue(String(rule.bonusValue ?? ''));
      setFromAccountId(rule.fromAccountId || ''); setToAccountId(rule.toAccountId || '');
      setGateOnReview(rule.gateOnReview !== false); setEnabled(rule.enabled !== false);
      setSplits((rule.splits || []).map((sp) => ({ memberId: sp.memberId, pct: String(sp.pct), toAccountId: sp.toAccountId })));
    } else {
      setMemberId(''); setName(''); setPeriod('monthly'); setGoal(''); setMin('');
      setBonusType('percent'); setBonusBasis('overage'); setBonusValue('');
      setFromAccountId(''); setToAccountId(''); setGateOnReview(true); setEnabled(true); setSplits([]);
    }
  }, [open, rule]);

  const earnerName = members.find((m) => m.id === memberId)?.name || 'the earner';
  const pctTotal = splits.reduce((s, sp) => s + num(sp.pct), 0);
  const earnerKeeps = Math.max(0, 100 - pctTotal);
  const recipientOpts = members.filter((m) => m.id !== memberId).map((m) => ({ value: m.id, label: m.name }));
  const valid = memberId && num(goal) > 0 && fromAccountId && toAccountId &&
    splits.every((sp) => sp.memberId && sp.toAccountId) && pctTotal <= 100;

  function addSplit() { setSplits([...splits, { memberId: '', pct: '', toAccountId: '' }]); }
  function setSplit(i, patch) { setSplits(splits.map((sp, j) => (j === i ? { ...sp, ...patch } : sp))); }
  function removeSplit(i) { setSplits(splits.filter((_, j) => j !== i)); }

  async function save() {
    if (!valid || !API.saveAllowanceRule) return;
    setBusy(true);
    try {
      await API.saveAllowanceRule({
        id: rule && rule.id ? rule.id : null,
        name: name.trim() || `${earnerName}'s allowance`,
        memberId, enabled, period,
        goalAmount: num(goal), minAmount: num(min),
        bonusType, bonusBasis, bonusValue: num(bonusValue),
        incomeMatchKeys: null,
        fromAccountId, toAccountId, gateOnReview,
        splits: splits.map((sp) => ({ memberId: sp.memberId, pct: num(sp.pct), toAccountId: sp.toAccountId })),
      });
      window.ZHQ_REFRESH && window.ZHQ_REFRESH();
      onClose();
    } finally { setBusy(false); }
  }

  const goalLabel = period === 'per_paycheck' ? 'Income goal per paycheck' : 'Monthly income goal';

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit allowance rule' : 'New allowance rule'} width={500}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={busy || !valid}>{busy ? '…' : (editing ? 'Save rule' : 'Create rule')}</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Select label="Earner" value={memberId} onChange={setMemberId} options={members.map((m) => ({ value: m.id, label: m.name }))} placeholder="Who earns the income?" />
        <TextInput label="Rule name" value={name} onChange={setName} placeholder={`${earnerName}'s allowance`} />

        <div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 6 }}>Evaluate</div>
          <SegmentedControl options={['Monthly', 'Per paycheck']} value={period === 'per_paycheck' ? 'Per paycheck' : 'Monthly'} onChange={(v) => setPeriod(v === 'Per paycheck' ? 'per_paycheck' : 'monthly')} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <TextInput label={goalLabel} value={goal} onChange={setGoal} inputMode="decimal" prefix="$" placeholder="3,000" />
          <TextInput label="Minimum allowance" value={min} onChange={setMin} inputMode="decimal" prefix="$" placeholder="100" />
        </div>

        <div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 6 }}>Bonus when over goal</div>
          <SegmentedControl options={['Percentage', 'Fixed amount']} value={bonusType === 'fixed' ? 'Fixed amount' : 'Percentage'} onChange={(v) => setBonusType(v === 'Fixed amount' ? 'fixed' : 'percent')} />
          <div style={{ display: 'grid', gridTemplateColumns: bonusType === 'percent' ? '1fr 1.4fr' : '1fr', gap: 12, marginTop: 10 }}>
            <TextInput value={bonusValue} onChange={setBonusValue} inputMode="decimal" prefix={bonusType === 'fixed' ? '$' : null} placeholder={bonusType === 'fixed' ? '250' : '20'} />
            {bonusType === 'percent' ? (
              <Select value={bonusBasis} onChange={setBonusBasis} options={[{ value: 'overage', label: '% of the amount over goal' }, { value: 'gross', label: '% of the whole income' }]} />
            ) : null}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Select label="Move money from" value={fromAccountId} onChange={setFromAccountId} options={accts} placeholder="Source account" />
          <Select label={`Deposit ${earnerName} into`} value={toAccountId} onChange={setToAccountId} options={accts} placeholder="Earner's account" />
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Split the bonus with</span>
            <span style={{ flex: 1 }} />
            <Button variant="ghost" size="sm" iconLeft={<Icon name="plus" size={13} />} onClick={addSplit} disabled={!recipientOpts.length}>Add recipient</Button>
          </div>
          {splits.map((sp, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.3fr 64px 1.3fr 32px', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <Select value={sp.memberId} onChange={(v) => setSplit(i, { memberId: v })} options={recipientOpts} placeholder="Member" />
              <TextInput value={sp.pct} onChange={(v) => setSplit(i, { pct: v })} inputMode="decimal" placeholder="%" />
              <Select value={sp.toAccountId} onChange={(v) => setSplit(i, { toAccountId: v })} options={accts} placeholder="Their account" />
              <button onClick={() => removeSplit(i)} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><Icon name="x" size={15} /></button>
            </div>
          ))}
          <div style={{ fontSize: 12, color: pctTotal > 100 ? 'var(--negative)' : 'var(--text-tertiary)', marginTop: 2 }}>
            {pctTotal > 100 ? 'Splits exceed 100% — reduce them.' : `${earnerName} keeps ${earnerKeeps}% of the bonus.`}
          </div>
        </div>

        {period === 'monthly' ? (
          <Toggle label="Only finalize once the month is fully categorized" checked={gateOnReview} onChange={setGateOnReview} />
        ) : null}
        <Toggle label="Rule enabled" checked={enabled} onChange={setEnabled} />
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          When this fires, a suggested transfer appears in Transfers for each person. It auto-checks-off once your bank shows the real transfer.
        </p>
      </div>
    </Modal>
  );
}

function ZHQAccess() {
  const { Card, Button, Icon, Avatar, Badge, Select, Modal } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  const API = window.ZHQ_API || {};
  const me = window.ZHQ_USER || {};
  const members = D.members || [];
  const acctsFlat = D.accountsFlat || [];
  const isOwner = me.role === 'owner';
  const allowanceRules = D.allowanceRules || [];
  const managedNames = (memberId) => acctsFlat.filter((a) => (a.managers || []).some((mg) => mg.id === memberId)).map((a) => a.name);

  const [showAdd, setShowAdd] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [linkModal, setLinkModal] = React.useState(null);
  const [ruleModal, setRuleModal] = React.useState(null); // null | {} (new) | {rule}
  const refresh = () => window.ZHQ_REFRESH && window.ZHQ_REFRESH();
  async function deleteRule(r) {
    if (!window.confirm(`Delete "${r.name}"? Pending allowance suggestions will be cleared; history is kept.`)) return;
    setBusy(true); try { await API.deleteAllowanceRule(r.id); refresh(); } finally { setBusy(false); }
  }

  async function changeRole(m, role) { setBusy(true); try { await API.updateMember(m.id, { role }); refresh(); } finally { setBusy(false); } }
  async function remove(m) {
    if (!window.confirm(`Remove ${m.name}? Their transactions move to Household and their login (if any) is revoked.`)) return;
    setBusy(true); try { await API.removeMember(m.id); refresh(); } finally { setBusy(false); }
  }
  async function sendInvite(email) {
    if (!API.sendInviteEmail) return;
    setBusy(true);
    try {
      const res = await API.sendInviteEmail(email);
      setLinkModal({ email, sent: !!res?.ok, error: res?.ok ? null : (res?.error || 'Could not send the invite.'), link: res?.link || null });
    } finally { setBusy(false); }
  }
  async function copyLink(email) {
    setBusy(true);
    try {
      const res = await API.getInviteLink(email);
      if (res?.link) { try { await navigator.clipboard.writeText(res.link); } catch { /* clipboard blocked */ } setLinkModal({ email, link: res.link }); }
      else setLinkModal({ email, error: res?.error || 'Could not generate a link.' });
    } finally { setBusy(false); }
  }

  const statusBadge = (m) => {
    if (m.active) return <Badge tone="positive" size="sm">Active</Badge>;
    if (m.status === 'invited') return <Badge tone="warning" size="sm">Invited</Badge>;
    if (m.email) return <Badge tone="neutral" size="sm">Not signed in</Badge>;
    return <Badge tone="neutral" size="sm">Tag-only</Badge>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 780 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>People &amp; access</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--text-secondary)' }}>Family members for tagging transactions and signing in.</p>
        </div>
        <span style={{ flex: 1 }} />
        {isOwner ? <Button variant="primary" size="sm" iconLeft={<Icon name="plus" size={15} />} onClick={() => setShowAdd(true)}>Add person</Button> : null}
      </div>

      <Card padding={6}>
        {members.map((m) => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', rowGap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border-hairline)' }}>
            <Avatar name={m.name} size="sm" />
            <div style={{ flex: '1 1 150px', minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{m.email || 'tag-only'}</div>
              {(() => { const mng = managedNames(m.id); return mng.length ? (
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 3, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Icon name="creditCard" size={12} /> Manages {mng.join(', ')}
                </div>
              ) : (isOwner && m.role === 'member' ? (
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 3 }}>No accounts yet · assign on the Accounts screen</div>
              ) : null); })()}
              {m.active && m.lastSeen ? (
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 3 }}>Last opened {m.lastSeen}</div>
              ) : null}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {statusBadge(m)}
              {isOwner ? (
                <Select value={m.role} onChange={(v) => changeRole(m, v)} options={[{ value: 'owner', label: 'Owner' }, { value: 'partner', label: 'Partner' }, { value: 'member', label: 'Member' }]} style={{ width: 124 }} />
              ) : <Badge tone="neutral" size="sm">{ROLE_LABEL[m.role] || m.role}</Badge>}
              {isOwner && m.email && me.email !== m.email ? <Button variant="secondary" size="sm" iconLeft={<Icon name="bell" size={14} />} onClick={() => sendInvite(m.email)} disabled={busy}>Send invite</Button> : null}
              {isOwner && me.email !== m.email ? (
                <button onClick={() => remove(m)} disabled={busy} title="Remove" className="zhq-rowbtn" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 36, minHeight: 36 }}><Icon name="x" size={16} /></button>
              ) : null}
            </div>
          </div>
        ))}
        {!members.length ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13.5 }}>No people yet.</div> : null}
      </Card>

      {isOwner ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 600 }}>Performance allowances</h3>
              <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--text-secondary)' }}>Pay a minimum, plus a bonus split when paychecks beat a goal. Suggested transfers land in Transfers.</p>
            </div>
            <span style={{ flex: 1 }} />
            <Button variant="secondary" size="sm" iconLeft={<Icon name="plus" size={15} />} onClick={() => setRuleModal({})} disabled={!members.length}>New rule</Button>
          </div>
          {allowanceRules.length ? (
            <Card padding={6}>
              {allowanceRules.map((r) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', rowGap: 8, padding: '12px 14px', borderBottom: '1px solid var(--border-hairline)' }}>
                  <Avatar name={r.memberName} size="sm" />
                  <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 7 }}>
                      {r.name}
                      {!r.enabled ? <Badge tone="neutral" size="sm">Off</Badge> : null}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      Goal {r.goalLabel} {r.period === 'per_paycheck' ? '/ paycheck' : '/ mo'} · min {r.minLabel} · {r.bonusType === 'fixed' ? `$${r.bonusValue} bonus` : `${r.bonusValue}% of ${r.bonusBasis === 'gross' ? 'income' : 'overage'}`}
                      {r.splits && r.splits.length ? ` · split: ${r.splits.map((sp) => `${sp.memberName} ${sp.pct}%`).join(', ')}` : ''}
                    </div>
                    <div style={{ fontSize: 11.5, color: r.status?.over ? 'var(--positive)' : 'var(--text-tertiary)', marginTop: 3 }}>
                      {r.status?.incomeLabel} earned {r.status?.periodLabel}{r.status?.over ? ` · ${r.status.bonusLabel} bonus` : ' · under goal'}
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Button variant="ghost" size="sm" onClick={() => setRuleModal({ rule: r })}>Edit</Button>
                    <button onClick={() => deleteRule(r)} disabled={busy} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', minWidth: 32, minHeight: 32 }}><Icon name="x" size={15} /></button>
                  </div>
                </div>
              ))}
            </Card>
          ) : (
            <Card padding={18}><div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No allowance rules yet. Create one to pay a minimum plus a performance bonus.</div></Card>
          )}
        </div>
      ) : null}

      <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
        <b style={{ color: 'var(--text-secondary)' }}>Permission levels:</b> Owner — full control, can manage people. Partner — full financial access, can&apos;t manage people. Member — sees only their personal &ldquo;Spendable&rdquo; view.
      </div>

      <ZHQAllowanceRuleModal open={!!ruleModal} onClose={() => setRuleModal(null)} rule={ruleModal?.rule} />

      <AddPersonModal open={showAdd} onClose={() => setShowAdd(false)} onResult={(res) => {
        if (res && res.email && res.inviteError) setLinkModal({ email: res.email, error: `${res.inviteError} You can still send an invite link.` });
      }} />

      <Modal open={!!linkModal} onClose={() => setLinkModal(null)} title={linkModal?.sent ? 'Invite sent' : 'Invite'} width={480}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {linkModal?.sent ? (
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-secondary)' }}>
              ✅ Emailed an invite to <b style={{ color: 'var(--text-primary)' }}>{linkModal.email}</b>. They'll get a link to set their password — tell them to check spam if it's slow.
            </p>
          ) : linkModal?.error ? (
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--negative)' }}>{linkModal.error}</p>
          ) : null}
          {linkModal?.link ? (
            <>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-tertiary)' }}>{linkModal?.sent ? 'Or copy the link and send it yourself:' : 'Copy this link and send it to them:'}</p>
              <div style={{ wordBreak: 'break-all', fontSize: 12, padding: '10px 12px', background: 'var(--surface-sunken)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}>{linkModal.link}</div>
              <Button variant="secondary" size="sm" onClick={() => { try { navigator.clipboard.writeText(linkModal.link); } catch { /* clipboard blocked */ } }}>Copy link</Button>
            </>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}

Object.assign(window, { ZHQAccess });
