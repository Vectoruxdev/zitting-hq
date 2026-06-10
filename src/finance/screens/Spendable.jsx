import React from 'react';
/* Spendable — the member mobile home: allowance status + categorize tasks for
   the accounts they're in charge of. Driven by D.memberHome (server-computed). */
function ZHQPhoneFrame({ children }) {
  return (
    <div className="zhq-phone-frame" style={{
      width: 392, height: 812, flex: 'none', position: 'relative',
      background: 'var(--bg-app)', borderRadius: 46,
      border: '1px solid var(--border-shell)',
      boxShadow: '0 0 0 10px #000, var(--shadow-pop)',
      overflow: 'hidden',
    }}>
      {/* status bar */}
      <div className="zhq-phone-statusbar" style={{ height: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px 0 34px', position: 'relative', zIndex: 2 }}>
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

// Category picker bottom-sheet for the member categorize flow.
function MemberCategoryPicker({ onPick, onClose }) {
  const { Modal } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA || {};
  const groups = D.categoryGroups || [];
  const cats = (D.allCategories || []).filter((c) => c.id !== 'uncategorized');
  const byGroup = groups.map((g) => ({ g, items: cats.filter((c) => c.groupId === g.id) })).filter((x) => x.items.length);
  const ungrouped = cats.filter((c) => !groups.some((g) => g.id === c.groupId));
  return (
    <Modal open onClose={onClose} title="Pick a category" width={380}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 440, overflowY: 'auto' }}>
        {[...byGroup, ...(ungrouped.length ? [{ g: { id: '_', name: 'Other' }, items: ungrouped }] : [])].map(({ g, items }) => (
          <div key={g.id}>
            <div className="zt-eyebrow" style={{ marginBottom: 8 }}>{g.name}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {items.map((c) => (
                <button key={c.id} onClick={() => onPick(c.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 12px', borderRadius: 999, border: '1px solid var(--border-hairline)', background: 'var(--surface-card)', cursor: 'pointer', font: 'inherit', fontSize: 13, color: 'var(--text-primary)' }}>
                  <span style={{ width: 9, height: 9, borderRadius: 999, background: c.color || 'var(--gray-500)' }} />
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function ZHQSpendable() {
  const { Icon, Avatar, ProgressBar, Button, Badge, Tag } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA || {};
  const user = window.ZHQ_USER || {};
  const API = window.ZHQ_API || {};
  const H = D.memberHome || null;
  const name = (H && H.name) || user.name || 'there';

  const [tab, setTab] = React.useState('home');
  const [picker, setPicker] = React.useState(null); // txn id being categorized
  const [busy, setBusy] = React.useState(null); // txn id mid-action

  async function run(id, fn) {
    setBusy(id);
    try { await fn(); window.ZHQ_REFRESH && window.ZHQ_REFRESH(); }
    finally { setBusy(null); }
  }
  const pickCategory = (id, categoryId) => run(id, () => API.updateTransaction(id, { categoryId }, { learn: true }));
  const confirmOne = (id) => run(id, () => API.confirmTransactions([id]));
  const markTransfer = (id) => run(id, () => API.markTransfer(id, true));

  const accounts = (H && H.managedAccounts) || [];
  const queue = (H && H.reviewQueue) || [];
  const allowance = H ? H.allowance : 0;
  const unlocked = H ? H.allowanceUnlocked : true;

  const tabs = [
    { key: 'home', icon: 'wallet', label: 'Home' },
    { key: 'categorize', icon: 'list', label: 'Categorize', badge: H ? H.totalRemaining : 0 },
  ];

  return (
    <ZHQPhoneFrame>
      <div style={{ height: 762, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 20px' }}>
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <Avatar name={name} size="md" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Welcome back</div>
              <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</div>
            </div>
          </div>

          {!H ? (
            <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13.5, lineHeight: 1.6 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>No member to show yet</div>
              Add a person on the <strong>Access &amp; permissions</strong> screen, then assign them an account to manage. Their Spendable view appears here.
            </div>
          ) : tab === 'home' ? (
            <>
              {/* allowance status */}
              <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', padding: 20, marginBottom: 20, border: `1px solid ${allowance > 0 ? (unlocked ? 'var(--green-tint)' : 'var(--border-hairline)') : 'var(--border-hairline)'}` }}>
                <div className="zt-eyebrow" style={{ marginBottom: 10 }}>Monthly allowance</div>
                {allowance > 0 ? (
                  <>
                    <div className="zt-num" style={{ fontSize: 44, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1, color: unlocked ? 'var(--accent)' : 'var(--text-primary)' }}>{H.allowanceLabel}<span style={{ fontSize: 15, color: 'var(--text-tertiary)', fontWeight: 500 }}>/mo</span></div>
                    <div style={{ marginTop: 14 }}>
                      {unlocked ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
                          <Icon name="check" size={15} /> Unlocked for {H.monthLabel}
                        </span>
                      ) : (
                        <div>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--warning)', fontWeight: 600 }}>
                            <Icon name="clock" size={15} /> Locked — {H.prevMonthRemaining} to review in {H.prevMonthLabel}
                          </span>
                          <div style={{ marginTop: 12 }}>
                            <Button variant="primary" size="sm" onClick={() => setTab('categorize')}>Finish {H.prevMonthLabel} →</Button>
                          </div>
                        </div>
                      )}
                    </div>
                    <p style={{ margin: '14px 0 0', fontSize: 11.5, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                      Your allowance for a month unlocks once you've categorized everything from the month before.
                    </p>
                  </>
                ) : (
                  <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>No allowance set yet. Ask the account owner to set one.</div>
                )}
              </div>

              {/* accounts you manage */}
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Accounts you manage</div>
              {accounts.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {accounts.map((a) => (
                    <div key={a.id} style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', padding: 15 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{a.name}</span>
                        {a.done ? <Badge tone="positive" size="sm">Done</Badge>
                          : a.total === 0 ? <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>nothing yet</span>
                          : <span className="zt-num" style={{ fontSize: 12.5, color: 'var(--warning)', fontWeight: 600 }}>{a.remaining} left</span>}
                      </div>
                      <ProgressBar value={a.reviewed} max={Math.max(a.total, 1)} height={7} />
                      <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 8 }}>{a.reviewed}/{a.total} reviewed in {H.monthLabel}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '18px 0', fontSize: 13, color: 'var(--text-tertiary)' }}>You're not in charge of any accounts yet. Ask the account owner to add you.</div>
              )}

              {/* your goals (read-only; already visibility-filtered server-side) */}
              {(D.goals || []).filter((g) => !g.archived).length ? (
                <div style={{ marginTop: 22 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Your goals</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {(D.goals || []).filter((g) => !g.archived).map((g) => (
                      <div key={g.id} style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', padding: 15 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', minWidth: 0 }}>
                            <span style={{ fontSize: 16, flex: 'none' }}>{g.icon || '🎯'}</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                          </span>
                          <span className="zt-num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', flex: 'none' }}>{g.pct != null ? g.pct : 0}%</span>
                        </div>
                        <ProgressBar value={g.saved} max={Math.max(g.target, 1)} height={7} />
                        <div className="zt-num" style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 8 }}>${Math.round(g.saved).toLocaleString('en-US')} of ${Math.round(g.target).toLocaleString('en-US')}{g.date ? ` · ${g.date}` : ''}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {window.ZHQPushPrompt ? <div style={{ marginTop: 20 }}><window.ZHQPushPrompt compact /></div> : null}
            </>
          ) : (
            /* ---- Categorize tab ---- */
            <>
              {queue.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 10px' }}>
                  <span style={{ display: 'inline-flex', width: 56, height: 56, borderRadius: 999, placeItems: 'center', background: 'var(--green-glow)', color: 'var(--accent)', marginBottom: 14 }}><Icon name="check" size={26} /></span>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>All caught up</div>
                  <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 6 }}>You've reviewed everything for {H.monthLabel}.</div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 14 }}>
                    <b style={{ color: 'var(--text-primary)' }}>{queue.length}</b> transaction{queue.length === 1 ? '' : 's'} to review. Tap the category to set it, or confirm the suggestion.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {queue.map((t) => (
                      <div key={t.id} style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', padding: 14, opacity: busy === t.id ? 0.5 : 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.merchant}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{t.date} · {t.account}</div>
                          </div>
                          <span className="zt-num" style={{ fontSize: 15, fontWeight: 600, color: t.amt >= 0 ? 'var(--accent)' : 'var(--text-primary)' }}>{t.amt >= 0 ? '+' : '−'}${Math.abs(t.amt).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <button onClick={() => setPicker(t.id)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                            <Tag color={t.color} size="sm">{t.cat} ✎</Tag>
                          </button>
                          <span style={{ flex: 1 }} />
                          <Button variant="ghost" size="sm" onClick={() => markTransfer(t.id)} disabled={busy === t.id}>Transfer</Button>
                          <Button variant="primary" size="sm" onClick={() => confirmOne(t.id)} disabled={busy === t.id}>Confirm</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* bottom tab bar */}
        <div style={{ flex: 'none', height: 78, borderTop: '1px solid var(--border-hairline)', background: 'var(--bg-app)', display: 'flex', padding: '10px 16px 0' }}>
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: tab === t.key ? 'var(--accent)' : 'var(--text-tertiary)', position: 'relative' }}>
              <span style={{ position: 'relative' }}>
                <Icon name={t.icon} size={22} />
                {t.badge ? <span style={{ position: 'absolute', top: -4, right: -8, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: 'var(--warning)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{t.badge}</span> : null}
              </span>
              <span style={{ fontSize: 10.5, fontWeight: tab === t.key ? 600 : 500 }}>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="zhq-phone-home" style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', width: 134, height: 5, background: 'var(--paper-200)', opacity: 0.4, borderRadius: 999 }} />
      </div>

      {picker != null ? (
        <MemberCategoryPicker
          onClose={() => setPicker(null)}
          onPick={(categoryId) => { const id = picker; setPicker(null); pickCategory(id, categoryId); }}
        />
      ) : null}
    </ZHQPhoneFrame>
  );
}

Object.assign(window, { ZHQSpendable, ZHQPhoneFrame });
