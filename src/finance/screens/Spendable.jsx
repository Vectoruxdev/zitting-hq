import React from 'react';
import { pickCelebration, CELEBRATION_EMOJI } from '../celebrations';
import { downscaleReceiptPhoto } from './shared/imageDownscale';
import { searchLineItems, topItems } from './shared/receiptSearch';
/* Spendable — the member mobile experience: their spending money, the accounts
   they manage (with balances), savings, a browsable activity feed, and a
   finger-friendly categorize flow. Driven by D.memberHome (server-computed).
   Rendered inside a phone mockup on desktop (owner preview) and full-bleed on
   a real phone (see globals.css .zhq-phone-frame @media). */

/* Full-screen confetti + message card for the moment the review queue hits
   zero. The line comes from THIS member's celebration pack (picked when the
   trigger fires) — never another member's. Tap anywhere to dismiss. */
const CONFETTI_COLORS = ['var(--accent)', 'var(--indigo-500)', 'var(--amber-500)', '#f973ab', '#7c8cf8', '#ffffff'];
function MemberCelebration({ celebration, onClose }) {
  const pieces = React.useMemo(() => Array.from({ length: 90 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.9,
    dur: 2.4 + Math.random() * 2.2,
    size: 6 + Math.random() * 7,
    drift: (Math.random() - 0.5) * 160,
    spin: 360 + Math.random() * 720,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    round: Math.random() < 0.3,
  })), []);
  React.useEffect(() => {
    const t = setTimeout(onClose, 9000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 60, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)', cursor: 'pointer' }}>
      {pieces.map((p, i) => (
        <span key={i} className="zhq-confetti" style={{
          left: `${p.left}%`,
          width: p.size, height: p.round ? p.size : p.size * 0.45,
          background: p.color,
          borderRadius: p.round ? 999 : 2,
          '--drift': `${p.drift}px`,
          '--spin': `${p.spin}deg`,
          animationDelay: `${p.delay}s`,
          animationDuration: `${p.dur}s`,
        }} />
      ))}
      <div className="zhq-celeb-card" style={{ position: 'relative', maxWidth: 320, margin: '0 26px', background: 'var(--surface-card)', border: '1px solid var(--green-tint)', borderRadius: 'var(--radius-lg)', padding: '30px 26px', textAlign: 'center', boxShadow: '0 0 60px -12px rgba(63,208,127,0.45), var(--shadow-pop)' }}>
        <div style={{ fontSize: 46, lineHeight: 1, marginBottom: 14 }}>{CELEBRATION_EMOJI[celebration.tone] || '🎉'}</div>
        <div className="zt-eyebrow" style={{ color: 'var(--accent)', marginBottom: 10 }}>All approved</div>
        <div style={{ fontSize: 17.5, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.45 }}>{celebration.text}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 16 }}>Tap anywhere to keep going</div>
      </div>
    </div>
  );
}

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

// One transaction row. `review` mode shows Transfer + Approve actions; browse
// mode shows an approved checkmark. The category chip is always tappable.
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
            <Button variant="primary" size="md" onClick={onConfirm} disabled={busy}>Approve</Button>
          </>
        ) : t.reviewed ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--accent)', fontWeight: 600 }}><Icon name="check" size={14} /> Approved</span>
        ) : (
          <Button variant="primary" size="md" onClick={onConfirm} disabled={busy}>Approve</Button>
        )}
      </div>
    </div>
  );
}

