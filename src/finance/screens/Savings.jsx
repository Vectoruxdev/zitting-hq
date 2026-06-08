import React from 'react';
/* Savings — goal cards with progress rings, funded by allocations. */
function ZHQGoalCard({ g }) {
  const { Card, Icon, Button, DonutChart } = window.ZittingHQDesignSystem_c9e528;
  const pct = Math.round((g.saved / g.target) * 100);
  const money = (n) => '$' + n.toLocaleString('en-US');
  return (
    <Card padding={22}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <DonutChart size={92} thickness={9} gap={0}
          segments={[{ value: g.saved, color: 'var(--accent)' }, { value: Math.max(0, g.target - g.saved), color: 'var(--surface-raised)' }]}
          centervalue={<span style={{ fontSize: 18 }}>{pct}%</span>} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{g.name}</div>
          <div className="zt-num" style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{money(g.saved)} <span style={{ color: 'var(--text-tertiary)' }}>of {money(g.target)}</span></div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 9, fontSize: 12, color: 'var(--text-tertiary)' }}>
            <Icon name="calendar" size={13} /> {g.date}
            <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--text-tertiary)' }} />
            <Icon name="bank" size={13} /> {g.account}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border-hairline)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--text-secondary)' }}>
          <Icon name="allocations" size={14} style={{ color: 'var(--accent)' }} /> <span className="zt-num">${g.contrib}/mo</span> from allocations
        </span>
        <Button variant="ghost" size="sm" iconRight={<Icon name="chevronRight" size={14} />}>Manage</Button>
      </div>
    </Card>
  );
}

function ZHQSavings() {
  const { Button, Icon, StatTile } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  const totalSaved = D.goals.reduce((s, g) => s + g.saved, 0);
  const totalContrib = D.goals.reduce((s, g) => s + g.contrib, 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', gap: 40 }}>
          <StatTile label="Saved across goals" value={'$' + totalSaved.toLocaleString('en-US')} accent />
          <StatTile label="Monthly contributions" value={'$' + totalContrib.toLocaleString('en-US')} sub="from allocations" />
          <StatTile label="Active goals" value={String(D.goals.length)} />
        </div>
        <Button variant="primary" iconLeft={<Icon name="plus" size={16} />} style={{ flex: 'none' }}>New goal</Button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        {D.goals.map((g) => <ZHQGoalCard key={g.id} g={g} />)}
      </div>
    </div>
  );
}

Object.assign(window, { ZHQSavings });
