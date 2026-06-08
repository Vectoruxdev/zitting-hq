import React from 'react';
/* Receipts — desktop inbox + mobile capture flow (camera → extracting → review). */
function ZHQCaptureFlow() {
  const { Icon, Button, DataTable } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  const steps = ['capture', 'extracting', 'review'];
  const [step, setStep] = React.useState(2);
  const total = D.receiptItems.reduce((s, r) => s + r.total, 0);

  return (
    <window.ZHQPhoneFrame>
      <div style={{ height: 762, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 20px 12px' }}>
          <Icon name="x" size={22} style={{ color: 'var(--text-secondary)' }} />
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Add receipt</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>{steps.map((s, i) => <span key={s} style={{ width: 22, height: 4, borderRadius: 999, background: i <= step ? 'var(--accent)' : 'var(--surface-raised)' }} />)}</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px' }}>
          {step === 0 ? (
            <div style={{ height: 440, borderRadius: 20, background: 'var(--surface-sunken)', border: '1px solid var(--border-hairline)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: 'var(--text-tertiary)' }}>
              <Icon name="camera" size={40} /><span style={{ fontSize: 13 }}>Point at your receipt</span>
            </div>
          ) : step === 1 ? (
            <div style={{ height: 440, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <span style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="sparkles" size={26} /></span>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Extracting line items…</div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Reading 6 items from Harmons</div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 58, height: 74, flex: 'none', borderRadius: 10, background: 'var(--surface-raised)', border: '1px solid var(--border-hairline)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}><Icon name="receipt" size={22} /></div>
                <div><div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Harmons Grocery</div><div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 3 }}>Jun 4 · 6 items</div><div className="zt-num" style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginTop: 6 }}>${total.toFixed(2)}</div></div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>EXTRACTED ITEMS</div>
              {D.receiptItems.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border-hairline)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{r.item} <span style={{ color: 'var(--text-tertiary)' }}>×{r.qty}</span></span>
                  <span className="zt-num" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>${r.total.toFixed(2)}</span>
                </div>
              ))}
              <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="link" size={16} style={{ color: 'var(--accent)' }} />
                <div style={{ flex: 1, fontSize: 12.5, color: 'var(--text-secondary)' }}>Matched to <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>−$84.21 Harmons</span></div>
                <Icon name="check" size={16} style={{ color: 'var(--accent)' }} />
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 'none', padding: '12px 20px 22px' }}>
          <Button variant={step === 2 ? 'accent' : 'primary'} full onClick={() => setStep((step + 1) % 3)}>
            {step === 0 ? 'Capture' : step === 1 ? 'Cancel' : 'Attach receipt'}
          </Button>
        </div>
      </div>
    </window.ZHQPhoneFrame>
  );
}

function ZHQReceipts() {
  const { Card, Button, Icon, Badge } = window.ZittingHQDesignSystem_c9e528;
  const inbox = [
    { merchant: 'Harmons Grocery', total: 35.21, items: 6, matched: true, who: 'Sarah' },
    { merchant: 'Costco', total: 248.10, items: 14, matched: true, who: 'Jared' },
    { merchant: 'Target', total: 36.40, items: 4, matched: false, who: 'Sarah' },
    { merchant: "Lowe's", total: 92.66, items: 7, matched: true, who: 'Jared' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 392px', gap: 26, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="zt-eyebrow">Receipt inbox · 4 this month</div>
          <Button variant="secondary" size="sm" iconLeft={<Icon name="camera" size={14} />}>Capture on phone</Button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {inbox.map((r, i) => (
            <Card key={i} interactive bordered padding={16}>
              <div style={{ display: 'flex', gap: 13 }}>
                <div style={{ width: 52, height: 66, flex: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--surface-raised)', border: '1px solid var(--border-hairline)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}><Icon name="receipt" size={20} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{r.merchant}</div>
                  <div className="zt-num" style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>${r.total.toFixed(2)}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>{r.items} items · {r.who}</div>
                  <div style={{ marginTop: 9 }}>{r.matched ? <Badge tone="positive" size="sm" dot>Matched</Badge> : <Badge status="pending" size="sm" dot>Needs match</Badge>}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
      <ZHQCaptureFlow />
    </div>
  );
}

Object.assign(window, { ZHQReceipts, ZHQCaptureFlow });
