import React from 'react';
/* Spendable — the member (wife) mobile home: "how much can I spend". */
function ZHQPhoneFrame({ children }) {
  return (
    <div style={{
      width: 392, height: 812, flex: 'none', position: 'relative',
      background: 'var(--bg-app)', borderRadius: 46,
      border: '1px solid var(--border-shell)',
      boxShadow: '0 0 0 10px #000, var(--shadow-pop)',
      overflow: 'hidden',
    }}>
      {/* status bar */}
      <div style={{ height: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px 0 34px', position: 'relative', zIndex: 2 }}>
        <span className="zt-num" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>9:41</span>
        <div style={{ position: 'absolute', left: '50%', top: 12, transform: 'translateX(-50%)', width: 108, height: 26, background: '#000', borderRadius: 999 }} />
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', color: 'var(--text-primary)' }}>
          <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor"><rect x="0" y="6" width="3" height="5" rx="1"/><rect x="4.5" y="4" width="3" height="7" rx="1"/><rect x="9" y="2" width="3" height="9" rx="1"/><rect x="13.5" y="0" width="3" height="11" rx="1"/></svg>
          <svg width="24" height="12" viewBox="0 0 24 12" fill="none"><rect x="1" y="1" width="20" height="10" rx="3" stroke="currentColor" opacity="0.5"/><rect x="3" y="3" width="15" height="6" rx="1.5" fill="currentColor"/><rect x="22" y="4" width="1.5" height="4" rx="0.75" fill="currentColor" opacity="0.5"/></svg>
        </span>
      </div>
      {children}
    </div>
  );
}

function ZHQSpendable() {
  const { Icon, Avatar, ProgressBar } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA || {};
  const user = window.ZHQ_USER || {};
  const name = user.name || 'there';

  // Their personal allowance budget, if one is set; else month-to-date spend.
  const budgets = D.budgets || [];
  const allowance = budgets.find((b) => b.who && b.who.toLowerCase() === String(name).toLowerCase());
  const shared = budgets.filter((b) => !b.who);
  const myTxns = (D.txns || []).filter((t) => t.who && t.who.toLowerCase() === String(name).toLowerCase() && !t.income);
  const spentThisView = myTxns.reduce((s, t) => s + Math.abs(t.amt), 0);

  const hasAllowance = !!allowance;
  const left = hasAllowance ? allowance.limit - allowance.spent : 0;

  const tabs = [
    { icon: 'wallet', label: 'Spendable', on: true },
    { icon: 'pie', label: 'Budgets' },
    { icon: 'camera', label: 'Add' },
    { icon: 'sparkles', label: 'Ask' },
  ];

  return (
    <ZHQPhoneFrame>
      <div style={{ height: 762, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 20px' }}>
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
            <Avatar name={name} size="md" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Welcome back</div>
              <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</div>
            </div>
          </div>

          {/* hero */}
          {hasAllowance ? (
            <div style={{ textAlign: 'center', padding: '14px 0 26px' }}>
              <div className="zt-eyebrow" style={{ marginBottom: 14 }}>You have left to spend</div>
              <div className="zt-num" style={{ fontSize: 64, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1, color: left < 0 ? 'var(--negative)' : 'var(--accent)' }}>${Math.abs(left)}</div>
              <div style={{ marginTop: 18, padding: '0 8px' }}>
                <ProgressBar value={allowance.spent} max={allowance.limit} height={10} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12.5, color: 'var(--text-secondary)' }} className="zt-num">
                <span>${allowance.spent} spent</span>
                <span>${allowance.limit}/mo</span>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '14px 0 26px' }}>
              <div className="zt-eyebrow" style={{ marginBottom: 14 }}>Spent this month</div>
              <div className="zt-num" style={{ fontSize: 56, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1, color: 'var(--text-primary)' }}>${Math.round(spentThisView).toLocaleString('en-US')}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 12 }}>No spending limit set yet.</div>
            </div>
          )}

          {/* shared budgets */}
          {shared.length ? (
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Shared budgets</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {shared.map((b, i) => {
                  const bl = b.limit - b.spent;
                  return (
                    <div key={i} style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', padding: 15 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{b.name}</span>
                        <span className="zt-num" style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', color: bl <= b.limit * 0.15 ? 'var(--warning)' : 'var(--text-primary)' }}>${bl} left</span>
                      </div>
                      <ProgressBar value={b.spent} max={b.limit} height={7} />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* recent */}
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Your recent</div>
            {myTxns.length ? (
              <div>
                {myTxns.slice(0, 12).map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: i === Math.min(myTxns.length, 12) - 1 ? 'none' : '1px solid var(--border-hairline)' }}>
                    <span style={{ width: 38, height: 38, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 11, background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}><Icon name="receipt" size={17} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.merchant}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{t.date} · {t.cat}</div>
                    </div>
                    <span className="zt-num" style={{ fontSize: 14.5, fontWeight: 500, color: 'var(--text-primary)' }}>−${Math.abs(t.amt).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '20px 0', fontSize: 13, color: 'var(--text-tertiary)' }}>No transactions assigned to you yet.</div>
            )}
          </div>
        </div>

        {/* bottom tab bar */}
        <div style={{ flex: 'none', height: 78, borderTop: '1px solid var(--border-hairline)', background: 'var(--bg-app)', display: 'flex', padding: '10px 16px 0' }}>
          {tabs.map((t, i) => (
            <button key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: t.on ? 'var(--accent)' : 'var(--text-tertiary)' }}>
              {t.label === 'Add'
                ? <span style={{ width: 40, height: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: 'var(--accent)', color: 'var(--text-on-accent)', marginTop: -4 }}><Icon name={t.icon} size={20} /></span>
                : <Icon name={t.icon} size={22} />}
              <span style={{ fontSize: 10.5, fontWeight: t.on ? 600 : 500 }}>{t.label}</span>
            </button>
          ))}
        </div>
        <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', width: 134, height: 5, background: 'var(--paper-200)', opacity: 0.4, borderRadius: 999 }} />
      </div>
    </ZHQPhoneFrame>
  );
}

Object.assign(window, { ZHQSpendable, ZHQPhoneFrame });