// One transaction inside an expanded merchant group — shows the raw bank text
// (so you can tell what a check or Cash App payment actually was) with a
// tappable category chip to set just that one differently from the group.
function GroupTxnRow({ t, busy, onEditCat }) {
  const { Tag } = window.ZittingHQDesignSystem_c9e528;
  return (
    <div style={{ padding: '10px 0', opacity: busy ? 0.5 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description || t.merchant}</div>
        <span className="zt-num" style={{ flex: 'none', fontSize: 13.5, fontWeight: 700, color: t.amt >= 0 ? 'var(--accent)' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>{t.amt >= 0 ? '+' : '−'}${Math.abs(t.amt).toFixed(2)}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.date} · {t.account}</span>
        <button onClick={onEditCat} disabled={busy} style={{ flex: 'none', background: 'none', border: 'none', padding: 0, cursor: 'pointer', minHeight: 28 }}>
          <Tag color={t.color} size="sm">{t.cat} ✎</Tag>
        </button>
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
    try { await API.matchReceipt(receipt.id, txnId); onClose(); }
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

/* Receipts hub — scan a new receipt + the full searchable history. Every
   scanned line item is searchable, so a member can ask "how many apples this
   year" and see the count, the spend, and each purchase. Own receipts only. */
function ReceiptsHub({ receipts, scanBusy, onScan, onOpenReceipt, onClose }) {
  const { Modal, Icon, Button } = window.ZittingHQDesignSystem_c9e528;
  const [q, setQ] = React.useState('');
  const [period, setPeriod] = React.useState('year'); // 'year' | '12mo' | 'all'
  const money = (v) => (v < 0 ? '−$' : '$') + Math.abs(v).toFixed(2);

  // Period cutoff (purchase date, falling back to upload date on the row).
  const cutoffISO = React.useMemo(() => {
    const now = new Date();
    if (period === 'all') return '0000-00-00';
    if (period === '12mo') { const d = new Date(now); d.setFullYear(d.getFullYear(), d.getMonth() - 12, d.getDate()); return d.toISOString().slice(0, 10); }
    return `${now.getFullYear()}-01-01`;
  }, [period]);
  const scoped = React.useMemo(
    () => (receipts || []).filter((r) => (r.dateISO || '9999-99-99') >= cutoffISO),
    [receipts, cutoffISO]
  );

  const term = q.trim();
  const search = React.useMemo(() => (term ? searchLineItems(scoped, term) : null), [term, scoped]);
  const tops = React.useMemo(() => (term ? [] : topItems(scoped, 8)), [term, scoped]);

  const scopedSpend = scoped.reduce((s, r) => s + (r.total || 0), 0);
  const periodLabel = period === 'year' ? 'this year' : period === '12mo' ? 'in the last 12 months' : 'all time';

  const ItemTile = ({ label, qty, onClick }) => (
    <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 12px', borderRadius: 999, border: '1px solid var(--border-hairline)', background: 'var(--surface-card)', cursor: 'pointer', font: 'inherit', fontSize: 13, color: 'var(--text-primary)' }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{label}</span>
      <span className="zt-num" style={{ flex: 'none', fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>×{Math.round(qty)}</span>
    </button>
  );

  return (
    <Modal open onClose={onClose} title="Receipts" width={400}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Button variant="primary" size="md" style={{ width: '100%' }} disabled={scanBusy} iconLeft={<Icon name="camera" size={16} />} onClick={onScan}>
          {scanBusy ? 'Reading your receipt…' : 'Scan a new receipt'}
        </Button>

        {/* period filter */}
        <div style={{ display: 'flex', gap: 6, padding: 4, background: 'var(--surface-sunken)', borderRadius: 999 }}>
          {[{ k: 'year', l: 'This year' }, { k: '12mo', l: '12 months' }, { k: 'all', l: 'All time' }].map((p) => (
            <button key={p.k} onClick={() => setPeriod(p.k)} style={{ flex: 1, padding: '8px 0', borderRadius: 999, border: 'none', cursor: 'pointer', font: 'inherit', fontSize: 12.5, fontWeight: 600, background: period === p.k ? 'var(--surface-card)' : 'transparent', color: period === p.k ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{p.l}</button>
          ))}
        </div>

        {/* search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px', borderRadius: 999, background: 'var(--surface-card)', border: '1px solid var(--border-hairline)' }}>
          <Icon name="search" size={16} style={{ color: 'var(--text-tertiary)', flex: 'none' }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items — apples, milk…" style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 14 }} />
          {q ? <button onClick={() => setQ('')} style={{ flex: 'none', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'inline-flex' }}><Icon name="x" size={15} /></button> : null}
        </div>

        {!receipts.length ? (
          <div style={{ textAlign: 'center', padding: '28px 12px', color: 'var(--text-tertiary)', fontSize: 13.5, lineHeight: 1.6 }}>
            <span style={{ display: 'inline-flex', width: 52, height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center', background: 'var(--green-glow)', color: 'var(--accent)', marginBottom: 12 }}><Icon name="receipt" size={24} /></span>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No receipts yet</div>
            Scan one and we'll read every line item so you can search them later.
          </div>
        ) : term ? (
          /* ---- search results ---- */
          <>
            <div style={{ background: 'var(--surface-card)', border: '1px solid var(--green-tint)', borderRadius: 'var(--radius-md)', padding: 16 }}>
              <div className="zt-num" style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                {Math.round(search.qty)} <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)' }}>{term}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 5 }}>
                {money(search.spend)} across {search.receipts} receipt{search.receipts === 1 ? '' : 's'} · {periodLabel}
              </div>
            </div>
            {search.occ.length ? (
              <div style={{ maxHeight: '40vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {search.occ.map((o, i) => (
                  <button key={i} onClick={() => onOpenReceipt(o.receipt)} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '10px 2px', borderBottom: '1px solid var(--border-hairline)', background: 'none', border: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', font: 'inherit', textAlign: 'left', width: '100%' }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13.5, color: 'var(--text-primary)' }}>{o.name}{o.qty != null && o.qty !== 1 ? <span style={{ color: 'var(--text-tertiary)' }}> ×{o.qty}</span> : null}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{o.merchant}{o.date ? ` · ${o.date}` : ''}</span>
                    </span>
                    {o.price != null ? <span className="zt-num" style={{ flex: 'none', fontSize: 13, color: 'var(--text-secondary)' }}>{money(o.price)}</span> : null}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ padding: '18px 4px', fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>No “{term}” found {periodLabel}.</div>
            )}
          </>
        ) : (
          /* ---- default: stats + most-bought + history ---- */
          <>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                <div className="zt-num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{scoped.length}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>receipt{scoped.length === 1 ? '' : 's'} {periodLabel}</div>
              </div>
              <div style={{ flex: 1, background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                <div className="zt-num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{money(scopedSpend)}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>scanned total</div>
              </div>
            </div>

            {tops.length ? (
              <div>
                <div className="zt-eyebrow" style={{ marginBottom: 10 }}>Most bought</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {tops.map((it, i) => <ItemTile key={i} label={it.label} qty={it.qty} onClick={() => setQ(it.label)} />)}
                </div>
              </div>
            ) : null}

            <div>
              <div className="zt-eyebrow" style={{ marginBottom: 10 }}>History</div>
              <div style={{ maxHeight: '36vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {scoped.map((r) => {
                  const items = (r.lines || []).length;
                  return (
                    <button key={r.id} onClick={() => onOpenReceipt(r)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 12px', borderRadius: 'var(--radius-md)', border: `1px solid ${r.txn ? 'var(--border-hairline)' : 'var(--green-tint)'}`, background: 'var(--surface-card)', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
                      <span style={{ flex: 'none', width: 34, height: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: r.txn ? 'var(--surface-sunken)' : 'var(--green-glow)', color: r.txn ? 'var(--text-secondary)' : 'var(--accent)' }}><Icon name="receipt" size={16} /></span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.merchant || (r.txn && r.txn.merchant) || 'Receipt'}</span>
                        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{[r.receiptDate || r.uploaded, items ? `${items} item${items === 1 ? '' : 's'}` : null, r.txn ? null : 'tap to match'].filter(Boolean).join(' · ')}</span>
                      </span>
                      {r.totalLabel ? <span className="zt-num" style={{ flex: 'none', fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{r.totalLabel}</span> : null}
                    </button>
                  );
                })}
                {!scoped.length ? <div style={{ padding: '14px 4px', fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>No receipts {periodLabel}.</div> : null}
              </div>
            </div>
          </>
        )}
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

  // Restore the pre-refresh tab so a reload keeps the member where they were
  // (Home / Activity / Review) instead of bouncing back to Home.
  const [tab, setTab] = React.useState(() => {
    try {
      const t = typeof window !== 'undefined' ? window.sessionStorage.getItem('zhq-member-tab') : null;
      return t === 'home' || t === 'activity' || t === 'categorize' ? t : 'home';
    } catch { return 'home'; }
  });
  React.useEffect(() => {
    try { window.sessionStorage.setItem('zhq-member-tab', tab); }
    catch { /* storage blocked — losing the tab on refresh is fine */ }
  }, [tab]);
  const [acctOpen, setAcctOpen] = React.useState(false); // account menu (Log out lives here)
  const [picker, setPicker] = React.useState(null); // txn id being categorized
  const [groupPicker, setGroupPicker] = React.useState(null); // merchant group being set
  const [reviewMode, setReviewMode] = React.useState('merchant'); // 'merchant' | 'single'
  const [busy, setBusy] = React.useState(null); // txn id (or 'bulk') mid-action
  const [acctFilter, setAcctFilter] = React.useState('all'); // Activity account filter
  const [actStatus, setActStatus] = React.useState('all'); // Activity approval filter: all | pending | approved
  const [bulkUndo, setBulkUndo] = React.useState(() => (typeof window !== 'undefined' ? window.__ZHQ_BULK_UNDO || null : null));

  // Optimistic overlay: txnId -> what was just applied locally ({ categoryId,
  // transfer }). Written synchronously on tap so cards/rows react instantly
  // while the server action runs in the background; entries are dropped once
  // fresh server data confirms them (prune effect below) or rolled back if the
  // action fails. Mirrored on window (like __ZHQ_BULK_UNDO) so an
  // ErrorBoundary reset can't resurrect already-handled groups.
  const [optimistic, setOptimisticState] = React.useState(() => (typeof window !== 'undefined' ? window.__ZHQ_OPTIMISTIC || {} : {}));
  const setOpt = (updater) => setOptimisticState((prev) => { const next = updater(prev); if (typeof window !== 'undefined') window.__ZHQ_OPTIMISTIC = next; return next; });
  const addOptimistic = (entries) => setOpt((prev) => ({ ...prev, ...entries }));
  const dropOptimistic = (ids) => setOpt((prev) => { const next = { ...prev }; for (const id of ids) delete next[id]; return next; });
  const [inflight, setInflight] = React.useState(0); // bulk applies still awaiting the server
  const catById = new Map((D.allCategories || []).map((c) => [c.id, c]));
  // A txn row with any just-applied overlay folded in (instant chip updates).
  const withOverlay = (t) => {
    const o = optimistic[t.id];
    if (!o) return t;
    const oc = o.categoryId ? catById.get(o.categoryId) : null;
    return { ...t, reviewed: true, cat: oc ? oc.name : t.cat, color: oc ? oc.color : t.color };
  };

  // No router.refresh() after these actions: they revalidatePath("/finance")
  // server-side, so the action response itself already carries the fresh page
  // payload. A client refresh here would recompute everything a second time.
  async function run(id, fn, rollbackIds) {
    setBusy(id);
    try { await fn(); }
    catch { if (rollbackIds) dropOptimistic(rollbackIds); }
    finally { setBusy(null); }
  }
  const pickCategory = (id, categoryId) => { addOptimistic({ [id]: { categoryId } }); return run(id, () => API.updateTransaction(id, { categoryId }, { learn: true }), [id]); };
  const confirmOne = (id) => { addOptimistic({ [id]: { categoryId: null } }); return run(id, () => API.confirmTransactions([id]), [id]); };
  const markTransfer = (id) => { addOptimistic({ [id]: { categoryId: null, transfer: true } }); return run(id, () => API.markTransfer(id, true), [id]); };

  // --- bulk (by-merchant) categorize, scoped to the member's accounts ---
  const setBulkSnap = (snap) => { if (typeof window !== 'undefined') window.__ZHQ_BULK_UNDO = snap; setBulkUndo(snap); };
  const mergeBulkSnap = (fn) => setBulkUndo((prev) => { const next = fn(prev); if (typeof window !== 'undefined') window.__ZHQ_BULK_UNDO = next; return next; });
  async function applyGroups(groups, label) {
    if (!groups.length || !API.applyBulkCategories) return;
    // Optimistic: hide the groups + show the undo banner immediately; the
    // server catches up in the background and taps stay responsive (the
    // router queues concurrent actions in order).
    const entries = {};
    for (const g of groups) for (const id of g.ids) entries[id] = { categoryId: g.categoryId };
    const ids = Object.keys(entries).map(Number);
    addOptimistic(entries);
    mergeBulkSnap((prev) => prev && !prev.failed
      ? { pairs: prev.pairs || [], count: prev.count + ids.length, label: null }
      : { pairs: [], count: ids.length, label });
    setInflight((n) => n + 1);
    try {
      const res = await API.applyBulkCategories(groups.map((g) => ({ ids: g.ids, categoryId: g.categoryId })));
      if (res && res.undo) {
        mergeBulkSnap((prev) => {
          if (!prev || prev.failed) return prev; // dismissed mid-flight — stay dismissed
          // First snapshot wins per id: with overlapping taps, the earliest
          // prior state is the correct restore point.
          const seen = new Set((prev.pairs || []).map((p) => p.id));
          return { ...prev, pairs: [...(prev.pairs || []), ...res.undo.filter((p) => !seen.has(p.id))] };
        });
      }
    } catch {
      dropOptimistic(ids); // roll back just this tap — the cards come back
      mergeBulkSnap((prev) => {
        const count = (prev && !prev.failed ? prev.count : 0) - ids.length;
        return count > 0 ? { ...prev, count } : { failed: true };
      });
    } finally { setInflight((n) => n - 1); }
  }
  const acceptGroup = (g) => applyGroups([{ ids: g.ids, categoryId: g.suggestion.categoryId }], `${g.merchant} → ${g.suggestion.name}`);
  const setGroup = (g, categoryId) => applyGroups([{ ids: g.ids, categoryId }], g.merchant);
  async function undoBulk() {
    if (!bulkUndo || !bulkUndo.pairs || !bulkUndo.pairs.length || !API.restoreTransactionCategories) return;
    setBusy('bulk');
    try {
      await API.restoreTransactionCategories(bulkUndo.pairs);
      setBulkSnap(null);
      setOpt(() => ({})); // the restore invalidates everything applied locally
    } finally { setBusy(null); }
  }
  const bulkGroups = (D.bulkGroups || []).filter((g) => (g.unreviewed > 0 || g.uncategorized > 0) && g.ids.some((id) => !optimistic[id]));
  // Which merchant group is expanded to show its underlying transactions.
  const [openGroup, setOpenGroup] = React.useState(null);
  const acceptAllGroups = () => {
    const t = bulkGroups.filter((g) => g.suggestion && g.suggestion.confidence >= 0.7);
    applyGroups(t.map((g) => ({ ids: g.ids, categoryId: g.suggestion.categoryId })), `${t.length} suggestions`);
  };

  const accounts = (H && H.managedAccounts) || [];
  const rawQueue = (H && H.reviewQueue) || [];
  const queue = rawQueue.filter((t) => !optimistic[t.id]);
  const myReceipts = (H && H.receipts) || [];
  const [snapBusy, setSnapBusy] = React.useState(false);
  const [snapResult, setSnapResult] = React.useState(null); // upload outcome banner
  const [matchSheet, setMatchSheet] = React.useState(null); // receipt being matched
  const [breakdown, setBreakdown] = React.useState(null); // receipt being viewed
  const [receiptsHub, setReceiptsHub] = React.useState(false); // the receipts hub modal
  const snapInput = React.useRef(null);
  // Open a receipt from the hub/list: matched → breakdown, unmatched → match flow.
  const openReceipt = (r) => (r && r.txn ? setBreakdown(r) : setMatchSheet(r));
  async function onSnap(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file || !API.uploadReceipt) return;
    setSnapBusy(true);
    setSnapResult(null);
    try {
      // Camera photos are 3-12MB; shrink to ~2000px JPEG before upload so it's
      // fast on cell data and within the scanner's limits.
      const upload = await downscaleReceiptPhoto(file);
      const fd = new FormData();
      fd.append('file', upload);
      const res = await API.uploadReceipt(fd);
      if (res && res.ok === false) setSnapResult({ tone: 'bad', text: res.error || 'Upload failed' });
      else if (res) {
        if (res.matchedTxnId != null) setSnapResult({ tone: 'good', text: `Matched${res.merchant ? ` — ${res.merchant}` : ''}${res.total != null ? ` · $${res.total.toFixed(2)}` : ''}. Receipt attached!` });
        else if (res.scanned) setSnapResult({ tone: 'mid', text: `Read it${res.merchant ? ` — ${res.merchant}` : ''}${res.total != null ? ` · $${res.total.toFixed(2)}` : ''}. Pick which purchase it belongs to below.`, receiptId: res.id });
        else setSnapResult({ tone: 'mid', text: 'Saved! Attach it to a purchase below.', receiptId: res.id });
      }
    } catch {
      setSnapResult({ tone: 'bad', text: 'Upload failed — try again' });
    } finally { setSnapBusy(false); }
  }
  const activity = (H && H.activity) || [];
  // Drop overlay entries once fresh server data confirms them (or the txn is
  // gone, e.g. reclassified as a transfer and excluded from the member feed).
  React.useEffect(() => {
    setOpt((prev) => {
      const keys = Object.keys(prev);
      if (!keys.length) return prev;
      const byId = new Map(activity.map((t) => [t.id, t]));
      let changed = false;
      const next = { ...prev };
      for (const k of keys) {
        const t = byId.get(Number(k));
        const o = prev[k];
        const confirmed = !t
          || (o.transfer ? !!t.isTransfer : o.categoryId ? t.categoryId === o.categoryId : t.reviewed);
        if (confirmed) { delete next[k]; changed = true; }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [D]);
  // --- celebration: fires the moment THIS member's queue goes >0 → 0 ---
  // Effective remaining includes the optimistic overlay, so the confetti pops
  // on the very tap that clears the last one. The line is picked from this
  // member's own celebration pack (H.celebrationStyle) — per-login payload,
  // so nobody ever sees another member's messages.
  const [celebration, setCelebration] = React.useState(null);
  const effectiveRemaining = H ? Math.max(0, H.totalRemaining - (rawQueue.length - queue.length)) : null;
  const celebStyle = (H && H.celebrationStyle) || 'spicy';
  const prevRemaining = React.useRef(null);
  React.useEffect(() => {
    const prev = prevRemaining.current;
    prevRemaining.current = effectiveRemaining;
    if (prev != null && prev > 0 && effectiveRemaining === 0) setCelebration(pickCelebration(celebStyle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveRemaining]);
  React.useEffect(() => {
    // Console/demo hook: window.ZHQ_CELEBRATE('spicy'|'clean'|'off') previews the moment.
    window.ZHQ_CELEBRATE = (style) => setCelebration(pickCelebration(style || celebStyle));
    return () => { delete window.ZHQ_CELEBRATE; };
  }, [celebStyle]);
  // Lets the notification detail overlay (owned by FinanceApp) drive the member's
  // tabs — e.g. a "Review now" CTA jumps to Categorize. Mirrors ZHQ_CELEBRATE.
  React.useEffect(() => {
    window.ZHQ_MEMBER_NAV = (t) => { if (t === 'home' || t === 'activity' || t === 'categorize') setTab(t); };
    return () => { delete window.ZHQ_MEMBER_NAV; };
  }, []);
  // Member notifications (already audience+account scoped server-side).
  const memberNotifs = (D.notifications) || [];
  // Only real (numeric-id) alerts count toward the badge — robust against any
  // future derived/string-id alert that can't be marked read.
  const memberUnread = memberNotifs.filter((n) => n && n.unread && typeof n.id === 'number').length;
  const [notifOpen, setNotifOpen] = React.useState(false);
  // Opening the bell clears the counter — standard "open the center → badge
  // resets" behavior. Fires once per open (deps = [notifOpen]); the refresh it
  // triggers leaves notifOpen true, so it won't loop. Read history still lists.
  React.useEffect(() => {
    if (!notifOpen) return;
    const API = window.ZHQ_API || {};
    if (!API.markNotificationsRead) return;
    const hasUnread = ((window.ZHQ_DATA && window.ZHQ_DATA.notifications) || []).some((n) => n && n.unread && typeof n.id === 'number');
    if (!hasUnread) return;
    API.markNotificationsRead().then(() => window.ZHQ_REFRESH && window.ZHQ_REFRESH()).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifOpen]);

  // Pull-to-refresh: members have no other way to pull fresh data (sync is
  // owner-only + the daily cron), and native pull-to-refresh doesn't fire on an
  // inner scroll container inside the phone frame / installed PWA. So we own the
  // gesture and call ZHQ_REFRESH (re-fetches the latest synced data).
  const scrollRef = React.useRef(null);
  const [pullPx, setPullPx] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    let startY = 0;
    let pulling = false;
    const onStart = (e) => { pulling = el.scrollTop <= 0; startY = e.touches[0].clientY; };
    const onMove = (e) => {
      if (!pulling || refreshing) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0 && el.scrollTop <= 0) {
        e.preventDefault(); // we own the pull — stop the native bounce
        setPullPx(Math.min(dy * 0.5, 80));
      } else {
        pulling = false;
        setPullPx(0);
      }
    };
    const onEnd = () => {
      if (!pulling) return;
      pulling = false;
      setPullPx((p) => {
        if (p >= 56 && !refreshing) {
          setRefreshing(true);
          try { window.ZHQ_REFRESH && window.ZHQ_REFRESH(); } catch { /* noop */ }
          setTimeout(() => { setRefreshing(false); setPullPx(0); }, 1400);
          return 44; // hold the spinner briefly
        }
        return 0;
      });
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [refreshing]);

  const budgets = (H && H.budgets) || [];
  const goals = (D.goals || []).filter((g) => !g.archived);
  const allowance = H ? H.allowance : 0;
  const unlocked = H ? H.allowanceUnlocked : true;
  const perf = (H && H.performance) || null;

  const filteredActivity = activity
    .filter((t) => acctFilter === 'all' || t.accountId === acctFilter)
    .filter((t) => actStatus === 'all' || (actStatus === 'pending' ? !t.reviewed : t.reviewed));

  const tabs = [
    { key: 'home', icon: 'wallet', label: 'Home' },
    { key: 'activity', icon: 'receipt', label: 'Activity' },
    // Badge tracks the optimistic overlay so it ticks down with every tap.
    { key: 'categorize', icon: 'list', label: 'Approve', badge: Math.max(0, (H ? H.totalRemaining : 0) - (rawQueue.length - queue.length)) },
  ];

  const sectionTitle = (txt) => (
    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '24px 0 12px' }}>{txt}</div>
  );

  return (
    <ZHQPhoneFrame>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain', padding: 'max(8px, env(safe-area-inset-top)) 18px 24px' }}>
          {/* pull-to-refresh spinner — height grows with the pull, holds while refreshing */}
          <div style={{ height: refreshing ? 44 : pullPx, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: pullPx === 0 || refreshing ? 'height 200ms ease' : 'none', color: 'var(--text-tertiary)', flex: 'none' }}>
            {refreshing || pullPx > 4 ? (
              <Icon name="repeat" size={18} className={refreshing ? 'zhq-spin' : undefined} style={{ opacity: refreshing ? 1 : Math.min(1, pullPx / 56) }} />
            ) : null}
          </div>
          {/* header — avatar/name opens the account menu; the grid button jumps
              to the family dashboard (calendar, meals, groceries, …) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 18px' }}>
            <button onClick={() => setAcctOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
              <Avatar name={name} size="md" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Welcome back</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
              </div>
              <span style={{ flex: 'none', width: 38, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: 'var(--surface-card)', color: 'var(--text-tertiary)' }}><Icon name="chevronDown" size={18} /></span>
            </button>
            <button onClick={() => setNotifOpen(true)} title="Notifications" style={{ position: 'relative', flex: 'none', width: 38, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: 'var(--surface-card)', border: '1px solid var(--border-hairline)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <Icon name="bell" size={18} />
              {memberUnread > 0 ? <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: 'var(--warning)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{memberUnread}</span> : null}
            </button>
            <button onClick={() => { window.location.href = '/'; }} title="Family HQ — calendar, meals, groceries" style={{ flex: 'none', width: 38, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: 'var(--surface-card)', border: '1px solid var(--border-hairline)', color: 'var(--accent)', cursor: 'pointer' }}>
              <Icon name="grid" size={18} />
            </button>
          </div>

          {/* receipt capture input — always mounted so the camera FAB works from
              any tab; capture="environment" opens the camera directly on phones */}
          <input ref={snapInput} type="file" accept="image/*" capture="environment" onChange={onSnap} style={{ display: 'none' }} />

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
                            <Icon name="clock" size={16} /> Locked — {H.prevMonthRemaining} left to approve in {H.prevMonthLabel}
                          </span>
                          <div style={{ marginTop: 12 }}>
                            <Button variant="primary" size="md" style={{ width: '100%' }} onClick={() => setTab('categorize')}>Finish {H.prevMonthLabel} →</Button>
                          </div>
                          <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                            Your allowance unlocks once you've approved everything from the month before.
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
                    <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>{H.totalRemaining} to approve</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>Takes about a minute — keeps your numbers honest.</span>
                  </span>
                  <Icon name="chevronRight" size={17} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                </button>
              ) : null}

              {/* receipts — opens the hub (scan a new one, search items, history) */}
              <button onClick={() => setReceiptsHub(true)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', marginTop: 14, padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--green-tint)', background: 'var(--surface-card)', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
                <span style={{ flex: 'none', width: 38, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: 'var(--green-glow)', color: 'var(--accent)' }}><Icon name="camera" size={18} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>Receipts</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {myReceipts.length ? `Scan a new one or search ${myReceipts.length} saved receipt${myReceipts.length === 1 ? '' : 's'}.` : 'Scan a receipt — we read every line item so you can search them.'}
                  </span>
                </span>
                <Icon name="chevronRight" size={17} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              </button>

              {/* recent receipts preview — tap one to view, or open the hub for all */}
              {myReceipts.length ? (
                <>
                  {sectionTitle('Recent receipts')}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {myReceipts.slice(0, 3).map((r) => {
                      const matched = !!r.txn;
                      return (
                        <button key={r.id} onClick={() => openReceipt(r)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '13px 14px', borderRadius: 'var(--radius-md)', border: `1px solid ${matched ? 'var(--border-hairline)' : 'var(--green-tint)'}`, background: 'var(--surface-card)', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
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
                    {myReceipts.length > 3 ? (
                      <button onClick={() => setReceiptsHub(true)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: '4px 2px', cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>Search all receipts →</button>
                    ) : null}
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
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{a.reviewed}/{a.total} approved in {H.monthLabel}</span>
                        {a.done ? <Badge tone="positive" size="sm">Done</Badge>
                          : a.remaining > 0 ? <span className="zt-num" style={{ fontSize: 12.5, color: 'var(--warning)', fontWeight: 600 }}>{a.remaining} to approve</span>
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
              {/* approval status filter */}
              <div className="zhq-hscroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 12 }}>
                {[{ k: 'all', label: 'All' }, { k: 'pending', label: 'Needs approval' }, { k: 'approved', label: 'Approved' }].map((s) => (
                  <button key={s.k} onClick={() => setActStatus(s.k)} style={{ flex: 'none', padding: '9px 15px', borderRadius: 999, border: '1px solid var(--border-hairline)', background: actStatus === s.k ? 'var(--accent)' : 'var(--surface-card)', color: actStatus === s.k ? 'var(--text-on-accent)' : 'var(--text-secondary)', font: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', minHeight: 40 }}>{s.label}</button>
                ))}
              </div>
              {filteredActivity.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 10px', color: 'var(--text-tertiary)', fontSize: 14 }}>{actStatus === 'pending' ? 'Nothing needs your approval right now.' : actStatus === 'approved' ? 'Nothing approved yet.' : 'No transactions yet on this account.'}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {filteredActivity.map((t) => (
                    <MemberTxnRow key={t.id} t={withOverlay(t)} review={false} busy={busy === t.id}
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
                bulkUndo.failed ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', marginBottom: 14, borderRadius: 'var(--radius-md)', background: 'var(--surface-card)', border: '1px solid var(--border-hairline)' }}>
                    <Icon name="alert" size={16} style={{ color: 'var(--warning)', flex: 'none' }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text-primary)' }}>Couldn&rsquo;t save — try again</span>
                    <button onClick={() => setBulkSnap(null)} style={{ flex: 'none', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 36, minHeight: 36 }}><Icon name="x" size={14} /></button>
                  </div>
                ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', marginBottom: 14, borderRadius: 'var(--radius-md)', background: 'var(--green-glow)', border: '1px solid var(--green-tint)' }}>
                  <Icon name="check" size={16} style={{ color: 'var(--accent)', flex: 'none' }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text-primary)' }}>Categorized {bulkUndo.count}{bulkUndo.label ? ` · ${bulkUndo.label}` : ''}</span>
                  {/* Undo arms once the in-flight saves return their restore snapshot */}
                  <Button variant="ghost" size="sm" disabled={busy === 'bulk' || inflight > 0 || !(bulkUndo.pairs && bulkUndo.pairs.length)} onClick={undoBulk}>Undo</Button>
                  <button onClick={() => setBulkSnap(null)} style={{ flex: 'none', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 36, minHeight: 36 }}><Icon name="x" size={14} /></button>
                </div>
                )
              ) : null}

              {queue.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 10px' }}>
                  <span style={{ display: 'inline-flex', width: 60, height: 60, borderRadius: 999, alignItems: 'center', justifyContent: 'center', background: 'var(--green-glow)', color: 'var(--accent)', marginBottom: 16 }}><Icon name="check" size={28} /></span>
                  <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>All caught up</div>
                  <div style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 6 }}>You've approved everything for {H.monthLabel}.</div>
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
                          <b style={{ color: 'var(--text-primary)' }}>{bulkGroups.length}</b> merchant{bulkGroups.length === 1 ? '' : 's'} to approve. Set a whole merchant at once.
                        </div>
                        {bulkGroups.filter((g) => g.suggestion && g.suggestion.confidence >= 0.7).length ? (
                          <Button variant="primary" size="sm" disabled={busy === 'bulk'} onClick={acceptAllGroups}>Accept all</Button>
                        ) : null}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {bulkGroups.map((g) => (
                          <div key={g.key} style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', padding: 14, opacity: busy === 'bulk' ? 0.5 : 1 }}>
                            {/* tap the header to see the transactions inside the group */}
                            <button onClick={() => setOpenGroup(openGroup === g.key ? null : g.key)} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.merchant}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{g.count} txn{g.count === 1 ? '' : 's'} · {g.spendLabel}{g.dateRange ? ` · ${g.dateRange}` : ''}</div>
                              </div>
                              <Badge tone="neutral" size="sm">{g.count}</Badge>
                              <Icon name="chevronDown" size={16} style={{ color: 'var(--text-tertiary)', flex: 'none', transform: openGroup === g.key ? 'rotate(180deg)' : 'none', transition: 'transform .15s ease' }} />
                            </button>
                            {openGroup === g.key ? (() => {
                              // Resolve the group's txn ids against the activity feed (newest
                              // first) — shows raw bank text so "Check" / "Cash App" rows are
                              // tellable apart, each categorizable on its own.
                              const idSet = new Set(g.ids);
                              const rows = activity.filter((t) => idSet.has(t.id));
                              const shown = rows.slice(0, 30);
                              const unresolved = g.ids.length - rows.length;
                              return (
                                <div style={{ borderTop: '1px solid var(--border-hairline)', marginBottom: 12 }}>
                                  {shown.map((t) => (
                                    <div key={t.id} style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                                      <GroupTxnRow t={withOverlay(t)} busy={busy === t.id} onEditCat={() => setPicker(t.id)} />
                                    </div>
                                  ))}
                                  {rows.length > shown.length ? (
                                    <div style={{ padding: '8px 0', fontSize: 12, color: 'var(--text-tertiary)' }}>+{rows.length - shown.length} more</div>
                                  ) : null}
                                  {unresolved > 0 ? (
                                    <div style={{ padding: '8px 0', fontSize: 12, color: 'var(--text-tertiary)' }}>+{unresolved} on other accounts</div>
                                  ) : null}
                                </div>
                              );
                            })() : null}
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
                        <b style={{ color: 'var(--text-primary)' }}>{queue.length}</b> transaction{queue.length === 1 ? '' : 's'} to approve. Tap the category to change it, then Approve.
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

        {/* snap-result toast — floats over any tab so the scan outcome is never missed */}
        {snapResult ? (
          <div style={{ position: 'absolute', top: 'max(58px, calc(env(safe-area-inset-top) + 50px))', left: 14, right: 14, zIndex: 55, display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 'var(--radius-md)', background: snapResult.tone === 'good' ? 'var(--green-glow)' : 'var(--surface-card)', border: `1px solid ${snapResult.tone === 'good' ? 'var(--green-tint)' : snapResult.tone === 'bad' ? 'var(--negative)' : 'var(--border-hairline)'}`, boxShadow: 'var(--shadow-pop)' }}>
            <Icon name={snapResult.tone === 'good' ? 'check' : snapResult.tone === 'bad' ? 'alert' : 'receipt'} size={16} style={{ color: snapResult.tone === 'good' ? 'var(--accent)' : snapResult.tone === 'bad' ? 'var(--negative)' : 'var(--text-secondary)', flex: 'none' }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>{snapResult.text}</span>
            {snapResult.receiptId ? (
              <Button variant="secondary" size="sm" onClick={() => { const r = myReceipts.find((x) => x.id === snapResult.receiptId); if (r) { setMatchSheet(r); setSnapResult(null); } }}>Pick</Button>
            ) : null}
            <button onClick={() => setSnapResult(null)} style={{ flex: 'none', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 36, minHeight: 36 }}><Icon name="x" size={14} /></button>
          </div>
        ) : null}

        {/* camera FAB — opens the receipts hub (scan + search + history) */}
        {H ? (
          <button onClick={() => setReceiptsHub(true)} disabled={snapBusy} title="Receipts"
            style={{ position: 'absolute', right: 16, bottom: 'calc(92px + env(safe-area-inset-bottom))', zIndex: 40, width: 56, height: 56, borderRadius: 999, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent)', color: 'var(--text-on-accent, #06281a)', boxShadow: '0 10px 28px -8px rgba(63,208,127,0.65)', opacity: snapBusy ? 0.6 : 1 }}>
            <Icon name="camera" size={24} />
          </button>
        ) : null}

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

      {receiptsHub ? (
        <ReceiptsHub
          receipts={myReceipts}
          scanBusy={snapBusy}
          onScan={() => snapInput.current && snapInput.current.click()}
          onOpenReceipt={(r) => { setReceiptsHub(false); openReceipt(r); }}
          onClose={() => setReceiptsHub(false)}
        />
      ) : null}
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
      {notifOpen && Modal ? (
        <Modal open onClose={() => setNotifOpen(false)} title="Notifications" width={360}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '62vh', overflowY: 'auto' }}>
            {window.ZHQPushPrompt ? <div style={{ marginBottom: 4 }}><window.ZHQPushPrompt compact /></div> : null}
            {memberNotifs.length ? memberNotifs.map((n) => (
              <button key={n.id} onClick={() => { setNotifOpen(false); window.ZHQ_OPEN_NOTIF && window.ZHQ_OPEN_NOTIF(n); }} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, width: '100%', textAlign: 'left', padding: '12px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-hairline)', background: n.unread ? 'var(--surface-card)' : 'transparent', cursor: 'pointer', font: 'inherit' }}>
                <span style={{ flex: 'none', width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: n.tone === 'accent' ? 'var(--green-glow)' : 'var(--surface-sunken)', color: n.tone === 'warning' || n.tone === 'negative' ? 'var(--warning)' : 'var(--accent)' }}><Icon name={n.icon || 'bell'} size={15} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{n.title}</span>
                  {n.body ? <span style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, lineHeight: 1.4 }}>{n.body}</span> : null}
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>{n.time}</span>
                </span>
                {n.unread ? <span style={{ flex: 'none', width: 8, height: 8, borderRadius: 999, background: 'var(--accent)', marginTop: 4 }} /> : null}
              </button>
            )) : (
              <div style={{ textAlign: 'center', padding: '40px 16px' }}>
                <span style={{ display: 'inline-flex', width: 60, height: 60, borderRadius: 999, alignItems: 'center', justifyContent: 'center', background: 'var(--green-glow)', marginBottom: 14, fontSize: 28 }} role="img" aria-label="celebration">🎉</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Congratulations!</div>
                <div style={{ fontSize: 13.5, color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.5 }}>You&rsquo;ve viewed all of your notifications.</div>
              </div>
            )}
          </div>
        </Modal>
      ) : null}
      {celebration ? <MemberCelebration celebration={celebration} onClose={() => setCelebration(null)} /> : null}
    </ZHQPhoneFrame>
  );
}

Object.assign(window, { ZHQSpendable, ZHQPhoneFrame, MemberCategoryPicker, MemberTxnRow });
