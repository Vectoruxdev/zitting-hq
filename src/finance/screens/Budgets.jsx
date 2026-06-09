import React from 'react';
/* Budgets — personal allowances + shared category budgets. */
function ZHQAllowanceCard({ b }) {
  const { Card, Avatar, ProgressBar } = window.ZittingHQDesignSystem_c9e528;
  const left = b.limit - b.spent;
  const over = left < 0;
  const near = !over && left / b.limit <= 0.15;
  return (
    <Card padding={20}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 18 }}>
        <Avatar name={b.who} size="md" />
        <div><div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>{b.who}</div><div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>${b.limit}/mo</div></div>
      </div>
      <div className="zt-eyebrow" style={{ marginBottom: 7 }}>{over ? 'Over by' : 'Remaining'}</div>
      <div className="zt-num" style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.03em', color: over ? 'var(--negative)' : near ? 'var(--warning)' : 'var(--accent)' }}>{over ? '−' : ''}${Math.abs(left)}</div>
      <div style={{ margin: '16px 0 9px' }}><ProgressBar value={b.spent} max={b.limit} /></div>
      <div className="zt-num" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>${b.spent} spent of ${b.limit}</div>
    </Card>
  );
}

function ZHQBudgets() {
  const { Card, Icon, BudgetRow, EmptyState } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  const budgets = D.budgets || [];
  const allowances = budgets.filter((b) => b.who);
  const shared = budgets.filter((b) => !b.who);

  if (!budgets.length) {
    return <EmptyState icon="pie" title="No budgets yet" body="Set monthly spending limits for each person and category. Budgeting is coming soon — your spending already rolls up on the Overview and Categories screens." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      {allowances.length ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span className="zt-eyebrow">Personal allowances</span><span style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {allowances.map((b) => <ZHQAllowanceCard key={b.name} b={b} />)}
          </div>
        </div>
      ) : null}

      {shared.length ? (
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
                    left={<Icon name={b.icon || 'pie'} size={15} style={{ color: 'var(--text-tertiary)' }} />}
                    right={<span className="zt-num" style={{ fontSize: 13.5, color: over ? 'var(--negative)' : near ? 'var(--warning)' : 'var(--text-secondary)' }}>{over ? `$${Math.abs(left)} over` : `$${left} left`}</span>}
                    caption={`$${b.spent} of $${b.limit}`} />
                );
              })}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

Object.assign(window, { ZHQBudgets });
