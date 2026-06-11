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
function MemberTxnRow({ t, review, busy, onEditCat, onConfirm, onTransfer, onReceipt }) {
  const { Icon, Button, Tag } = window.ZittingHQDesignSystem_c9e528;
  return (
    <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', padding: 16, opacity: busy ? 0.5 : 1, border: review && !t.reviewed ? '1px solid var(--border-hairline)' : '1px solid transparent' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t.merchant}
            {t.receiptId && onReceipt ? (
              <button onClick={onReceipt} title="View receipt" style={{ background: 'none', border: 'none', padding: '0 0 0 7px', cursor: 'pointer', color: 'var(--accent)', verticalAlign: -2 }}><Icon name="receipt" size={14} /></button>
            ) : null}
          </div>
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

/* Receipt breakdown — what was bought, line by line, plus the photo. */
function ReceiptBreakdown({ receipt, onClose }) {
  const { Modal, Icon, Button } = window.ZittingHQDesignSystem_c9e528;
  const API = window.ZHQ_API || {};
  const [opening, setOpening] = React.useState(false);
  const money = (v) => (v == null ? '' : (v < 0 ? '−$' : '$') + Math.abs(v).toFixed(2));
  async function viewPhoto() {
    if (!API.receiptSignedUrl) return;
    setOpening(true);
    try {
      const r = await API.receiptSignedUrl(receipt.id);
      if (r && r.ok) window.open(r.url, '_blank', 'noopener');
    } finally { setOpening(false); }
  }
  const lines = receipt.lines || [];
  return (
    <Modal open onClose={onClose} title={receipt.merchant || 'Receipt'} width={400}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {receipt.txn ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
            Attached to <b style={{ color: 'var(--text-primary)' }}>{receipt.txn.merchant}</b> · {receipt.txn.date} · {receipt.txn.amount}
          </div>
        ) : null}
        {lines.length ? (
          <div style={{ maxHeight: '46vh', overflowY: 'auto', borderTop: '1px solid var(--border-hairline)' }}>
            {lines.map((l, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '9px 2px', borderBottom: '1px solid var(--border-hairline)' }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--text-primary)' }}>
                  {l.name}{l.qty != null && l.qty !== 1 ? <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}> ×{l.qty}</span> : null}
                </span>
                <span className="zt-num" style={{ flex: 'none', fontSize: 13, color: l.price != null && l.price < 0 ? 'var(--accent)' : 'var(--text-secondary)' }}>{money(l.price)}</span>
              </div>
            ))}
            {receipt.totalLabel ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '10px 2px' }}>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>Total</span>
                <span className="zt-num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{receipt.totalLabel}</span>
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            No line items yet{receipt.scanStatus === 'failed' ? " — we couldn't read this photo" : ''}.
          </div>
        )}
        <Button variant="secondary" size="md" style={{ width: '100%' }} onClick={viewPhoto} disabled={opening} iconLeft={<Icon name="receipt" size={15} />}>
          {opening ? 'Opening…' : 'View photo'}
        </Button>
      </div>
    </Modal>
  );
}

