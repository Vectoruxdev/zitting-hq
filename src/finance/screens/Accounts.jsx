import React from 'react';
/* Accounts — grouped account cards + per-account detail. */
function ZHQMoney(n, cents) {
  const neg = n < 0;
  const v = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
  return (neg ? '−$' : '$') + v;
}

function ZHQAccountCard({ acct, onOpen }) {
  const { Card, Avatar, Icon, Badge, Sparkline } = window.ZittingHQDesignSystem_c9e528;
  const credit = acct.balance < 0;
  return (
    <Card interactive bordered padding={18} onClick={() => onOpen(acct)}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
          <span style={{ width: 38, height: 38, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}>
            <Icon name={credit ? 'creditCard' : 'bank'} size={18} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{acct.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }} className="zt-num">{acct.inst} ••{acct.mask}</div>
          </div>
        </div>
        <div style={{ display: 'inline-flex', gap: 6, flexShrink: 0 }}>
          {acct.plaidLinked ? <Badge tone="positive" size="sm">Auto-sync</Badge> : null}
          {acct.dest ? <Badge tone="accent" size="sm">{acct.dest}</Badge> : null}
        </div>
      </div>

      {acct.managers && acct.managers.length ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 11.5, color: 'var(--text-tertiary)' }}>
          <Icon name="users" size={12} />
          <span>Managed by {acct.managers.map((m) => m.name).join(', ')}</span>
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="zt-num" style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.03em', color: credit ? 'var(--text-primary)' : 'var(--text-primary)' }}>{ZHQMoney(acct.balance, true)}</div>
          {acct.available != null && acct.available !== acct.balance ? (
            <div className="zt-num" style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{ZHQMoney(acct.available, false)} available</div>
          ) : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 7 }}>
            <Avatar name={acct.who} size="xs" />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{acct.who}</span>
            <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--text-tertiary)' }} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: acct.status === 'good' ? 'var(--text-tertiary)' : 'var(--warning)' }}>
              {acct.status === 'good' ? <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)' }} /> : <Icon name="alert" size={12} />}
              {acct.synced}
            </span>
          </div>
        </div>
        <Sparkline data={acct.trend} width={84} height={34} area color={credit ? 'var(--gray-400)' : 'var(--accent)'} />
      </div>
    </Card>
  );
}

function ZHQOpeningBalanceRow({ acct }) {
  const { Icon, TextInput, Button } = window.ZittingHQDesignSystem_c9e528;
  const API = window.ZHQ_API || {};
  const opening = acct.openingBalance ?? 0;
  const [editing, setEditing] = React.useState(false);
  const [val, setVal] = React.useState(String(opening));
  const [busy, setBusy] = React.useState(false);

  async function save() {
    const num = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
    if (!API.updateAccount || isNaN(num)) { setEditing(false); return; }
    setBusy(true);
    try {
      await API.updateAccount(acct.id, { balance: num });
      window.ZHQ_REFRESH && window.ZHQ_REFRESH();
      setEditing(false);
    } finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--border-hairline)' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Opening balance</div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>Starting point before imported activity</div>
      </div>
      {editing ? (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <TextInput value={val} onChange={setVal} placeholder="0.00" style={{ width: 120 }} inputMode="decimal" />
          <Button variant="primary" size="sm" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
          <Button variant="ghost" size="sm" onClick={() => { setVal(String(opening)); setEditing(false); }}>Cancel</Button>
        </div>
      ) : (
        <button onClick={() => { setVal(String(opening)); setEditing(true); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 500, font: 'inherit' }}>
          {ZHQMoney(opening, true)}<Icon name="pencil" size={13} style={{ color: 'var(--text-tertiary)' }} />
        </button>
      )}
    </div>
  );
}

