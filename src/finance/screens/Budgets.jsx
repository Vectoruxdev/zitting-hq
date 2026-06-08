import React from 'react';
/* Budgets — personal allowances + shared category budgets, with a create modal. */
function ZHQBudgetModal({ onClose }) {
  const { Card, Icon, IconButton, Button, SegmentedControl, Toggle, Avatar } = window.ZittingHQDesignSystem_c9e528;
  const [type, setType] = React.useState('Personal');
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
      <Card padding={24} style={{ position: 'relative', width: 460, boxShadow: 'var(--shadow-pop)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>New budget</h2>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div className="zt-eyebrow" style={{ marginBottom: 8 }}>Type</div>
            <SegmentedControl options={['Personal', 'Category']} value={type} onChange={setType} full />
          </div>
          <div>
            <div className="zt-eyebrow" style={{ marginBottom: 8 }}>{type === 'Personal' ? 'Who it applies to' : 'Category'}</div>
            {type === 'Personal' ? (
              <div style={{ display: 'flex', gap: 8 }}>
                {['Sarah', 'Rebecca', 'Jared'].map((n, i) => (
                  <button key={n} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid', borderColor: i === 0 ? 'var(--accent)' : 'var(--border-hairline)', background: i === 0 ? 'var(--accent-soft)' : 'var(--surface-raised)', color: 'var(--text-primary)', font: 'inherit', fontSize: 13, cursor: 'pointer' }}><Avatar name={n} size="xs" />{n}</button>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, height: 42, padding: '0 14px', background: 'var(--surface-raised)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }}><Icon name="pie" size={16} /><span style={{ fontSize: 13.5 }}>Choose a category…</span><Icon name="chevronDown" size={15} style={{ marginLeft: 'auto' }} /></div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div className="zt-eyebrow" style={{ marginBottom: 8 }}>Amount</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 14px', background: 'var(--surface-raised)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-sm)' }}><span style={{ color: 'var(--text-tertiary)' }}>$</span><input defaultValue="400" className="zt-num" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 15, fontWeight: 600 }} /></div>
            </div>
            <div style={{ flex: 1 }}>
              <div className="zt-eyebrow" style={{ marginBottom: 8 }}>Period</div>
              <SegmentedControl options={['Monthly', 'Weekly']} defaultValue="Monthly" full size="md" />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
            <div><div style={{ fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 500 }}>Roll over unspent</div><div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Carry leftover into next period</div></div>
            <Toggle defaultChecked />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <Button variant="ghost" onClick={onClose} full>Cancel</Button>
            <Button variant="primary" onClick={onClose} full>Create budget</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ZHQAllowanceCard({ b }) {
  const { Card, Avatar, ProgressBar } = window.ZittingHQDesignSystem_c9e528;
  const left = b.limit - b.spent;
  const over = left < 0;
  const near = !over && left / b.limit <= 0.15;
  return (
    <Card padding={20}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 18 }}>
        <Avatar name={b.who} size="md" />
        <div><div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>{b.who}</div><div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>${b.limit}/mo · June</div></div>
      </div>
      <div className="zt-eyebrow" style={{ marginBottom: 7 }}>{over ? 'Over by' : 'Remaining'}</div>
      <div className="zt-num" style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.03em', color: over ? 'var(--negative)' : near ? 'var(--warning)' : 'var(--accent)' }}>{over ? '−' : ''}${Math.abs(left)}</div>
      <div style={{ margin: '16px 0 9px' }}><ProgressBar value={b.spent} max={b.limit} /></div>
      <div className="zt-num" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>${b.spent} spent of ${b.limit}</div>
    </Card>
  );
}

function ZHQBudgets() {
  const { Card, Button, Icon, BudgetRow } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  const [modal, setModal] = React.useState(false);
  const allowances = D.budgets.filter((b) => b.who);
  const shared = [
    { name: 'Groceries', spent: 312, limit: 600, icon: 'pie' },
    { name: 'Dining', spent: 360, limit: 400, icon: 'list' },
    { name: 'Utilities', spent: 430, limit: 450, icon: 'repeat' },
    { name: 'Kids & school', spent: 520, limit: 700, icon: 'users' },
    { name: 'Shopping', spent: 680, limit: 600, icon: 'wallet' },
    { name: 'Gas & auto', spent: 240, limit: 400, icon: 'creditCard' },
  ];

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 26 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="zt-eyebrow">June 2026 · funded by allocations</div>
        <Button variant="primary" iconLeft={<Icon name="plus" size={16} />} onClick={() => setModal(true)}>New budget</Button>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span className="zt-eyebrow">Personal allowances</span><span style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {allowances.map((b) => <ZHQAllowanceCard key={b.who} b={b} />)}
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span className="zt-eyebrow">Shared household budgets</span><span style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />
        </div>
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 36px' }}>
            {shared.map((b) => {
              const left = b.limit - b.spent;
              const over = left < 0;
              const near = !over && left / b.limit <= 0.15;
              return (
                <BudgetRow key={b.name} name={b.name} value={b.spent} max={b.limit}
                  left={<Icon name={b.icon} size={15} style={{ color: 'var(--text-tertiary)' }} />}
                  right={<span className="zt-num" style={{ fontSize: 13.5, color: over ? 'var(--negative)' : near ? 'var(--warning)' : 'var(--text-secondary)' }}>{over ? `$${Math.abs(left)} over` : `$${left} left`}</span>}
                  caption={`$${b.spent} of $${b.limit}`} />
              );
            })}
          </div>
        </Card>
      </div>

      {modal ? <ZHQBudgetModal onClose={() => setModal(false)} /> : null}
    </div>
  );
}

Object.assign(window, { ZHQBudgets });