/* Pick which purchase a receipt belongs to (member's own accounts only). */
function ReceiptMatchSheet({ receipt, activity, onClose }) {
  const { Modal, Button } = window.ZittingHQDesignSystem_c9e528;
  const API = window.ZHQ_API || {};
  const [busy, setBusy] = React.useState(false);
  const candidates = activity.filter((t) => t.amt < 0 && !t.isTransfer && !t.receiptId).slice(0, 40);
  const suggested = receipt.suggestedTransactionId != null ? candidates.find((t) => t.id === receipt.suggestedTransactionId) : null;
  async function pick(txnId) {
    if (!API.matchReceipt) return;
    setBusy(true);
    try { await API.matchReceipt(receipt.id, txnId); window.ZHQ_REFRESH && window.ZHQ_REFRESH(); onClose(); }
    finally { setBusy(false); }
  }
  const Row = ({ t, highlight }) => (
    <button onClick={() => pick(t.id)} disabled={busy} style={{
      display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
      padding: '12px 10px', borderRadius: 'var(--radius-md)', border: `1px solid ${highlight ? 'var(--green-tint)' : 'var(--border-hairline)'}`,
      background: highlight ? 'var(--green-glow)' : 'var(--surface-card)', cursor: 'pointer', font: 'inherit', minHeight: 52, opacity: busy ? 0.6 : 1,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.merchant}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{t.date}{highlight ? ' · our best guess' : ''}</div>
      </div>
      <span className="zt-num" style={{ flex: 'none', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>−${Math.abs(t.amt).toFixed(2)}</span>
    </button>
  );
  return (
    <Modal open onClose={onClose} title="Which purchase is this?" width={400}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {receipt.merchant || receipt.totalLabel ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 2 }}>
            Receipt: {[receipt.merchant, receipt.totalLabel].filter(Boolean).join(' · ')}
          </div>
        ) : null}
        {suggested ? <Row t={suggested} highlight /> : null}
        <div style={{ maxHeight: '44vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {candidates.filter((t) => !suggested || t.id !== suggested.id).map((t) => <Row key={t.id} t={t} />)}
          {!candidates.length ? <div style={{ padding: '14px 4px', fontSize: 13, color: 'var(--text-tertiary)' }}>No recent purchases to attach this to yet.</div> : null}
        </div>
        <Button variant="ghost" size="md" onClick={onClose} disabled={busy}>Not now</Button>
      </div>
    </Modal>
  );
}

function ZHQSpendable() {
  const { Icon, Avatar, ProgressBar, Button, Badge, Modal, AreaChart, Sparkline } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA || {};
  const user = window.ZHQ_USER || {};
  const API = window.ZHQ_API || {};
  const H = D.memberHome || null;
  const name = (H && H.name) || user.name || 'there';

  const [tab, setTab] = React.useState('home');
  const [acctOpen, setAcctOpen] = React.useState(false); // account menu (Log out lives here)
  const [picker, setPicker] = React.useState(null); // txn id being categorized
  const [groupPicker, setGroupPicker] = React.useState(null); // merchant group being set
  const [reviewMode, setReviewMode] = React.useState('merchant'); // 'merchant' | 'single'
  const [busy, setBusy] = React.useState(null); // txn id (or 'bulk') mid-action
  const [acctFilter, setAcctFilter] = React.useState('all'); // Activity account filter
  const [bulkUndo, setBulkUndo] = React.useState(() => (typeof window !== 'undefined' ? window.__ZHQ_BULK_UNDO || null : null));

  async function run(id, fn) {
    setBusy(id);
    try { await fn(); window.ZHQ_REFRESH && window.ZHQ_REFRESH(); }
    finally { setBusy(null); }
  }
  const pickCategory = (id, categoryId) => run(id, () => API.updateTransaction(id, { categoryId }, { learn: true }));
  const confirmOne = (id) => run(id, () => API.confirmTransactions([id]));
  const markTransfer = (id) => run(id, () => API.markTransfer(id, true));

  // --- bulk (by-merchant) categorize, scoped to the member's accounts ---
  const setBulkSnap = (snap) => { if (typeof window !== 'undefined') window.__ZHQ_BULK_UNDO = snap; setBulkUndo(snap); };
  async function applyGroups(groups, label) {
    if (!groups.length || !API.applyBulkCategories) return;
    setBusy('bulk');
    try {
      const res = await API.applyBulkCategories(groups.map((g) => ({ ids: g.ids, categoryId: g.categoryId })));
      const count = groups.reduce((s, g) => s + g.ids.length, 0);
      setBulkSnap(res && res.undo ? { pairs: res.undo, count, label } : null);
      window.ZHQ_REFRESH && window.ZHQ_REFRESH();
    } finally { setBusy(null); }
  }
  const acceptGroup = (g) => applyGroups([{ ids: g.ids, categoryId: g.suggestion.categoryId }], `${g.merchant} → ${g.suggestion.name}`);
  const setGroup = (g, categoryId) => applyGroups([{ ids: g.ids, categoryId }], g.merchant);
  async function undoBulk() {
    if (!bulkUndo || !API.restoreTransactionCategories) return;
    setBusy('bulk');
    try { await API.restoreTransactionCategories(bulkUndo.pairs); setBulkSnap(null); window.ZHQ_REFRESH && window.ZHQ_REFRESH(); }
    finally { setBusy(null); }
  }
  const bulkGroups = (D.bulkGroups || []).filter((g) => g.unreviewed > 0 || g.uncategorized > 0);
  const acceptAllGroups = () => {
    const t = bulkGroups.filter((g) => g.suggestion && g.suggestion.confidence >= 0.7);
    applyGroups(t.map((g) => ({ ids: g.ids, categoryId: g.suggestion.categoryId })), `${t.length} suggestions`);
  };

  const accounts = (H && H.managedAccounts) || [];
  const queue = (H && H.reviewQueue) || [];
  const myReceipts = (H && H.receipts) || [];
  const [snapBusy, setSnapBusy] = React.useState(false);
  const [snapResult, setSnapResult] = React.useState(null); // upload outcome banner
  const [matchSheet, setMatchSheet] = React.useState(null); // receipt being matched
  const [breakdown, setBreakdown] = React.useState(null); // receipt being viewed
  const snapInput = React.useRef(null);
  async function onSnap(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file || !API.uploadReceipt) return;
    setSnapBusy(true);
    setSnapResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await API.uploadReceipt(fd);
      if (res && res.ok === false) setSnapResult({ tone: 'bad', text: res.error || 'Upload failed' });
      else if (res) {
        if (res.matchedTxnId != null) setSnapResult({ tone: 'good', text: `Matched${res.merchant ? ` — ${res.merchant}` : ''}${res.total != null ? ` · $${res.total.toFixed(2)}` : ''}. Receipt attached!` });
        else if (res.scanned) setSnapResult({ tone: 'mid', text: `Read it${res.merchant ? ` — ${res.merchant}` : ''}${res.total != null ? ` · $${res.total.toFixed(2)}` : ''}. Pick which purchase it belongs to below.`, receiptId: res.id });
        else setSnapResult({ tone: 'mid', text: 'Saved! Attach it to a purchase below.', receiptId: res.id });
        window.ZHQ_REFRESH && window.ZHQ_REFRESH();
      }
    } catch {
      setSnapResult({ tone: 'bad', text: 'Upload failed — try again' });
    } finally { setSnapBusy(false); }
  }
  const activity = (H && H.activity) || [];
  const budgets = (H && H.budgets) || [];
  const goals = (D.goals || []).filter((g) => !g.archived);
  const allowance = H ? H.allowance : 0;
  const unlocked = H ? H.allowanceUnlocked : true;
  const perf = (H && H.performance) || null;

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
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: 'max(8px, env(safe-area-inset-top)) 18px 24px' }}>
          {/* header — tap to open the account menu (Log out lives there) */}
          <button onClick={() => setAcctOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 18px', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
            <Avatar name={name} size="md" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Welcome back</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
            </div>
            <span style={{ flex: 'none', width: 34, height: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: 'var(--surface-card)', color: 'var(--text-tertiary)' }}><Icon name="chevronDown" size={18} /></span>
          </button>

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
                {/* vs last month — a gentle save-more nudge either way */}
                {H.spendTrend && H.spendTrend.values && H.spendTrend.values.length >= 2 ? (() => {
                  const v = H.spendTrend.values;
                  const prev = v[v.length - 2];
                  const cur = v[v.length - 1];
                  if (prev <= 0 && cur <= 0) return null;
                  const less = cur <= prev;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, fontSize: 12.5, fontWeight: 600, color: less ? 'var(--accent)' : 'var(--warning)' }}>
                      <Icon name={less ? 'arrowDown' : 'trendingUp'} size={14} />
                      {less
                        ? `Spending less than ${H.prevMonthLabel} — nice.`
                        : `Spending more than ${H.prevMonthLabel} (${H.spentPrevMonthLabel || ''})`.trim()}
                    </div>
                  );
                })() : null}
              </div>

              {/* review nudge — categorizing keeps everything below accurate */}
              {H.totalRemaining > 0 && (allowance <= 0 || unlocked) ? (
                <button onClick={() => setTab('categorize')} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', marginTop: 14, padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-hairline)', background: 'var(--surface-card)', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
                  <span style={{ flex: 'none', width: 38, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: 'var(--green-glow)', color: 'var(--accent)' }}><Icon name="list" size={18} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>{H.totalRemaining} to review</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>Takes about a minute — keeps your numbers honest.</span>
                  </span>
                  <Icon name="chevronRight" size={17} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                </button>
              ) : null}

              {/* snap a receipt — opens the camera on mobile, gets scanned + matched */}
              <input ref={snapInput} type="file" accept="image/*" capture="environment" onChange={onSnap} style={{ display: 'none' }} />
              <button onClick={() => snapInput.current && snapInput.current.click()} disabled={snapBusy} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', marginTop: 14, padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-hairline)', background: 'var(--surface-card)', cursor: 'pointer', font: 'inherit', textAlign: 'left', opacity: snapBusy ? 0.6 : 1 }}>
                <span style={{ flex: 'none', width: 38, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: 'var(--green-glow)', color: 'var(--accent)' }}><Icon name="camera" size={18} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>{snapBusy ? 'Reading your receipt…' : 'Snap a receipt'}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{snapBusy ? 'Hang tight — this takes a couple seconds.' : "We'll read it and attach it to the right purchase."}</span>
                </span>
                <Icon name="chevronRight" size={17} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              </button>
              {snapResult ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', marginTop: 10, borderRadius: 'var(--radius-md)', background: snapResult.tone === 'good' ? 'var(--green-glow)' : 'var(--surface-card)', border: `1px solid ${snapResult.tone === 'good' ? 'var(--green-tint)' : snapResult.tone === 'bad' ? 'var(--negative)' : 'var(--border-hairline)'}` }}>
                  <Icon name={snapResult.tone === 'good' ? 'check' : snapResult.tone === 'bad' ? 'alert' : 'receipt'} size={16} style={{ color: snapResult.tone === 'good' ? 'var(--accent)' : snapResult.tone === 'bad' ? 'var(--negative)' : 'var(--text-secondary)', flex: 'none' }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>{snapResult.text}</span>
                  {snapResult.receiptId ? (
                    <Button variant="secondary" size="sm" onClick={() => { const r = myReceipts.find((x) => x.id === snapResult.receiptId); if (r) { setMatchSheet(r); setSnapResult(null); } }}>Pick</Button>
                  ) : null}
                  <button onClick={() => setSnapResult(null)} style={{ flex: 'none', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 36, minHeight: 36 }}><Icon name="x" size={14} /></button>
                </div>
              ) : null}

              {/* receipts — tap a matched one for the item-by-item breakdown */}
              {myReceipts.length ? (
                <>
                  {sectionTitle('Your receipts')}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {myReceipts.slice(0, 6).map((r) => {
                      const matched = !!r.txn;
                      return (
                        <button key={r.id} onClick={() => (matched ? setBreakdown(r) : setMatchSheet(r))} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '13px 14px', borderRadius: 'var(--radius-md)', border: `1px solid ${matched ? 'var(--border-hairline)' : 'var(--green-tint)'}`, background: 'var(--surface-card)', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
                          <span style={{ flex: 'none', width: 36, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: matched ? 'var(--surface-sunken)' : 'var(--green-glow)', color: matched ? 'var(--text-secondary)' : 'var(--accent)' }}><Icon name="receipt" size={17} /></span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.merchant || (r.txn && r.txn.merchant) || 'Receipt'}</span>
                            <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {matched
                                ? `${r.lines && r.lines.length ? `${r.lines.length} item${r.lines.length === 1 ? '' : 's'}` : 'Attached'}${r.txn.date ? ` · ${r.txn.date}` : ''}`
                                : r.suggestedTxn ? `Looks like ${r.suggestedTxn.merchant} — tap to confirm` : 'Tap to attach to a purchase'}
                            </span>
                          </span>
                          {r.totalLabel ? <span className="zt-num" style={{ flex: 'none', fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{r.totalLabel}</span> : null}
                          {!matched ? <Badge tone="positive" size="sm">Match</Badge> : <Icon name="chevronRight" size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : null}

              {/* performance allowance */}
              {perf && !perf.recipientOnly ? (
                <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', padding: 22, border: `1px solid ${perf.over ? 'var(--green-tint)' : 'var(--border-hairline)'}` }}>
                  <div className="zt-eyebrow" style={{ marginBottom: 12 }}>Performance · {perf.periodLabel}</div>
                  <div className="zt-num" style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--text-primary)' }}>{perf.incomeLabel}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 8 }}>of {perf.goalLabel} goal</div>
                  <div style={{ marginTop: 14 }}>
                    <ProgressBar value={Math.min(perf.pct, 100)} max={100} height={9} />
                  </div>
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-hairline)' }}>
                    {perf.over ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, color: 'var(--accent)', fontWeight: 600 }}>
                        <Icon name="check" size={16} /> Beat goal — {perf.bonusLabel} bonus · allowance {perf.projectedLabel}
                      </span>
                    ) : (
                      <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>Minimum allowance {perf.minLabel}. Beat {perf.goalLabel} to earn a bonus.</span>
                    )}
                  </div>
                  {perf.pendingTransfers && perf.pendingTransfers.length ? (
                    <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--text-tertiary)' }}>
                      {perf.pendingTransfers.map((t, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, paddingTop: 6 }}>
                          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.note || 'Allowance transfer'}</span>
                          <span className="zt-num" style={{ color: 'var(--text-secondary)' }}>{t.amountLabel} pending</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : perf && perf.recipientOnly && perf.pendingTransfers.length ? (
                <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', padding: 22, border: '1px solid var(--green-tint)' }}>
                  <div className="zt-eyebrow" style={{ marginBottom: 10 }}>Bonus coming your way</div>
                  {perf.pendingTransfers.map((t, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, paddingTop: 6, fontSize: 13.5 }}>
                      <span style={{ color: 'var(--text-secondary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.note || 'Allowance bonus'}</span>
                      <span className="zt-num" style={{ color: 'var(--accent)', fontWeight: 600 }}>{t.amountLabel}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* spending over time — see your money move month to month */}
              {H.spendTrend && H.spendTrend.values && H.spendTrend.values.some((v) => v > 0) ? (
                <>
                  {sectionTitle('Your spending over time')}
                  <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', padding: '16px 12px 8px' }}>
                    <AreaChart data={H.spendTrend.values} labels={H.spendTrend.labels} width={320} height={130} style={{ width: '100%', height: 'auto', display: 'block' }} />
                  </div>
                </>
              ) : null}

              {/* where it went this month */}
              {H.categoriesMonth && H.categoriesMonth.length ? (
                <>
                  {sectionTitle(`Where it went in ${H.monthLabel}`)}
                  <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {(() => {
                      const max = Math.max(...H.categoriesMonth.map((c) => c.value), 1);
                      return H.categoriesMonth.map((c) => (
                        <div key={c.categoryId}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ width: 9, height: 9, borderRadius: 999, background: c.color, flex: 'none' }} />
                            <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                            <span className="zt-num" style={{ fontSize: 13, color: 'var(--text-secondary)', flex: 'none' }}>{c.display}</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 999, background: 'var(--surface-sunken)', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.max(4, Math.round((c.value / max) * 100))}%`, height: '100%', borderRadius: 999, background: c.color }} />
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </>
              ) : null}

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
                        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flex: 'none' }}>
                          <span className="zt-num" style={{ fontSize: 19, fontWeight: 700, color: a.balance < 0 ? 'var(--negative)' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>{a.balance < 0 ? '−' : ''}{a.balanceLabel.replace('-', '')}</span>
                          {a.spark && a.spark.length >= 2 ? <Sparkline data={a.spark} width={76} height={20} /> : null}
                        </span>
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

              {/* savings goals — progress when they exist, encouragement when not */}
              {sectionTitle('Savings goals')}
              {goals.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {goals.map((g) => (
                    <div key={g.id} style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', padding: 16, border: g.status === 'complete' ? '1px solid var(--green-tint)' : '1px solid transparent' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', minWidth: 0 }}>
                          <span style={{ fontSize: 17, flex: 'none' }}>{g.icon || '🎯'}</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                        </span>
                        <span className="zt-num" style={{ fontSize: 14, fontWeight: 700, color: g.status === 'complete' ? 'var(--accent)' : 'var(--text-primary)', whiteSpace: 'nowrap', flex: 'none' }}>{g.pct != null ? g.pct : 0}%</span>
                      </div>
                      <ProgressBar value={g.saved} max={Math.max(g.target, 1)} height={8} />
                      <div className="zt-num" style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>${Math.round(g.saved).toLocaleString('en-US')} of ${Math.round(g.target).toLocaleString('en-US')}{g.date ? ` · ${g.date}` : ''}</div>
                      {g.status !== 'complete' && g.requiredPerMonth != null && g.requiredPerMonth > 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                          Save <b className="zt-num" style={{ color: 'var(--accent)' }}>${Math.round(g.requiredPerMonth).toLocaleString('en-US')}/mo</b> to hit it{g.date ? ` by ${g.date}` : ''}.
                        </div>
                      ) : g.status === 'complete' ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--accent)', fontWeight: 600, marginTop: 6 }}><Icon name="check" size={14} /> Goal reached!</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', padding: 18, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ flex: 'none', width: 38, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: 'var(--green-glow)', color: 'var(--accent)' }}><Icon name="target" size={18} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>Start saving for something</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.5 }}>
                      A bike, a trip, a mission fund — pick a target and watch it fill up. Ask the account owner to set up a goal with you.
                    </div>
                  </div>
                </div>
              )}

              {window.ZHQPushPrompt ? <div style={{ marginTop: 22 }}><window.ZHQPushPrompt compact /></div> : null}
            </>
          ) : tab === 'activity' ? (
            /* ========================== ACTIVITY ========================== */
            <>
              {/* account filter chips */}
              {accounts.length > 1 ? (
                <div className="zhq-hscroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 6 }}>
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
                      onTransfer={() => markTransfer(t.id)}
                      onReceipt={t.receiptId ? () => { const r = myReceipts.find((x) => x.id === t.receiptId); if (r) setBreakdown(r); } : null} />
                  ))}
                </div>
              )}
            </>
          ) : (
            /* =========================== REVIEW =========================== */
            <>
              {bulkUndo ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', marginBottom: 14, borderRadius: 'var(--radius-md)', background: 'var(--green-glow)', border: '1px solid var(--green-tint)' }}>
                  <Icon name="check" size={16} style={{ color: 'var(--accent)', flex: 'none' }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text-primary)' }}>Categorized {bulkUndo.count}{bulkUndo.label ? ` · ${bulkUndo.label}` : ''}</span>
                  <Button variant="ghost" size="sm" disabled={busy === 'bulk'} onClick={undoBulk}>Undo</Button>
                  <button onClick={() => setBulkSnap(null)} style={{ flex: 'none', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 36, minHeight: 36 }}><Icon name="x" size={14} /></button>
                </div>
              ) : null}

              {queue.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 10px' }}>
                  <span style={{ display: 'inline-flex', width: 60, height: 60, borderRadius: 999, alignItems: 'center', justifyContent: 'center', background: 'var(--green-glow)', color: 'var(--accent)', marginBottom: 16 }}><Icon name="check" size={28} /></span>
                  <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>All caught up</div>
                  <div style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 6 }}>You've reviewed everything for {H.monthLabel}.</div>
                </div>
              ) : (
                <>
                  {/* mode toggle: bulk by merchant vs one at a time */}
                  {bulkGroups.length ? (
                    <div style={{ display: 'flex', gap: 6, padding: 4, background: 'var(--surface-sunken)', borderRadius: 999, marginBottom: 14 }}>
                      {[{ k: 'merchant', l: 'By merchant' }, { k: 'single', l: 'One at a time' }].map((m) => (
                        <button key={m.k} onClick={() => setReviewMode(m.k)} style={{ flex: 1, padding: '9px 0', borderRadius: 999, border: 'none', cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 600, background: reviewMode === m.k ? 'var(--surface-card)' : 'transparent', color: reviewMode === m.k ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{m.l}</button>
                      ))}
                    </div>
                  ) : null}

                  {reviewMode === 'merchant' && bulkGroups.length ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                        <div style={{ flex: 1, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          <b style={{ color: 'var(--text-primary)' }}>{bulkGroups.length}</b> merchant{bulkGroups.length === 1 ? '' : 's'} to review. Set a whole merchant at once.
                        </div>
                        {bulkGroups.filter((g) => g.suggestion && g.suggestion.confidence >= 0.7).length ? (
                          <Button variant="primary" size="sm" disabled={busy === 'bulk'} onClick={acceptAllGroups}>Accept all</Button>
                        ) : null}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {bulkGroups.map((g) => (
                          <div key={g.key} style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', padding: 14, opacity: busy === 'bulk' ? 0.5 : 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.merchant}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{g.count} txn{g.count === 1 ? '' : 's'} · {g.spendLabel}{g.dateRange ? ` · ${g.dateRange}` : ''}</div>
                              </div>
                              <Badge tone="neutral" size="sm">{g.count}</Badge>
                            </div>
                            {g.suggestion ? (
                              <button onClick={() => acceptGroup(g)} disabled={busy === 'bulk'} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: `1px solid ${g.suggestion.confidence >= 0.7 ? 'var(--green-tint)' : 'var(--border-hairline)'}`, background: 'var(--surface-sunken)', cursor: 'pointer', font: 'inherit', marginBottom: 8 }}>
                                <span style={{ width: 10, height: 10, borderRadius: 999, background: g.suggestion.color, flex: 'none' }} />
                                <span style={{ flex: 1, textAlign: 'left', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Set all to {g.suggestion.name}</span>
                                <span className="zt-num" style={{ fontSize: 12, color: g.suggestion.confidence >= 0.7 ? 'var(--accent)' : 'var(--text-tertiary)' }}>{g.suggestion.confidencePct}%</span>
                                <Icon name="check" size={16} style={{ color: 'var(--accent)' }} />
                              </button>
                            ) : null}
                            <Button variant={g.suggestion ? 'ghost' : 'primary'} size="md" style={{ width: '100%' }} disabled={busy === 'bulk'} onClick={() => setGroupPicker(g)}>{g.suggestion ? 'Choose another category' : `Categorize ${g.count}`}</Button>
                          </div>
                        ))}
                      </div>
                    </>
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

      {matchSheet ? (
        <ReceiptMatchSheet receipt={matchSheet} activity={activity} onClose={() => setMatchSheet(null)} />
      ) : null}
      {breakdown ? (
        <ReceiptBreakdown receipt={breakdown} onClose={() => setBreakdown(null)} />
      ) : null}
      {picker != null ? (
        <MemberCategoryPicker
          onClose={() => setPicker(null)}
          onPick={(categoryId) => { const id = picker; setPicker(null); pickCategory(id, categoryId); }}
        />
      ) : null}
      {groupPicker ? (
        <MemberCategoryPicker
          onClose={() => setGroupPicker(null)}
          onPick={(categoryId) => { const g = groupPicker; setGroupPicker(null); setGroup(g, categoryId); }}
        />
      ) : null}
      {acctOpen && Modal ? (
        <Modal open onClose={() => setAcctOpen(false)} title="Account" width={340}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar name={name} size="md" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{({ owner: 'Owner', partner: 'Partner', member: 'Member' })[user.role] || 'Member'}</div>
              </div>
            </div>
            {window.ZHQPushPrompt ? <window.ZHQPushPrompt compact /> : null}
            <Button variant="secondary" size="md" style={{ width: '100%' }} iconLeft={<Icon name="grid" size={16} />} onClick={() => { window.location.href = '/'; }}>Family HQ</Button>
            <Button variant="secondary" size="md" style={{ width: '100%' }} iconLeft={<Icon name="logout" size={16} />} onClick={() => { if (window.ZHQ_LOGOUT) window.ZHQ_LOGOUT(); }}>Log out</Button>
          </div>
        </Modal>
      ) : null}
    </ZHQPhoneFrame>
  );
}

Object.assign(window, { ZHQSpendable, ZHQPhoneFrame });
