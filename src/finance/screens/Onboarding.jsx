import React from 'react';
/* Onboarding — welcoming first-run flow. */
function ZHQOnboarding({ onDone }) {
  const { Icon, Button } = window.ZittingHQDesignSystem_c9e528;
  const [done, setDone] = React.useState([false, false, false]);
  const steps = [
    { icon: 'wallet', title: 'Connect your first account', body: 'Securely link a bank or card so we can see balances and transactions.', cta: 'Connect account' },
    { icon: 'allocations', title: 'Set up your first allocation', body: 'Tell us how income should split — tithing, bills, allowances, savings.', cta: 'Build a rule' },
    { icon: 'users', title: 'Invite your family', body: 'Give each member their own Spendable view with exactly what they need.', cta: 'Invite member' },
  ];
  const completed = done.filter(Boolean).length;

  return (
    <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: 540 }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <img src="/finance/mark.svg" width="56" height="56" alt="" style={{ borderRadius: 16 }} />
          <h1 className="zt-wordmark" style={{ fontSize: 34, color: 'var(--text-primary)', marginTop: 16 }}>Welcome to Zitting <span style={{ color: 'var(--accent)' }}>HQ</span></h1>
          <p style={{ fontSize: 14.5, color: 'var(--text-secondary)', marginTop: 8 }}>Three steps to give every dollar a job. <span className="zt-num">{completed}/3 done</span></p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', background: 'var(--surface-card)', border: '1px solid', borderColor: done[i] ? 'var(--green-tint)' : 'transparent', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)' }}>
              <span style={{ width: 44, height: 44, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)', background: done[i] ? 'var(--accent)' : 'var(--surface-raised)', color: done[i] ? 'var(--text-on-accent)' : 'var(--text-secondary)' }}>
                <Icon name={done[i] ? 'check' : s.icon} size={20} />
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{s.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>{s.body}</div>
              </div>
              <Button variant={done[i] ? 'ghost' : 'secondary'} size="sm" onClick={() => setDone((d) => d.map((v, j) => j === i ? true : v))}>
                {done[i] ? 'Done' : s.cta}
              </Button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
          <Button variant="primary" onClick={onDone} iconRight={<Icon name="arrowRight" size={16} />}>{completed === 3 ? 'Enter Zitting HQ' : 'Skip for now'}</Button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ZHQOnboarding });