function ZHQEditAccountModal({ open, acct, onClose, onDeleted }) {
  const { Modal, TextInput, Select, SegmentedControl, Button, Icon, Checkbox, Avatar } = window.ZittingHQDesignSystem_c9e528;
  const API = window.ZHQ_API || {};
  const members = window.ZHQ_DATA.members || [];
  const [name, setName] = React.useState(acct.name || '');
  const [institution, setInstitution] = React.useState(acct.inst || '');
  const [mask, setMask] = React.useState(acct.mask || '');
  const [type, setType] = React.useState(acct.type || 'checking');
  const [who, setWho] = React.useState(acct.who || 'Household');
  const [dest, setDest] = React.useState(acct.dest || '');
  const [managerIds, setManagerIds] = React.useState((acct.managers || []).map((m) => m.id));
  const [vis, setVis] = React.useState(acct.collapsed ? 'grouped' : 'shown');
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  // Re-seed when a different account is opened.
  React.useEffect(() => {
    setName(acct.name || ''); setInstitution(acct.inst || ''); setMask(acct.mask || '');
    setType(acct.type || 'checking'); setWho(acct.who || 'Household'); setDest(acct.dest || '');
    setManagerIds((acct.managers || []).map((m) => m.id));
    setVis(acct.collapsed ? 'grouped' : 'shown');
    setConfirmDelete(false);
  }, [acct.id]);

  function toggleManager(id) {
    setManagerIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : (cur.length >= 2 ? cur : [...cur, id]));
  }

  async function save() {
    if (!name.trim() || !API.updateAccount) return;
    setBusy(true);
    try {
      await API.updateAccount(acct.id, {
        name: name.trim(),
        institution: institution.trim(),
        mask: mask.trim() || null,
        type,
        who,
        destLabel: dest.trim() || null,
      });
      if (API.setAccountMembers) await API.setAccountMembers(acct.id, managerIds);
      window.ZHQ_REFRESH && window.ZHQ_REFRESH();
      onClose();
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!API.deleteAccount) return;
    setBusy(true);
    try {
      await API.deleteAccount(acct.id);
      window.ZHQ_REFRESH && window.ZHQ_REFRESH();
      onClose();
      onDeleted && onDeleted();
    } finally { setBusy(false); }
  }

  async function moveToBusiness() {
    if (!API.setAccountSpace) return;
    setBusy(true);
    try {
      await API.setAccountSpace(acct.id, 'business');
      window.ZHQ_REFRESH && window.ZHQ_REFRESH();
      onClose();
      onDeleted && onDeleted(); // it leaves the household list → go back
    } finally { setBusy(false); }
  }

  const typeOpts = [{ value: 'checking', label: 'Checking' }, { value: 'savings', label: 'Savings' }, { value: 'credit', label: 'Credit card' }];
  const whoOpts = [{ value: 'Household', label: 'Household' }, ...members.map((m) => ({ value: m.name, label: m.name }))];

  return (
    <Modal open={open} onClose={onClose} title="Edit account" width={440}
      footer={<>
        <Button variant="ghost" onClick={() => setConfirmDelete(true)} disabled={busy} style={{ color: 'var(--negative)', marginRight: 'auto' }}>Delete</Button>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={busy || !name.trim()}>Save changes</Button>
      </>}>
      {confirmDelete ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 11 }}>
            <span style={{ flexShrink: 0, color: 'var(--negative)' }}><Icon name="alert" size={18} /></span>
            <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Delete <b style={{ color: 'var(--text-primary)' }}>{acct.name}</b>? This also removes its imported transactions and import history. This can't be undone.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>Keep account</Button>
            <Button variant="primary" onClick={remove} disabled={busy} style={{ background: 'var(--negative)' }}>{busy ? 'Deleting…' : 'Delete account'}</Button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <TextInput label="Account name" value={name} onChange={setName} placeholder="Main Checking" />
          <div style={{ display: 'grid', gridTemplateColumns: 'var(--grid-2)', gap: 12 }}>
            <TextInput label="Institution" value={institution} onChange={setInstitution} placeholder="Mountain America CU" />
            <TextInput label="Last 4 (mask)" value={mask} onChange={setMask} placeholder="4021" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'var(--grid-2)', gap: 12 }}>
            <Select label="Type" value={type} onChange={setType} options={typeOpts} />
            <Select label="Mapped to" value={who} onChange={setWho} options={whoOpts} />
          </div>
          <TextInput label="Transfer destination tag (optional)" value={dest} onChange={setDest} placeholder="e.g. Savings target" />
          <div>
            <span className="zt-eyebrow" style={{ display: 'block', marginBottom: 8 }}>In charge of (up to 2)</span>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>These people can categorize this account's transactions from their own login.</div>
            {members.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {members.map((mem) => {
                  const checked = managerIds.includes(mem.id);
                  const atCap = managerIds.length >= 2 && !checked;
                  return (
                    <label key={mem.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', cursor: atCap ? 'not-allowed' : 'pointer', opacity: atCap ? 0.45 : 1 }}>
                      <Checkbox checked={checked} onChange={() => toggleManager(mem.id)} disabled={atCap} />
                      <Avatar name={mem.name} size="xs" />
                      <span style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>{mem.name}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{mem.role}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Add people in People &amp; Access first.</div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTop: '1px solid var(--border-hairline)', paddingTop: 14 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)' }}>Hide this account</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2, lineHeight: 1.5 }}>Keeps its transactions out of the household dashboard &amp; emails and pauses its sync (good for business accounts). Unhide anytime from "Show hidden accounts".</div>
            </div>
            <Button variant="secondary" size="sm" onClick={moveToBusiness} disabled={busy} style={{ flex: 'none' }}>Hide</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ZHQAccountDetail({ acct, onBack }) {
  const { Card, Button, Icon, Avatar, Badge, AreaChart, DataTable, AmountCell, Tag, Toggle } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  const credit = acct.balance < 0;
  const [showEdit, setShowEdit] = React.useState(false);
  const rows = (D.txns || []).filter((t) => t.accountId === acct.id || (acct.mask && t.account && t.account.includes(acct.mask))).slice(0, 8);
  const typeLabel = acct.type === 'credit' ? 'Credit card' : acct.type === 'savings' ? 'Savings' : 'Checking';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--text-secondary)', font: 'inherit', fontSize: 13, cursor: 'pointer' }}>
          <Icon name="chevronLeft" size={15} /> All accounts
        </button>
        <Button variant="secondary" size="sm" iconLeft={<Icon name="pencil" size={14} />} onClick={() => setShowEdit(true)}>Edit account</Button>
      </div>
      <ZHQEditAccountModal open={showEdit} acct={acct} onClose={() => setShowEdit(false)} onDeleted={onBack} />

      <div style={{ display: 'grid', gridTemplateColumns: 'var(--grid-2)', gap: 16 }}>
        <Card padding={24}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <span style={{ width: 42, height: 42, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}><Icon name={credit ? 'creditCard' : 'bank'} size={20} /></span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{acct.name}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }} className="zt-num">{acct.inst} ••{acct.mask}</div>
            </div>
            {acct.dest ? <Badge tone="accent" size="sm" style={{ marginLeft: 'auto' }}>{acct.dest} destination</Badge> : null}
          </div>
          <div className="zt-eyebrow" style={{ marginBottom: 8 }}>Current balance</div>
          <div className="zt-num" style={{ fontSize: 44, fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>{ZHQMoney(acct.balance, true)}</div>
          {acct.available != null && acct.available !== acct.balance ? (
            <div className="zt-num" style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>{ZHQMoney(acct.available, false)} available</div>
          ) : null}
          {acct.openingBalance != null && acct.balance !== acct.openingBalance ? (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
              {ZHQMoney(acct.openingBalance, false)} opening + {ZHQMoney(acct.balance - acct.openingBalance, false)} imported activity
            </div>
          ) : null}
          <div style={{ marginTop: 18 }}>
            <AreaChart data={acct.trend} labels={['Jan', '', 'Mar', '', 'May', 'Jun']} height={150} color={credit ? 'var(--gray-400)' : 'var(--accent)'} />
          </div>
        </Card>

        <Card padding={22}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span className="zt-eyebrow">Account settings</span>
            <button onClick={() => setShowEdit(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', fontSize: 12.5, color: 'var(--accent)' }}>
              <Icon name="pencil" size={12} /> Edit
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[['Nickname', acct.name], ['Mapped to', acct.who], ['In charge of', (acct.managers || []).map((m) => m.name).join(', ') || 'No one yet'], ['Type', typeLabel], ['Institution', acct.inst || '—'], ['Transfer destination', acct.dest || 'None']].map(([k, v]) => (
              <button key={k} onClick={() => setShowEdit(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid var(--border-hairline)', background: 'none', border: 'none', borderBottomStyle: 'solid', width: '100%', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{k}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 500 }}>{k === 'Mapped to' ? <Avatar name={v} size="xs" /> : null}{v}<Icon name="pencil" size={13} style={{ color: 'var(--text-tertiary)' }} /></span>
              </button>
            ))}
            <ZHQOpeningBalanceRow acct={acct} />
          </div>
        </Card>
      </div>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>Recent activity</h2>
          <Button variant="ghost" size="sm" iconLeft={<Icon name="filter" size={14} />}>Filter</Button>
        </div>
        <DataTable
          columns={[
            { key: 'date', header: 'Date', render: (r) => <span style={{ color: 'var(--text-secondary)' }}>{r.date}</span> },
            { key: 'merchant', header: 'Merchant', render: (r) => <span style={{ fontWeight: 500 }}>{r.merchant}</span> },
            { key: 'cat', header: 'Category', render: (r) => <Tag color={r.color} size="sm">{r.cat}</Tag> },
            { key: 'amt', header: 'Amount', align: 'right', render: (r) => <AmountCell value={r.amt} income={r.income} /> },
          ]}
          rows={rows} dense />
      </Card>
    </div>
  );
}

function ZHQAddAccountModal({ open, onClose }) {
  const { Modal, TextInput, Select, Button } = window.ZittingHQDesignSystem_c9e528;
  const API = window.ZHQ_API || {};
  const members = window.ZHQ_DATA.members || [];
  const [name, setName] = React.useState('');
  const [institution, setInstitution] = React.useState('');
  const [mask, setMask] = React.useState('');
  const [type, setType] = React.useState('checking');
  const [who, setWho] = React.useState('Household');
  const [busy, setBusy] = React.useState(false);

  const reset = () => { setName(''); setInstitution(''); setMask(''); setType('checking'); setWho('Household'); };
  async function save() {
    if (!name.trim() || !API.createAccount) return;
    setBusy(true);
    try {
      await API.createAccount({ name: name.trim(), institution: institution.trim(), type, mask: mask.trim() || null, who });
      window.ZHQ_REFRESH && window.ZHQ_REFRESH();
      reset(); onClose();
    } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add account" width={420}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={busy || !name.trim()}>Add account</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <TextInput label="Account name" value={name} onChange={setName} placeholder="Main Checking" />
        <div style={{ display: 'grid', gridTemplateColumns: 'var(--grid-2)', gap: 12 }}>
          <TextInput label="Institution" value={institution} onChange={setInstitution} placeholder="Mountain America CU" />
          <TextInput label="Last 4 (mask)" value={mask} onChange={setMask} placeholder="4021" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'var(--grid-2)', gap: 12 }}>
          <Select label="Type" value={type} onChange={setType} options={[{ value: 'checking', label: 'Checking' }, { value: 'savings', label: 'Savings' }, { value: 'credit', label: 'Credit card' }]} />
          <Select label="Mapped to" value={who} onChange={setWho} options={[{ value: 'Household', label: 'Household' }, ...members.map((m) => ({ value: m.name, label: m.name }))]} />
        </div>
      </div>
    </Modal>
  );
}

function ZHQConnectedBanks() {
  const { Card, Button, Icon, Badge } = window.ZittingHQDesignSystem_c9e528;
  const API = window.ZHQ_API || {};
  const [banks, setBanks] = React.useState(null);
  const [busy, setBusy] = React.useState(null); // itemId mid-action

  const load = React.useCallback(async () => {
    if (!API.listPlaidBanks) { setBanks([]); return; }
    try { setBanks(await API.listPlaidBanks()); } catch { setBanks([]); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  if (!banks || !banks.length) return null; // nothing connected yet → header button handles it

  async function syncNow(itemId) {
    setBusy(itemId || 'all');
    try { await (window.ZHQ_PLAID && window.ZHQ_PLAID.sync()); await load(); } finally { setBusy(null); }
  }
  async function disconnect(itemId, name) {
    if (!window.confirm(`Disconnect ${name || 'this bank'}? Imported transactions stay; new ones stop syncing.`)) return;
    setBusy(itemId);
    try { await API.removePlaidBank(itemId); await load(); window.ZHQ_REFRESH && window.ZHQ_REFRESH(); } finally { setBusy(null); }
  }

  return (
    <Card padding={18}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="zt-eyebrow">Connected banks · auto-sync</span>
        <Button variant="ghost" size="sm" iconLeft={<Icon name="repeat" size={14} />} onClick={() => syncNow()} disabled={busy === 'all'}>{busy === 'all' ? 'Syncing…' : 'Sync now'}</Button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {banks.map((b) => (
          <div key={b.itemId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}><Icon name="bank" size={15} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{b.institutionName || 'Bank'}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                {b.lastSyncedAt ? `Last synced ${new Date(b.lastSyncedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'Not synced yet'}
              </div>
            </div>
            {b.status !== 'good' ? <Badge tone="warning" size="sm">{b.status === 'login_required' ? 'Reconnect' : 'Error'}</Badge> : <Badge tone="positive" size="sm">Active</Badge>}
            <button onClick={() => disconnect(b.itemId, b.institutionName)} disabled={busy === b.itemId} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-tertiary)', font: 'inherit' }}>
              {busy === b.itemId ? '…' : 'Disconnect'}
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ZHQBusinessAccounts() {
  const { Card, Button, Icon, Badge } = window.ZittingHQDesignSystem_c9e528;
  const API = window.ZHQ_API || {};
  const D = window.ZHQ_DATA || {};
  const list = D.excludedAccounts || [];
  const [busy, setBusy] = React.useState(null);
  const [open, setOpen] = React.useState(false);
  if (!list.length) return null;

  async function unhide(id) {
    if (!API.setAccountSpace) return;
    setBusy(id);
    try { await API.setAccountSpace(id, 'household'); window.ZHQ_REFRESH && window.ZHQ_REFRESH(); } finally { setBusy(null); }
  }

  return (
    <Card padding={open ? 18 : 12}>
      {/* Collapsed by default — an opt-in to reveal hidden (business) accounts. */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', padding: open ? '0 0 12px' : 0, color: 'var(--text-secondary)' }}>
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={15} />
        <span style={{ fontSize: 13, fontWeight: 500 }}>{open ? 'Hidden accounts' : `Show hidden accounts (${list.length})`}</span>
        {!open ? <span style={{ flex: 1 }} /> : null}
      </button>

      {open ? (
        <>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12, lineHeight: 1.5 }}>
            These accounts and their transactions are kept out of your dashboard and emails, and their sync is paused. Unhide to bring one back.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {list.map((a) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}><Icon name="bank" size={15} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }} className="zt-num">{a.institution || 'Account'}{a.mask ? ` ••${a.mask}` : ''}</div>
                </div>
                {a.plaidLinked ? <Badge tone="neutral" size="sm">Auto-sync paused</Badge> : null}
                <Button variant="ghost" size="sm" onClick={() => unhide(a.id)} disabled={busy === a.id} style={{ flex: 'none' }}>{busy === a.id ? '…' : 'Unhide'}</Button>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </Card>
  );
}

function ZHQAccounts({ onNavigate }) {
  const { Card, Button, Icon, StatTile } = window.ZittingHQDesignSystem_c9e528;
  const A = window.ZHQ_DATA.accounts || { checking: [], savings: [], credit: [] };
  const flat = [...A.checking, ...A.savings, ...A.credit];
  // The active screen remounts on every data refresh, so remember which account
  // is open in a window-global and re-derive it from fresh data each render —
  // that keeps the detail view open (and current) after an edit, and falls back
  // to the list if the account was deleted.
  const [openId, setOpenId] = React.useState(() => window.__zhqOpenAccount || null);
  const [showAdd, setShowAdd] = React.useState(false);
  const openAccount = (acct) => { window.__zhqOpenAccount = acct.id; setOpenId(acct.id); };
  const closeAccount = () => { window.__zhqOpenAccount = null; setOpenId(null); };
  const open = openId ? flat.find((a) => a.id === openId) : null;
  if (openId && !open) { window.__zhqOpenAccount = null; }
  if (open) return <ZHQAccountDetail acct={open} onBack={closeAccount} />;

  const groups = [['Checking', A.checking], ['Savings', A.savings], ['Credit cards', A.credit]];
  const total = A.checking.length + A.savings.length + A.credit.length;
  const cash = [...A.checking, ...A.savings].reduce((s, a) => s + a.balance, 0);
  const debt = A.credit.reduce((s, a) => s + a.balance, 0);

  // empty state
  if (!total) {
    return (
      <>
        <div style={{ display: 'grid', placeItems: 'center', padding: '60px 20px' }}>
          <div style={{ textAlign: 'center', maxWidth: 380 }}>
            <span style={{ display: 'inline-flex', width: 52, height: 52, borderRadius: 999, placeItems: 'center', background: 'var(--surface-raised)', color: 'var(--text-tertiary)', marginBottom: 14 }}><Icon name="wallet" size={24} /></span>
            <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 600 }}>Connect your first account</h2>
            <p style={{ margin: '0 0 18px', color: 'var(--text-secondary)', fontSize: 14 }}>Connect a bank to import transactions automatically — or add one manually and import a CSV.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Button variant="primary" iconLeft={<Icon name="bank" size={16} />} onClick={() => window.ZHQ_PLAID && window.ZHQ_PLAID.connect()}>Connect bank</Button>
              <Button variant="secondary" iconLeft={<Icon name="plus" size={16} />} onClick={() => setShowAdd(true)}>Add manually</Button>
            </div>
          </div>
        </div>
        <ZHQBusinessAccounts />
        <ZHQAddAccountModal open={showAdd} onClose={() => setShowAdd(false)} />
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', gap: 40 }}>
          <StatTile label="Cash across accounts" value={ZHQMoney(cash, false)} />
          <StatTile label="Credit balance" value={ZHQMoney(debt, false)} />
          <StatTile label="Net worth" value={ZHQMoney(cash + debt, false)} accent />
        </div>
        <div style={{ display: 'flex', gap: 10, flex: 'none' }}>
          <Button variant="ghost" iconLeft={<Icon name="arrowDown" size={16} />} onClick={() => onNavigate && onNavigate('import')}>Import CSV</Button>
          <Button variant="secondary" iconLeft={<Icon name="plus" size={16} />} onClick={() => setShowAdd(true)}>Add manually</Button>
          <Button variant="primary" iconLeft={<Icon name="bank" size={16} />} onClick={() => window.ZHQ_PLAID && window.ZHQ_PLAID.connect()}>Connect bank</Button>
        </div>
      </div>

      <ZHQConnectedBanks />

      {groups.map(([title, list]) => (
        <div key={title}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 13 }}>
            <span className="zt-eyebrow">{title}</span>
            <span style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{list.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'var(--grid-3)', gap: 14 }}>
            {list.map((a) => <ZHQAccountCard key={a.id} acct={a} onOpen={openAccount} />)}
            {title === 'Checking' ? (
              <button onClick={() => setShowAdd(true)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 132, border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-lg)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', font: 'inherit' }}>
                <Icon name="plus" size={20} /><span style={{ fontSize: 13, fontWeight: 500 }}>Add account</span>
              </button>
            ) : null}
          </div>
        </div>
      ))}

      <ZHQBusinessAccounts />

      <ZHQAddAccountModal open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}

Object.assign(window, { ZHQAccounts, ZHQMoney });
