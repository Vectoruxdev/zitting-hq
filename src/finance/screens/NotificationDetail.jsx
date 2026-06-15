import React from 'react';
import { resolveNotifEntity } from '../notifEntity';
/* Notification detail overlay — opened from the in-app feed, the bell, or a
   push click. Shows the notification in full AND the live thing it's about
   (transaction, group, transfer, …) with the action you'd want to take inline.
   Owned by FinanceApp so it floats above every surface (owner shell, member
   canvas). Resolves the entity from the viewer's already-scoped payload, so it
   inherits privacy/account scoping and renders the role-appropriate actions. */

const toneColor = { accent: 'var(--accent)', warning: 'var(--warning)', negative: 'var(--negative)', info: 'var(--text-secondary)' };
const toneBg = { accent: 'var(--green-glow)', warning: 'rgba(245,180,80,0.12)', negative: 'rgba(240,90,90,0.12)', info: 'var(--surface-sunken)' };
const money = (v) => (v == null ? '' : (v < 0 ? '−$' : '$') + Math.abs(v).toFixed(2));

function ZHQNotificationDetail({ notif, onClose, onNavigate, memberView }) {
  const { Icon, Button, Tag, Avatar } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA || {};
  const API = window.ZHQ_API || {};
  const user = window.ZHQ_USER || {};
  // memberView is passed by FinanceApp (true on the member canvas, incl. owner
  // preview); fall back to the role for safety.
  const isMember = memberView != null ? memberView : user.role === 'member';
  const MemberCategoryPicker = window.MemberCategoryPicker;

  // Normalize: caller passes the full row, or an id we look up in the feed.
  const n = React.useMemo(() => {
    if (notif && typeof notif === 'object') return notif;
    const all = D.notifications || [];
    return all.find((x) => String(x.id) === String(notif)) || { id: notif, title: 'Notification', unread: false };
  }, [notif, D.notifications]);

  const [busy, setBusy] = React.useState(false);
  const [picker, setPicker] = React.useState(null); // txn being categorized

  // Mark read on open (real DB rows only; derived string-id alerts are skipped).
  React.useEffect(() => {
    if (n && n.unread && typeof n.id === 'number' && API.markNotificationsRead) {
      API.markNotificationsRead([n.id]).then(() => window.ZHQ_REFRESH && window.ZHQ_REFRESH()).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n && n.id]);

  const ent = resolveNotifEntity(n, D, { isMember });

  async function run(fn) {
    setBusy(true);
    try { await fn(); window.ZHQ_REFRESH && window.ZHQ_REFRESH(); }
    finally { setBusy(false); }
  }
  const go = (route) => {
    onClose();
    if (isMember && window.ZHQ_MEMBER_NAV) window.ZHQ_MEMBER_NAV(route === 'transactions' ? 'categorize' : route === 'activity' ? 'activity' : 'home');
    else if (onNavigate) onNavigate(route);
  };
  async function viewReceipt(id) {
    if (!API.receiptSignedUrl) return;
    const r = await API.receiptSignedUrl(id);
    if (r && r.ok) window.open(r.url, '_blank', 'noopener');
  }

  // --- one transaction row with inline actions ---
  const TxnCard = ({ t }) => (
    <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', padding: 14, border: '1px solid var(--border-hairline)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.merchant}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{t.date}{t.account ? ` · ${t.account}` : ''}</div>
        </div>
        <span className="zt-num" style={{ flex: 'none', fontSize: 16, fontWeight: 700, color: t.amt >= 0 ? 'var(--accent)' : 'var(--text-primary)' }}>{t.amt >= 0 ? '+' : '−'}${Math.abs(t.amt).toFixed(2)}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 12, flexWrap: 'wrap' }}>
        <button onClick={() => setPicker(t)} disabled={busy} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
          <Tag color={t.color} size="md">{t.cat || 'Uncategorized'} ✎</Tag>
        </button>
        <span style={{ flex: 1 }} />
        {isMember && t.reviewed === false ? (
          <Button variant="primary" size="sm" disabled={busy} onClick={() => run(() => API.confirmTransactions([t.id]))}>Confirm</Button>
        ) : null}
        {!t.isTransfer ? (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => API.markTransfer(t.id, true))}>Transfer</Button>
        ) : null}
        {t.receiptId ? (
          <Button variant="ghost" size="sm" onClick={() => viewReceipt(t.receiptId)} iconLeft={<Icon name="receipt" size={14} />}>Receipt</Button>
        ) : null}
      </div>
    </div>
  );

  let bodyEl = null;
  if (ent.kind === 'transaction' && ent.txn) {
    bodyEl = (
      <>
        <TxnCard t={ent.txn} />
        {!isMember ? <Button variant="ghost" size="sm" style={{ width: '100%' }} onClick={() => go('transactions')}>Open in Transactions →</Button> : null}
      </>
    );
  } else if (ent.kind === 'transaction-group' && ent.txns) {
    bodyEl = (
      <>
        <div className="zt-eyebrow" style={{ marginBottom: 2 }}>{ent.txns.length} to review</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '46vh', overflowY: 'auto' }}>
          {ent.txns.map((t) => <TxnCard key={t.id} t={t} />)}
        </div>
        <Button variant="secondary" size="md" style={{ width: '100%' }} onClick={() => go(isMember ? 'categorize' : 'transactions')}>Review all{isMember ? '' : ' in Transactions'} →</Button>
      </>
    );
  } else if (ent.kind === 'transfer' && ent.transfer) {
    const tr = ent.transfer;
    const done = tr.state === 'done' || tr.state === 'auto';
    bodyEl = (
      <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', padding: 14, border: '1px solid var(--border-hairline)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{tr.to || 'Transfer'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{[tr.from, tr.due].filter(Boolean).join(' · ')}</div>
          </div>
          <span className="zt-num" style={{ flex: 'none', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{tr.amount}</span>
        </div>
        <div style={{ marginTop: 12 }}>
          {done ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}><Icon name="check" size={15} /> {tr.state === 'auto' ? 'Automatic' : 'Done'}</span>
          ) : API.markTransferInstance && typeof tr.id === 'number' ? (
            <Button variant="primary" size="md" style={{ width: '100%' }} disabled={busy} onClick={() => run(() => API.markTransferInstance(tr.id, true))}>Mark sent</Button>
          ) : (
            <Button variant="secondary" size="md" style={{ width: '100%' }} onClick={() => go('transfers')}>Open transfers →</Button>
          )}
        </div>
      </div>
    );
  } else if (ent.kind === 'member') {
    const m = (D.members || []).find((x) => x.id === ent.memberId);
    bodyEl = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {m ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar name={m.name} size="md" />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</div>
          </div>
        ) : null}
        <Button variant="secondary" size="md" style={{ width: '100%' }} onClick={() => go('transactions')}>{isMember ? 'Review now →' : 'View transactions →'}</Button>
      </div>
    );
  } else {
    // route / none — a single CTA derived from the route.
    const route = ent.route || n.linkTo || 'overview';
    const label = route === 'transfers' ? 'Review transfers' : route === 'transactions' ? (isMember ? 'Review now' : 'Open transactions') : 'Open';
    bodyEl = <Button variant="secondary" size="md" style={{ width: '100%' }} onClick={() => go(route)}>{label} →</Button>;
  }

  const tc = toneColor[n.tone] || toneColor.info;
  const tb = toneBg[n.tone] || toneBg.info;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'relative', width: 'min(440px, 100%)', height: '100%', background: 'var(--bg-app)', borderLeft: '1px solid var(--border-hairline)', boxShadow: 'var(--shadow-pop)', overflowY: 'auto', padding: 'clamp(18px, 5vw, 26px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span className="zt-eyebrow">Notification</span>
          <button onClick={onClose} title="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'inline-flex', minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={18} /></button>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
          <span style={{ flex: 'none', width: 42, height: 42, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: tb, color: tc }}><Icon name={n.icon || 'bell'} size={20} /></span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{n.title}</div>
            {n.body ? <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 5, lineHeight: 1.5 }}>{n.body}</div> : null}
            {n.time ? <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>{n.time}</div> : null}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{bodyEl}</div>
      </div>

      {picker && MemberCategoryPicker ? (
        <MemberCategoryPicker
          onClose={() => setPicker(null)}
          onPick={(categoryId) => { const t = picker; setPicker(null); run(() => API.updateTransaction(t.id, { categoryId }, { learn: true })); }}
        />
      ) : null}
    </div>
  );
}

Object.assign(window, { ZHQNotificationDetail });
