import React from 'react';
import { downscaleReceiptPhoto } from './shared/imageDownscale';
/* Receipts — uploaded receipt images, matched to transactions. Reads
   D.receipts (server-derived); images live in a private storage bucket and
   thumbnails load via the receiptSignedUrl action (short-lived URLs).
   Capture/upload uses a hidden file input with capture="environment" so on
   mobile it opens straight into the camera. */

function useSignedUrl(receiptId) {
  const [url, setUrl] = React.useState(null);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    let on = true;
    const api = window.ZHQ_API;
    if (!api || !api.receiptSignedUrl) return undefined;
    api.receiptSignedUrl(receiptId).then((r) => {
      if (!on) return;
      if (r && r.ok) setUrl(r.url);
      else setFailed(true);
    }).catch(() => { if (on) setFailed(true); });
    return () => { on = false; };
  }, [receiptId]);
  return { url, failed };
}

function MatchModal({ receipt, onClose }) {
  const { Modal, TextInput, Tag } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA || {};
  const [q, setQ] = React.useState('');
  const txns = (D.txns || []).slice().reverse();
  const needle = q.trim().toLowerCase();
  const list = (needle
    ? txns.filter((t) => `${t.merchant} ${t.amt} ${t.date}`.toLowerCase().includes(needle))
    : txns
  ).slice(0, 40);
  const pick = async (t) => {
    await window.ZHQ_API.matchReceipt(receipt.id, t.id);
    window.ZHQ_REFRESH && window.ZHQ_REFRESH();
    onClose();
  };
  return (
    <Modal open onClose={onClose} title="Match to a transaction" width={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <TextInput placeholder="Search merchant, amount, date…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <div style={{ maxHeight: '50vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {list.length === 0 ? (
            <div style={{ padding: '18px 4px', fontSize: 13, color: 'var(--text-tertiary)' }}>No matching transactions.</div>
          ) : list.map((t) => (
            <button key={t.id} type="button" onClick={() => pick(t)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '11px 8px', width: '100%',
              background: 'none', border: 'none', borderBottom: '1px solid var(--border-hairline)',
              cursor: 'pointer', font: 'inherit', textAlign: 'left', color: 'var(--text-primary)',
            }}>
              <span className="zt-num" style={{ fontSize: 12, color: 'var(--text-tertiary)', width: 48, flex: 'none' }}>{t.date}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.merchant}</span>
              {t.cat ? <Tag color={t.color} size="sm">{t.cat}</Tag> : null}
              <span className="zt-num" style={{ fontSize: 13, fontWeight: 600, flex: 'none' }}>
                {(t.amt < 0 ? '−$' : '+$') + Math.abs(t.amt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function ReceiptCard({ r }) {
  const { Card, Button, Icon, Tag } = window.ZittingHQDesignSystem_c9e528;
  const { url, failed } = useSignedUrl(r.id);
  const [matching, setMatching] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [showLines, setShowLines] = React.useState(false);
  const api = window.ZHQ_API;
  const unmatch = async () => { await api.matchReceipt(r.id, null); window.ZHQ_REFRESH && window.ZHQ_REFRESH(); };
  const remove = async () => { await api.deleteReceipt(r.id); window.ZHQ_REFRESH && window.ZHQ_REFRESH(); };
  return (
    <Card style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <a
        href={url || undefined}
        target="_blank"
        rel="noreferrer"
        style={{
          display: 'block', height: 150, background: 'var(--surface-sunken)',
          cursor: url ? 'zoom-in' : 'default',
        }}
        aria-label={r.filename ? `Open ${r.filename}` : 'Open receipt'}
      >
        {url ? (
          <img src={url} alt={r.filename || 'Receipt'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--text-tertiary)' }}>
            <Icon name="receipt" size={26} />
            {failed ? <span style={{ fontSize: 11.5, marginTop: 6 }}>Preview unavailable</span> : null}
          </div>
        )}
      </a>
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.merchant || r.filename || 'Receipt'}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
              {[r.totalLabel, r.receiptDate, r.uploaded, r.uploadedBy].filter(Boolean).join(' · ')}
            </div>
          </div>
          <Tag size="sm" color={r.status === 'matched' ? 'var(--accent)' : 'var(--gray-500)'}>
            {r.status === 'matched' ? 'Matched' : 'Inbox'}
          </Tag>
        </div>
        {r.txn ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)' }}>
            <Icon name="list" size={14} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.txn.merchant} · {r.txn.date}
            </span>
            <span className="zt-num" style={{ fontWeight: 600 }}>{r.txn.amount}</span>
          </div>
        ) : r.suggestedTxn ? (
          /* the scanner's best guess — one tap to accept */
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--green-glow)', border: '1px solid var(--green-tint)' }}>
            <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Looks like {r.suggestedTxn.merchant}</div>
              <div>{r.suggestedTxn.date} · {r.suggestedTxn.amount}</div>
            </div>
            <Button variant="primary" size="sm" onClick={async () => { await api.matchReceipt(r.id, r.suggestedTransactionId); window.ZHQ_REFRESH && window.ZHQ_REFRESH(); }}>Accept</Button>
          </div>
        ) : null}
        {(r.lines || []).length ? (
          <>
            <button onClick={() => setShowLines((v) => !v)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'left', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Icon name={showLines ? 'chevronDown' : 'chevronRight'} size={12} />
              {r.lines.length} item{r.lines.length === 1 ? '' : 's'}
            </button>
            {showLines ? (
              <div style={{ maxHeight: 170, overflowY: 'auto', borderTop: '1px solid var(--border-hairline)' }}>
                {r.lines.map((l, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-hairline)', fontSize: 12 }}>
                    <span style={{ flex: 1, minWidth: 0, color: 'var(--text-primary)' }}>{l.name}{l.qty != null && l.qty !== 1 ? ` ×${l.qty}` : ''}</span>
                    <span className="zt-num" style={{ flex: 'none', color: l.price != null && l.price < 0 ? 'var(--accent)' : 'var(--text-secondary)' }}>{l.price == null ? '' : (l.price < 0 ? '−$' : '$') + Math.abs(l.price).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
        <div style={{ display: 'flex', gap: 8 }}>
          {r.status === 'matched' ? (
            <Button variant="ghost" size="sm" onClick={unmatch}>Unmatch</Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setMatching(true)}>Match…</Button>
          )}
          <div style={{ flex: 1 }} />
          {confirmDelete ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Keep</Button>
              <Button variant="destructive" size="sm" onClick={remove}>Delete</Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>Delete</Button>
          )}
        </div>
      </div>
      {matching ? <MatchModal receipt={r} onClose={() => setMatching(false)} /> : null}
    </Card>
  );
}

/* Capture/upload entry — hidden file input; capture="environment" opens the
   camera directly on mobile. */
function ZHQCaptureFlow({ children }) {
  const inputRef = React.useRef(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);
  const onPick = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const upload = await downscaleReceiptPhoto(file);
      const fd = new FormData();
      fd.append('file', upload);
      const res = await window.ZHQ_API.uploadReceipt(fd);
      if (res && res.ok === false) setError(res.error || 'Upload failed');
      else window.ZHQ_REFRESH && window.ZHQ_REFRESH();
    } catch {
      setError('Upload failed');
    }
    setBusy(false);
  };
  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onPick} />
      {children({ open: () => inputRef.current && inputRef.current.click(), busy, error })}
    </>
  );
}

function ZHQReceipts() {
  const { Button, Icon, EmptyState } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA || {};
  const receipts = D.receipts || [];
  return (
    <ZHQCaptureFlow>
      {({ open, busy, error }) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, fontSize: 13, color: 'var(--text-tertiary)' }}>
              {receipts.length
                ? `${receipts.length} receipt${receipts.length === 1 ? '' : 's'} · ${receipts.filter((r) => r.status !== 'matched').length} in inbox`
                : null}
            </div>
            <Button variant="primary" iconLeft={<Icon name="receipt" size={16} />} onClick={open} disabled={busy}>
              {busy ? 'Uploading…' : 'Add receipt'}
            </Button>
          </div>
          {error ? <div style={{ color: 'var(--red-500)', fontSize: 13 }}>{error}</div> : null}
          {receipts.length === 0 ? (
            <EmptyState
              icon="receipt"
              title="No receipts yet"
              body="Snap a photo of a receipt (or upload one). We read the merchant, total, and every line item, then attach it to the matching transaction automatically."
              actionLabel={busy ? 'Uploading…' : 'Add your first receipt'}
              onAction={open}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
              {receipts.map((r) => <ReceiptCard key={r.id} r={r} />)}
            </div>
          )}
        </div>
      )}
    </ZHQCaptureFlow>
  );
}

Object.assign(window, { ZHQReceipts, ZHQCaptureFlow });
