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
        {acct.dest ? <Badge tone="accent" size="sm">{acct.dest}</Badge> : null}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="zt-num" style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.03em', color: credit ? 'var(--text-primary)' : 'var(--text-primary)' }}>{ZHQMoney(acct.balance, true)}</div>
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

function ZHQAccountDetail({ acct, onBack }) {
  const { Card, Button, Icon, Avatar, Badge, AreaChart, DataTable, AmountCell, Tag, Toggle } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  const credit = acct.balance < 0;
  const rows = (D.txns || []).filter((t) => t.accountId === acct.id || (acct.mask && t.account && t.account.includes(acct.mask))).slice(0, 8);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--text-secondary)', font: 'inherit', fontSize: 13, cursor: 'pointer' }}>
        <Icon name="chevronLeft" size={15} /> All accounts
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
        <Card padding={24}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <span style={{ width: 42, height: 42, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}><Icon name={credit ? 'creditCard' : 'bank'} size={20} /></span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{acct.name}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }} className="zt-num">{acct.inst} ••{acct.mask}</div>
            </div>
            {acct.dest ? <Badge tone="accent" size="sm" style={{ marginLeft: 'auto' }}>{acct.dest} destination</Badge> : null}
          </div>
          <div className="zt-eyebrow" style={{ marginBottom: 8 }}>{credit ? 'Current balance' : 'Available balance'}</div>
          <div className="zt-num" style={{ fontSize: 44, fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>{ZHQMoney(acct.balance, true)}</div>
          <div style={{ marginTop: 18 }}>
            <AreaChart data={acct.trend} labels={['Jan', '', 'Mar', '', 'May', 'Jun']} height={150} color={credit ? 'var(--gray-400)' : 'var(--accent)'} />
          </div>
        </Card>

        <Card padding={22}>
          <div className="zt-eyebrow" style={{ marginBottom: 16 }}>Account settings</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[['Nickname', acct.name], ['Mapped to', acct.who], ['Type', credit ? 'Credit card' : 'Bank account'], ['Institution', acct.inst]].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid var(--border-hairline)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{k}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 500 }}>{k === 'Mapped to' ? <Avatar name={v} size="xs" /> : null}{v}<Icon name="pencil" size={13} style={{ color: 'var(--text-tertiary)' }} /></span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0 4px' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Transfer destination</span>
              <Toggle defaultChecked={!!acct.dest} size="sm" />
            </div>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <TextInput label="Institution" value={institution} onChange={setInstitution} placeholder="Mountain America CU" />
          <TextInput label="Last 4 (mask)" value={mask} onChange={setMask} placeholder="4021" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Select label="Type" value={type} onChange={setType} options={[{ value: 'checking', label: 'Checking' }, { value: 'savings', label: 'Savings' }, { value: 'credit', label: 'Credit card' }]} />
          <Select label="Mapped to" value={who} onChange={setWho} options={[{ value: 'Household', label: 'Household' }, ...members.map((m) => ({ value: m.name, label: m.name }))]} />
        </div>
      </div>
    </Modal>
  );
}

function ZHQAccounts({ onNavigate }) {
  const { Card, Button, Icon, StatTile } = window.ZittingHQDesignSystem_c9e528;
  const A = window.ZHQ_DATA.accounts || { checking: [], savings: [], credit: [] };
  const [open, setOpen] = React.useState(null);
  const [showAdd, setShowAdd] = React.useState(false);
  if (open) return <ZHQAccountDetail acct={open} onBack={() => setOpen(null)} />;

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
            <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 600 }}>Add your first account</h2>
            <p style={{ margin: '0 0 18px', color: 'var(--text-secondary)', fontSize: 14 }}>Create an account, then import its transactions from a CSV.</p>
            <Button variant="primary" iconLeft={<Icon name="plus" size={16} />} onClick={() => setShowAdd(true)}>Add account</Button>
          </div>
        </div>
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
          <Button variant="secondary" iconLeft={<Icon name="arrowDown" size={16} />} onClick={() => onNavigate && onNavigate('import')}>Import</Button>
          <Button variant="primary" iconLeft={<Icon name="plus" size={16} />} onClick={() => setShowAdd(true)}>Add account</Button>
        </div>
      </div>

      {groups.map(([title, list]) => (
        <div key={title}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 13 }}>
            <span className="zt-eyebrow">{title}</span>
            <span style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{list.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {list.map((a) => <ZHQAccountCard key={a.id} acct={a} onOpen={setOpen} />)}
            {title === 'Checking' ? (
              <button onClick={() => setShowAdd(true)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 132, border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-lg)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', font: 'inherit' }}>
                <Icon name="plus" size={20} /><span style={{ fontSize: 13, fontWeight: 500 }}>Add account</span>
              </button>
            ) : null}
          </div>
        </div>
      ))}

      <ZHQAddAccountModal open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}

Object.assign(window, { ZHQAccounts, ZHQMoney });
