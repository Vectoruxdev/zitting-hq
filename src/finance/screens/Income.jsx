import React from 'react';
/* Income — combined trend + income streams with sparklines and status. */
function ZHQIncome() {
  const { Card, SectionHeader, Button, Icon, Badge, AreaChart, Sparkline, StatTile } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  const streams = D.incomeStreams;
  const totalMonthly = streams.reduce((s, x) => s + x.monthly, 0);
  const money = (n) => '$' + n.toLocaleString('en-US');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Card padding={24}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 8 }}>
          <div>
            <div className="zt-eyebrow" style={{ marginBottom: 8 }}>Total monthly income</div>
            <div className="zt-num" style={{ fontSize: 44, fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>{money(totalMonthly)}</div>
          </div>
          <div style={{ display: 'flex', gap: 36 }}>
            <StatTile label="Streams" value={String(streams.length)} size="sm" />
            <StatTile label="Expected next" value="$1,100" sub="Basement rental · Jun 3" size="sm" />
            <StatTile label="Received this month" value="$9,250" delta={{ value: 650, percent: 7 }} size="sm" />
          </div>
        </div>
        <AreaChart data={D.trend.income} labels={D.trend.labels} height={200} />
      </Card>

      <div>
        <SectionHeader title="Income streams" action={<Button variant="secondary" size="sm" iconLeft={<Icon name="plus" size={14} />}>Add stream</Button>} />
        <Card padding={6}>
          {streams.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '15px 16px', borderBottom: i === streams.length - 1 ? 'none' : '1px solid var(--border-hairline)', cursor: 'pointer' }}>
              <span style={{ width: 40, height: 40, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: 'var(--surface-raised)', color: s.status === 'late' ? 'var(--warning)' : 'var(--accent)' }}>
                <Icon name={s.status === 'late' ? 'clock' : 'trendingUp'} size={18} />
              </span>
              <div style={{ minWidth: 160, flex: '1 1 160px' }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{s.sub}</div>
              </div>
              <Badge tone="neutral" size="sm">{s.cadence}</Badge>
              <Sparkline data={s.spark} width={96} height={30} area />
              <div style={{ width: 120, textAlign: 'right' }}>
                <div className="zt-num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{money(s.monthly)}<span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>/mo</span></div>
                {s.status === 'late'
                  ? <div style={{ fontSize: 11.5, color: 'var(--warning)', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 2 }}><Icon name="alert" size={12} />Late · exp. {s.next}</div>
                  : <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>Last {s.last} · next {s.next}</div>}
              </div>
              <Icon name="chevronRight" size={16} style={{ color: 'var(--text-tertiary)' }} />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

Object.assign(window, { ZHQIncome });
