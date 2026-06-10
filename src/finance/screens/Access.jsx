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

function ZHQAccess() {
  const { Card, Button, Icon, Avatar, Badge, Select, Modal } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  const API = window.ZHQ_API || {};
  const me = window.ZHQ_USER || {};
  const members = D.members || [];
  const acctsFlat = D.accountsFlat || [];
  const isOwner = me.role === 'owner';
  const managedNames = (memberId) => acctsFlat.filter((a) => (a.managers || []).some((mg) => mg.id === memberId)).map((a) => a.name);

  const [showAdd, setShowAdd] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [linkModal, setLinkModal] = React.useState(null);
  const refresh = () => window.ZHQ_REFRESH && window.ZHQ_REFRESH();

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
    if (m.status === 'invited') return <Badge tone="warning" size="sm">Invited</Badge>;
    if (m.status === 'active' || m.email) return <Badge tone="positive" size="sm">Login</Badge>;
    return <Badge tone="neutral" size="sm">No login</Badge>;
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
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {statusBadge(m)}
              {isOwner ? <MemberAllowanceCell m={m} /> : null}
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

      <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
        <b style={{ color: 'var(--text-secondary)' }}>Permission levels:</b> Owner — full control, can manage people. Partner — full financial access, can&apos;t manage people. Member — sees only their personal &ldquo;Spendable&rdquo; view.
      </div>

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
