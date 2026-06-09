import React from 'react';
/* Transfers — the signature reconciliation dashboard. */
function ZHQTransfers({ onNavigate }) {
  const { Card, Icon, Button, Tabs, ChecklistRow, Badge, EmptyState } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  const upcoming = D.upcoming || [];
  const past = D.past || [];
  const [tab, setTab] = React.useState('upcoming');
  const [sent, setSent] = React.useState(() => upcoming.map((t) => t.state !== 'todo'));

  const doneCount = sent.filter(Boolean).length;
  const total = upcoming.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  if (!upcoming.length && !past.length) {
    return <EmptyState icon="transfers" title="No transfers to make" body="When income arrives, your allocation rules generate a checklist of transfers to move money to tithing, bills, savings, and allowances." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Progress header */}
      <Card padding={24}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <span style={{ width: 46, height: 46, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)', background: 'var(--green-tint)', color: 'var(--accent)' }}>
            <Icon name="transfers" size={24} />
          </span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="zt-eyebrow" style={{ marginBottom: 6 }}>Transfers to make</div>
            <div className="zt-num" style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>{doneCount} of {total} done</div>
          </div>
          <div style={{ width: 220, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 6, background: 'var(--surface-sunken)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: pct + '%', height: '100%', background: 'var(--accent)', borderRadius: 999, transition: 'width var(--dur-slow) var(--ease-out)' }} />
            </div>
            <span className="zt-num" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{pct}%</span>
          </div>
        </div>
      </Card>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <Tabs options={[{ value: 'upcoming', label: 'Upcoming', badge: (total - doneCount) || undefined }, { value: 'past', label: 'Past' }]} value={tab} onChange={setTab} style={{ flex: 1 }} />
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
