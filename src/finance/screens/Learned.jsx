import React from 'react';
/* What it's learned — owner-facing view of the auto-categorizer's memory.
   Every merchant the engine has learned, its winning category + how strongly,
   when it was last reinforced, and competing categories. Spot-fix or forget
   any merchant in one place. Reads D.learned (owner/partner only). */

// Category picker bottom-sheet (reused for "Fix this merchant").
function LearnedCatPicker({ onPick, onClose }) {
  const { Modal } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA || {};
  const groups = D.categoryGroups || [];
  const cats = (D.allCategories || []).filter((c) => c.id !== 'uncategorized');
  const byGroup = groups.map((g) => ({ g, items: cats.filter((c) => c.groupId === g.id) })).filter((x) => x.items.length);
  const ungrouped = cats.filter((c) => !groups.some((g) => g.id === c.groupId));
  return (
    <Modal open onClose={onClose} title="Set the correct category" width={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '60vh', overflowY: 'auto' }}>
        {[...byGroup, ...(ungrouped.length ? [{ g: { id: '_', name: 'Other' }, items: ungrouped }] : [])].map(({ g, items }) => (
          <div key={g.id}>
            <div className="zt-eyebrow" style={{ marginBottom: 8 }}>{g.name}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {items.map((c) => (
                <button key={c.id} onClick={() => onPick(c.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 13px', borderRadius: 999, border: '1px solid var(--border-hairline)', background: 'var(--surface-card)', cursor: 'pointer', font: 'inherit', fontSize: 13.5, color: 'var(--text-primary)' }}>
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

function ZHQLearned() {
  const { Card, Button, Icon, Badge, Tag, TextInput, EmptyState } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA || {};
  const API = window.ZHQ_API || {};
  const learned = D.learned || [];

  const [q, setQ] = React.useState('');
  const [picker, setPicker] = React.useState(null); // merchant key being re-assigned
  const [busy, setBusy] = React.useState(false);
  const refresh = () => window.ZHQ_REFRESH && window.ZHQ_REFRESH();

  async function run(fn) { setBusy(true); try { await fn(); refresh(); } finally { setBusy(false); } }
  const forget = (key) => run(() => API.forgetLearnedMerchant(key));
  const fixTo = (key, categoryId) => run(() => API.setLearnedMerchant(key, categoryId));
  const rebuild = () => run(() => API.rebuildMemoryFromHistory());
  const applyToUnreviewed = () => run(() => API.recategorizeAll({ onlyUnreviewed: true }));

  const filtered = q.trim()
    ? learned.filter((m) => m.key.toLowerCase().includes(q.trim().toLowerCase()) || (m.category || '').toLowerCase().includes(q.trim().toLowerCase()))
    : learned;
  const totalCorrections = learned.reduce((s, m) => s + (m.total || 0), 0);

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>What it's learned</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Every time anyone categorizes or confirms a transaction, the engine remembers it here and uses it for future imports. Fix or forget any merchant.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" size="sm" disabled={busy} onClick={applyToUnreviewed} title="Re-run suggestions on everything not yet reviewed">Apply to unreviewed</Button>
          <Button variant="secondary" size="sm" disabled={busy} onClick={rebuild} title="Rebuild memory from every reviewed transaction">Rebuild from history</Button>
        </div>
      </div>

      {learned.length ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Card padding={4} style={{ flex: 1, minWidth: 150 }}>
            <div className="zt-eyebrow">Merchants learned</div>
            <div className="zt-num" style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{learned.length}</div>
          </Card>
          <Card padding={4} style={{ flex: 1, minWidth: 150 }}>
            <div className="zt-eyebrow">Total reinforcements</div>
            <div className="zt-num" style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{totalCorrections}</div>
          </Card>
        </div>
      ) : null}

      {learned.length ? (
        <TextInput value={q} onChange={setQ} placeholder="Search merchants or categories…" />
      ) : null}

      {!learned.length ? (
        <EmptyState icon="sparkles" title="Nothing learned yet" body="As you and your family categorize and confirm transactions, the engine learns each merchant here — and starts auto-filling them on future imports." />
      ) : !filtered.length ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13.5 }}>No merchants match “{q}”.</div>
      ) : (
        <Card padding={2}>
          {filtered.map((m, i) => (
            <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 14px', borderBottom: i === filtered.length - 1 ? 'none' : '1px solid var(--border-hairline)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                  <span className="zt-num" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{m.key}</span>
                  <Icon name="arrowRight" size={13} style={{ color: 'var(--text-tertiary)' }} />
                  <button onClick={() => setPicker(m.key)} disabled={busy} title="Change category" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                    <Tag color={m.color} size="md">{m.category} ✎</Tag>
                  </button>
                  {m.member ? <Badge tone="neutral" size="sm">{m.member}</Badge> : null}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 5 }}>
                  Learned {m.count}×{m.share < 100 ? ` · ${m.share}% of the time` : ''}{m.lastSeen ? ` · last ${m.lastSeen}` : ''}
                  {m.alts && m.alts.length ? ` · also seen as ${m.alts.map((a) => `${a.category} (${a.count})`).join(', ')}` : ''}
                </div>
              </div>
              <button onClick={() => forget(m.key)} disabled={busy} title="Forget this merchant" style={{ flex: 'none', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'inline-flex', padding: 6 }}>
                <Icon name="x" size={16} />
              </button>
            </div>
          ))}
        </Card>
      )}

      {picker != null ? (
        <LearnedCatPicker
          onClose={() => setPicker(null)}
          onPick={(categoryId) => { const key = picker; setPicker(null); fixTo(key, categoryId); }}
        />
      ) : null}
    </div>
  );
}

Object.assign(window, { ZHQLearned });
