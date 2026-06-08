import React from 'react';
/* Allocations — the priority-ordered waterfall rule builder + live preview. */
function ZHQAllocations({ onNavigate }) {
  const { Card, Icon, Button, SegmentedControl, SectionHeader } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  const [amount, setAmount] = React.useState(4000);

  // compute the waterfall split in priority order
  const split = React.useMemo(() => {
    let remaining = amount;
    const rows = D.rules.map((r) => {
      let amt = 0;
      if (r.method === '%') amt = amount * (r.value / 100);
      else if (r.method === 'Fixed') amt = r.value;
      else if (r.method === 'Remainder') amt = Math.max(0, remaining);
      amt = Math.min(amt, Math.max(0, remaining));
      remaining -= amt;
      return { ...r, amt };
    });
    return { rows, remaining };
  }, [amount]);

  const fmt = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}>
      {/* Rule list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div className="zt-eyebrow" style={{ marginBottom: 7 }}>Priority order · top to bottom</div>
            <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>How income gets split</h2>
          </div>
          <Button variant="secondary" size="sm" iconLeft={<Icon name="plus" size={15} />}>New rule</Button>
        </div>

        {split.rows.map((r, i) => (
          <Card key={r.id} padding={16} bordered>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: 'var(--text-tertiary)', cursor: 'grab' }}>
                <Icon name="moreHorizontal" size={14} style={{ transform: 'rotate(90deg)' }} />
              </span>
              <span style={{ width: 22, height: 22, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: 'var(--surface-raised)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }} className="zt-num">{i + 1}</span>
              <span style={{ width: 36, height: 36, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}>
                <Icon name={r.icon} size={17} />
              </span>

              <div style={{ minWidth: 120, flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  Main Checking <Icon name="arrowRight" size={12} /> {r.dest}
                </div>
              </div>

              <SegmentedControl options={['%', 'Fixed', 'Remainder']} defaultValue={r.method} size="sm" />

              <div style={{ width: 92, flex: 'none', textAlign: 'right' }}>
                {r.method === 'Remainder'
                  ? <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>—</span>
                  : <span className="zt-num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{r.method === '%' ? r.value + '%' : '$' + r.value}</span>}
              </div>
            </div>
          </Card>
        ))}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-tertiary)', fontSize: 12.5, padding: '2px 4px' }}>
          <Icon name="allocations" size={15} /> Rules run top-to-bottom — each takes its cut before the next. Remainder sweeps what's left.
        </div>
      </div>

      {/* Sticky live preview */}
      <div style={{ position: 'sticky', top: 0 }}>
        <Card padding={20} style={{ boxShadow: 'var(--shadow-lg)' }}>
          <div className="zt-eyebrow" style={{ marginBottom: 12 }}>Live preview</div>
          <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 8 }}>If this income arrives →</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface-sunken)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-sm)', marginBottom: 16 }}>
            <span style={{ fontSize: 20, color: 'var(--text-tertiary)' }}>$</span>
            <input type="text" inputMode="numeric" value={amount.toLocaleString('en-US')}
              onChange={(e) => { const v = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10); setAmount(isNaN(v) ? 0 : v); }}
              className="zt-num"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', width: '100%' }} />
            <span style={{ display: 'flex', gap: 4 }}>
              {[2000, 4000, 6000].map((v) => (
                <button key={v} onClick={() => setAmount(v)} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: amount === v ? 'var(--text-on-accent)' : 'var(--text-secondary)', background: amount === v ? 'var(--accent)' : 'var(--surface-raised)', border: 'none', borderRadius: 999, padding: '3px 7px', cursor: 'pointer' }}>{v / 1000}k</button>
              ))}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {split.rows.map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border-hairline)' }}>
                <Icon name={r.icon} size={15} style={{ color: 'var(--text-tertiary)' }} />
                <span style={{ flex: 1, fontSize: 13.5, color: 'var(--text-primary)' }}>{r.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{r.method === '%' ? r.value + '%' : r.method === 'Remainder' ? 'rem' : 'fixed'}</span>
                <span className="zt-num" style={{ fontSize: 14, fontWeight: 600, color: r.amt > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)', width: 86, textAlign: 'right' }}>{fmt(r.amt)}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: split.remaining === 0 ? 'var(--green-tint)' : 'var(--amber-tint)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 600, color: split.remaining === 0 ? 'var(--accent)' : 'var(--warning)' }}>
              <Icon name={split.remaining === 0 ? 'check' : 'alert'} size={16} />
              {split.remaining === 0 ? 'Fully allocated' : 'Unallocated'}
            </span>
            <span className="zt-num" style={{ fontSize: 15, fontWeight: 600, color: split.remaining === 0 ? 'var(--accent)' : 'var(--warning)' }}>{fmt(split.remaining)}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

Object.assign(window, { ZHQAllocations });
