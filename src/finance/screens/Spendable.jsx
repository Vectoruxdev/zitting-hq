import React from 'react';
/* Spendable — the member mobile experience: their spending money, the accounts
   they manage (with balances), savings, a browsable activity feed, and a
   finger-friendly categorize flow. Driven by D.memberHome (server-computed).
   Rendered inside a phone mockup on desktop (owner preview) and full-bleed on
   a real phone (see globals.css .zhq-phone-frame @media). */
function ZHQPhoneFrame({ children }) {
  return (
    <div className="zhq-phone-frame" style={{
      width: 392, height: 812, flex: 'none', position: 'relative',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-app)', borderRadius: 46,
      border: '1px solid var(--border-shell)',
      boxShadow: '0 0 0 10px #000, var(--shadow-pop)',
      overflow: 'hidden',
    }}>
      {/* status bar */}
      <div className="zhq-phone-statusbar" style={{ flex: 'none', height: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px 0 34px', position: 'relative', zIndex: 2 }}>
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

// Category picker bottom-sheet for the member categorize flow. Big tappable
// chips, grouped, scrollable — easy to hit with a thumb.
function MemberCategoryPicker({ onPick, onClose }) {
  const { Modal } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA || {};
  const groups = D.categoryGroups || [];
  const cats = (D.allCategories || []).filter((c) => c.id !== 'uncategorized');
  const byGroup = groups.map((g) => ({ g, items: cats.filter((c) => c.groupId === g.id) })).filter((x) => x.items.length);
  const ungrouped = cats.filter((c) => !groups.some((g) => g.id === c.groupId));
  return (
    <Modal open onClose={onClose} title="Pick a category" width={380}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxHeight: '60vh', overflowY: 'auto' }}>
        {[...byGroup, ...(ungrouped.length ? [{ g: { id: '_', name: 'Other' }, items: ungrouped }] : [])].map(({ g, items }) => (
          <div key={g.id}>
            <div className="zt-eyebrow" style={{ marginBottom: 10 }}>{g.name}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
              {items.map((c) => (
                <button key={c.id} onClick={() => onPick(c.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 15px', borderRadius: 999, border: '1px solid var(--border-hairline)', background: 'var(--surface-card)', cursor: 'pointer', font: 'inherit', fontSize: 14.5, color: 'var(--text-primary)', minHeight: 44 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: c.color || 'var(--gray-500)' }} />
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

// One transaction row. `review` mode shows Transfer + Confirm actions; browse
// mode shows a reviewed checkmark. The category chip is always tappable.
function MemberTxnRow({ t, review, busy, onEditCat, onConfirm, onTransfer }) {
  const { Icon, Button, Tag } = window.ZittingHQDesignSystem_c9e528;
  return (
    <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', padding: 16, opacity: busy ? 0.5 : 1, border: review && !t.reviewed ? '1px solid var(--border-hairline)' : '1px solid transparent' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.merchant}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{t.date} · {t.account}</div>
        </div>
        <span className="zt-num" style={{ fontSize: 17, fontWeight: 700, color: t.amt >= 0 ? 'var(--accent)' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>{t.amt >= 0 ? '+' : '−'}${Math.abs(t.amt).toFixed(2)}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={onEditCat} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', minHeight: 36 }}>
          <Tag color={t.color} size="md">{t.cat} ✎</Tag>
        </button>
        <span style={{ flex: 1 }} />
        {review && !t.reviewed ? (
          <>
            <Button variant="ghost" size="md" onClick={onTransfer} disabled={busy}>Transfer</Button>
            <Button variant="primary" size="md" onClick={onConfirm} disabled={busy}>Confirm</Button>
          </>
        ) : t.reviewed ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--accent)', fontWeight: 600 }}><Icon name="check" size={14} /> Reviewed</span>
        ) : (
          <Button variant="primary" size="md" onClick={onConfirm} disabled={busy}>Confirm</Button>
        )}
      </div>
    </div>
  );
}

function ZHQSpendable() {
  const { Icon, Avatar, ProgressBar, Button, Badge } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA || {};
  const user = window.ZHQ_USER || {};
  const API = window.ZHQ_API || {};
  const H = D.memberHome || null;
  const name = (H && H.name) || user.name || 'there';

  const [tab, setTab] = React.useState('home');
  const [picker, setPicker] = React.useState(null); // txn id being categorized
  const [busy, setBusy] = React.useState(null); // txn id mid-action
  const [acctFilter, setAcctFilter] = React.useState('all'); // Activity account filter

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
  const activity = (H && H.activity) || [];
  const budgets = (H && H.budgets) || [];
  const goals = (D.goals || []).filter((g) => !g.archived);
  const allowance = H ? H.allowance : 0;
  const unlocked = H ? H.allowanceUnlocked : true;

  const filteredActivity = acctFilter === 'all' ? activity : activity.filter((t) => t.accountId === acctFilter);

  const tabs = [
    { key: 'home', icon: 'wallet', label: 'Home' },
    { key: 'activity', icon: 'receipt', label: 'Activity' },
    { key: 'categorize', icon: 'list', label: 'Review', badge: H ? H.totalRemaining : 0 },
  ];

  const sectionTitle = (txt) => (
    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '24px 0 12px' }}>{txt}</div>
  );

  return (
    <ZHQPhoneFrame>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '8px 18px 24px' }}>
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 18px' }}>
            <Avatar name={name} size="md" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Welcome back</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{name}</div>
            </div>
          </div>

          {!H ? (
            <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14, lineHeight: 1.6 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Nothing here yet</div>
              The account owner needs to add you and assign you an account to manage. Once they do, you'll see it here.
            </div>
          ) : tab === 'home' ? (
            /* ============================ HOME ============================ */
            <>
              {/* spending money hero */}
              <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', padding: 22, border: `1px solid ${allowance > 0 && unlocked ? 'var(--green-tint)' : 'var(--border-hairline)'}` }}>
                <div className="zt-eyebrow" style={{ marginBottom: 12 }}>{allowance > 0 ? 'Spending money left' : 'Spent this month'}</div>
                {allowance > 0 ? (
                  <>
                    <div className="zt-num" style={{ fontSize: 46, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: unlocked ? 'var(--accent)' : 'var(--text-primary)' }}>{H.remainingLabel}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 8 }}>{H.spentLabel} spent of {H.allowanceLabel}/mo</div>
                    <div style={{ marginTop: 14 }}>
                      <ProgressBar value={H.spent} max={Math.max(allowance, 1)} height={9} />
                    </div>
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-hairline)' }}>
                      {unlocked ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, color: 'var(--accent)', fontWeight: 600 }}>
                          <Icon name="check" size={16} /> Unlocked for {H.monthLabel}
                        </span>
                      ) : (
                        <div>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, color: 'var(--warning)', fontWeight: 600 }}>
                            <Icon name="clock" size={16} /> Locked — {H.prevMonthRemaining} left to review in {H.prevMonthLabel}
                          </span>
                          <div style={{ marginTop: 12 }}>
                            <Button variant="primary" size="md" style={{ width: '100%' }} onClick={() => setTab('categorize')}>Finish {H.prevMonthLabel} →</Button>
                          </div>
                          <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                            Your allowance unlocks once you've reviewed everything from the month before.
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="zt-num" style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--text-primary)' }}>{H.spentLabel}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 10 }}>No monthly allowance set. Ask the account owner to set one.</div>
                  </>
                )}
              </div>

              {/* personal budgets */}
              {budgets.length ? (
                <>
                  {sectionTitle('Your budgets')}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {budgets.map((b) => (
                      <div key={b.id} style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{b.icon ? `${b.icon} ` : ''}{b.name}</span>
                          <span className="zt-num" style={{ fontSize: 13, fontWeight: 600, color: b.pct >= 100 ? 'var(--negative)' : 'var(--text-secondary)' }}>{b.remainingLabel} left</span>
                        </div>
                        <ProgressBar value={b.spent} max={Math.max(b.limit, 1)} height={8} />
                        <div className="zt-num" style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>{b.spentLabel} of {b.limitLabel}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}

              {/* accounts you manage (with balances) */}
              {sectionTitle('Your accounts')}
              {accounts.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {accounts.map((a) => (
                    <button key={a.id} onClick={() => { setAcctFilter(a.id); setTab('activity'); }} style={{ textAlign: 'left', width: '100%', background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', padding: 16, border: '1px solid var(--border-hairline)', cursor: 'pointer', font: 'inherit' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, textTransform: 'capitalize' }}>{a.type}{a.mask ? ` ••${a.mask}` : ''}</div>
                        </div>
                        <span className="zt-num" style={{ fontSize: 19, fontWeight: 700, color: a.balance < 0 ? 'var(--negative)' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>{a.balance < 0 ? '−' : ''}{a.balanceLabel.replace('-', '')}</span>
                      </div>
                      <ProgressBar value={a.reviewed} max={Math.max(a.total, 1)} height={7} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 9 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{a.reviewed}/{a.total} reviewed in {H.monthLabel}</span>
                        {a.done ? <Badge tone="positive" size="sm">Done</Badge>
                          : a.remaining > 0 ? <span className="zt-num" style={{ fontSize: 12.5, color: 'var(--warning)', fontWeight: 600 }}>{a.remaining} to review</span>
                          : null}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '16px 0', fontSize: 14, color: 'var(--text-tertiary)' }}>You're not in charge of any accounts yet. Ask the account owner to add you.</div>
              )}

              {/* savings goals */}
              {goals.length ? (
                <>
                  {sectionTitle('Savings goals')}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {goals.map((g) => (
                      <div key={g.id} style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', minWidth: 0 }}>
                            <span style={{ fontSize: 17, flex: 'none' }}>{g.icon || '🎯'}</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                          </span>
                          <span className="zt-num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', flex: 'none' }}>{g.pct != null ? g.pct : 0}%</span>
                        </div>
                        <ProgressBar value={g.saved} max={Math.max(g.target, 1)} height={8} />
                        <div className="zt-num" style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>${Math.round(g.saved).toLocaleString('en-US')} of ${Math.round(g.target).toLocaleString('en-US')}{g.date ? ` · ${g.date}` : ''}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}

              {window.ZHQPushPrompt ? <div style={{ marginTop: 22 }}><window.ZHQPushPrompt compact /></div> : null}
            </>
          ) : tab === 'activity' ? (
            /* ========================== ACTIVITY ========================== */
            <>
              {/* account filter chips */}
              {accounts.length > 1 ? (
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 6 }}>
                  {[{ id: 'all', name: 'All' }, ...accounts].map((a) => (
                    <button key={a.id} onClick={() => setAcctFilter(a.id)} style={{ flex: 'none', padding: '9px 15px', borderRadius: 999, border: '1px solid var(--border-hairline)', background: acctFilter === a.id ? 'var(--accent)' : 'var(--surface-card)', color: acctFilter === a.id ? 'var(--text-on-accent)' : 'var(--text-secondary)', font: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', minHeight: 40 }}>{a.name}</button>
                  ))}
                </div>
              ) : null}
              {filteredActivity.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 10px', color: 'var(--text-tertiary)', fontSize: 14 }}>No transactions yet on this account.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {filteredActivity.map((t) => (
                    <MemberTxnRow key={t.id} t={t} review={false} busy={busy === t.id}
                      onEditCat={() => setPicker(t.id)}
                      onConfirm={() => confirmOne(t.id)}
                      onTransfer={() => markTransfer(t.id)} />
                  ))}
                </div>
              )}
            </>
          ) : (
            /* ========================= CATEGORIZE ========================= */
            <>
              {queue.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 10px' }}>
                  <span style={{ display: 'inline-flex', width: 60, height: 60, borderRadius: 999, placeItems: 'center', background: 'var(--green-glow)', color: 'var(--accent)', marginBottom: 16 }}><Icon name="check" size={28} /></span>
                  <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>All caught up</div>
                  <div style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 6 }}>You've reviewed everything for {H.monthLabel}.</div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
                    <b style={{ color: 'var(--text-primary)' }}>{queue.length}</b> transaction{queue.length === 1 ? '' : 's'} to review. Tap the category to change it, then Confirm.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {queue.map((t) => (
                      <MemberTxnRow key={t.id} t={t} review busy={busy === t.id}
                        onEditCat={() => setPicker(t.id)}
                        onConfirm={() => confirmOne(t.id)}
                        onTransfer={() => markTransfer(t.id)} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* bottom tab bar */}
        <div style={{ flex: 'none', height: 78, borderTop: '1px solid var(--border-hairline)', background: 'var(--bg-app)', display: 'flex', padding: '10px 12px 0', paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: tab === t.key ? 'var(--accent)' : 'var(--text-tertiary)', position: 'relative', minHeight: 56 }}>
              <span style={{ position: 'relative' }}>
                <Icon name={t.icon} size={23} />
                {t.badge ? <span style={{ position: 'absolute', top: -4, right: -9, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: 'var(--warning)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{t.badge}</span> : null}
              </span>
              <span style={{ fontSize: 11, fontWeight: tab === t.key ? 600 : 500 }}>{t.label}</span>
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
