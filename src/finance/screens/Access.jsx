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

function ZHQAccess() {
  const { Card, Button, Icon, Avatar, Badge, Select, Modal } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  const API = window.ZHQ_API || {};
  const me = window.ZHQ_USER || {};
  const members = D.members || [];
  const isOwner = me.role === 'owner';

  const [showAdd, setShowAdd] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [linkModal, setLinkModal] = React.useState(null);
  const refresh = () => window.ZHQ_REFRESH && window.ZHQ_REFRESH();

  async function changeRole(m, role) { setBusy(true); try { await API.updateMember(m.id, { role }); refresh(); } finally { setBusy(false); } }
  async function remove(m) {
    if (!window.confirm(`Remove ${m.name}? Their transactions move to Household and their login (if any) is revoked.`)) return;
    setBusy(true); try { await API.removeMember(m.id); refresh(); } finally { setBusy(false); }
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
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: '1px solid var(--border-hairline)' }}>
            <Avatar name={m.name} size="sm" />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{m.email || 'tag-only'}</div>
            </div>
            <span style={{ flex: 1 }} />
            {statusBadge(m)}
            {isOwner ? (
              <Select value={m.role} onChange={(v) => changeRole(m, v)} options={[{ value: 'owner', label: 'Owner' }, { value: 'partner', label: 'Partner' }, { value: 'member', label: 'Member' }]} style={{ width: 132 }} />
            ) : <Badge tone="neutral" size="sm">{ROLE_LABEL[m.role] || m.role}</Badge>}
            {isOwner && m.status === 'invited' && m.email ? <Button variant="ghost" size="sm" onClick={() => copyLink(m.email)} disabled={busy}>Invite link</Button> : null}
            {isOwner && me.email !== m.email ? (
              <button onClick={() => remove(m)} disabled={busy} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'inline-flex', padding: 4 }}><Icon name="x" size={16} /></button>
            ) : null}
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

      <Modal open={!!linkModal} onClose={() => setLinkModal(null)} title="Invitation link" width={480}>
        {linkModal?.link ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-secondary)' }}>Copied to your clipboard. Send this to {linkModal.email} — it lets them set a password and sign in.</p>
            <div style={{ wordBreak: 'break-all', fontSize: 12, padding: '10px 12px', background: 'var(--surface-sunken)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}>{linkModal.link}</div>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--negative)' }}>{linkModal?.error}</p>
        )}
      </Modal>
    </div>
  );
}

Object.assign(window, { ZHQAccess });
