import React from 'react';
/* Transfers — the signature reconciliation dashboard. */
function ZHQTransfers({ onNavigate }) {
  const { Card, Icon, Button, Tabs, ChecklistRow, Badge } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  const [tab, setTab] = React.useState('upcoming');
  const [sent, setSent] = React.useState(() => D.upcoming.map((t) => t.state !== 'todo'));

  const doneCount = sent.filter(Boolean).length;
  const total = D.upcoming.length;
  const pct = Math.round((doneCount / total) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Trigger header */}
      <Card padding={24} style={{ background: 'var(--surface-card)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
          <span style={{ width: 46, height: 46, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)', background: 'var(--green-tint)', color: 'var(--accent)' }}>
            <Icon name="arrowDownRight" size={24} />
          </span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="zt-eyebrow" style={{ marginBottom: 6 }}>Income received · Jun 1 · Main Checking</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span className="zt-num" style={{ fontSize: 38, fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>$4,000.00</span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>from ADP Payroll</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, minWidth: 220 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="check" size={16} style={{ color: 'var(--accent)' }} />
              <span className="zt-num" style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>Allocated $4,000 of $4,000</span>
            </div>
            <div style={{ width: 220, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 6, background: 'var(--surface-sunken)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: pct + '%', height: '100%', background: 'var(--accent)', borderRadius: 999, transition: 'width var(--dur-slow) var(--ease-out)' }} />
              </div>
              <span className="zt-num" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{doneCount} of {total} done</span>
            </div>
          </div>
        </div>
      </Card>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <Tabs options={[{ value: 'upcoming', label: 'Upcoming', badge: total - doneCount }, { value: 'past', label: 'Past' }]} value={tab} onChange={setTab} style={{ flex: 1 }} />
      </div>

      {tab === 'upcoming' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Every dollar has a job. Here's what to move.</span>
            <Button variant="accent" size="sm" iconLeft={<Icon name="check" size={15} />} onClick={() => setSent(D.upcoming.map(() => true))}>Mark all sent</Button>
          </div>
          {D.upcoming.map((t, i) => (
            <ChecklistRow key={i} to={t.to} from={t.from} amount={t.amount} due={t.due} icon={t.icon}
              state={t.state === 'auto' ? 'auto' : sent[i] ? 'done' : 'todo'}
              onToggle={() => setSent((s) => s.map((v, j) => (j === i ? !v : v)))} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>May 2026 · all reconciled</span>
          {D.past.map((t, i) => (
            <ChecklistRow key={i} {...t} />
          ))}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { ZHQTransfers });
