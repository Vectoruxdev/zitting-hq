import React from 'react';
/* Giving — the tithing/charity ledger. Owed (15% of derived pre-tax gross) vs
   set aside (into the charity account) vs paid to the church. The charity
   account balance is shown for what it is: an accrued unpaid obligation. */

function ZHQGiving() {
  const { Card, SectionHeader, Button, Icon, Tag } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  const API = window.ZHQ_API || {};
  const g = D.giving || null;
  const [savingId, setSavingId] = React.useState(null);
  const [drafts, setDrafts] = React.useState({}); // sourceId -> { grossPerPeriod, grossRatio, titheEnabled }
  const [newCommit, setNewCommit] = React.useState(null); // { name, amount, cadence }

  if (!g) {
    return (
      <Card>
        <SectionHeader eyebrow="Giving" title="Tithing & charity" />
        <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)', margin: 0 }}>
          The giving ledger appears once transactions and income sources are loaded.
        </p>
      </Card>
    );
  }

  const pct = (v) => `${Math.round(v * 1000) / 10}%`;
  const months = g.months || [];
  const maxBar = Math.max(1, ...months.map((m) => Math.max(m.owed, m.accrued, m.settled)));

  const draftFor = (src) =>
    drafts[src.id] || {
      grossPerPeriod: src.grossPerPeriod == null ? '' : String(src.grossPerPeriod),
      grossRatio: src.grossRatio == null ? '' : String(src.grossRatio),
      titheEnabled: src.titheEnabled,
    };
  const setDraft = (id, patch) => setDrafts((d) => ({ ...d, [id]: { ...draftFor({ id, ...(g.sources || []).find((s) => s.id === id) }), ...patch } }));

  async function saveSource(src) {
    if (!API.saveIncomeSourceGross) return;
    const d = draftFor(src);
    setSavingId(src.id);
    try {
      await API.saveIncomeSourceGross({
        id: src.id,
        grossPerPeriod: d.grossPerPeriod === '' ? null : Number(d.grossPerPeriod),
        grossRatio: d.grossRatio === '' ? null : Number(d.grossRatio),
        titheEnabled: !!d.titheEnabled,
      });
      window.ZHQ_REFRESH && window.ZHQ_REFRESH();
    } finally {
      setSavingId(null);
    }
  }

  async function addCommitment() {
    if (!API.saveGivingCommitment || !newCommit || !newCommit.name || !Number(newCommit.amount)) return;
    setSavingId('new-commit');
    try {
      await API.saveGivingCommitment({ name: newCommit.name, amount: Number(newCommit.amount), cadence: newCommit.cadence || 'monthly' });
      setNewCommit(null);
      window.ZHQ_REFRESH && window.ZHQ_REFRESH();
    } finally {
      setSavingId(null);
    }
  }

  const inputStyle = {
    width: 92, padding: '7px 9px', fontSize: 13, fontFamily: 'var(--font-mono)',
    background: 'var(--surface-sunken)', border: '1px solid var(--border-hairline)',
    borderRadius: 8, color: 'var(--text-primary)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Obligation hero */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'clamp(10px, 2vw, 14px)' }}>
        <Card style={{ boxShadow: 'var(--shadow-md)', border: '1px solid var(--green-tint)' }}>
          <div className="zt-eyebrow" style={{ marginBottom: 6 }}>Set aside, not yet paid</div>
          <div className="zt-num" style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)' }}>{g.charityBalanceLabel}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>
            {g.charityAccountName || 'charity account'} — this is owed to the church, not savings
          </div>
        </Card>
        <Card>
          <div className="zt-eyebrow" style={{ marginBottom: 6 }}>Owed · last 6 months</div>
          <div className="zt-num" style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)' }}>{g.totals.owedLabel}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>
            {pct(g.rates.tithing)} tithing + {pct(g.rates.charity)} United Order, on gross
          </div>
        </Card>
        <Card>
          <div className="zt-eyebrow" style={{ marginBottom: 6 }}>Set aside · last 6 months</div>
          <div className="zt-num" style={{ fontSize: 26, fontWeight: 600, color: 'var(--accent)' }}>{g.totals.accruedLabel}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>transfers into {g.charityAccountName || 'the charity account'}</div>
        </Card>
        <Card>
          <div className="zt-eyebrow" style={{ marginBottom: 6 }}>Paid out · last 6 months</div>
          <div className="zt-num" style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)' }}>{g.totals.settledLabel}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>Tithe.ly + everything in the charitable categories</div>
        </Card>
      </div>

      {/* Monthly ledger */}
      <Card>
        <SectionHeader eyebrow="Owed vs set aside vs paid" title="Month by month" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {months.map((m) => (
            <div key={m.month} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="zt-eyebrow" style={{ width: 34, flexShrink: 0 }}>{m.label}</span>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {[
                  { v: m.owed, label: m.owedLabel, color: 'var(--text-tertiary)' },
                  { v: m.accrued, label: m.accruedLabel, color: 'var(--accent)' },
                  { v: m.settled, label: m.settledLabel, color: 'var(--indigo-400)' },
                ].map((bar, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--surface-sunken)', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, (bar.v / maxBar) * 100)}%`, height: '100%', borderRadius: 3, background: bar.color, transition: 'width var(--dur-slow) var(--ease-out)' }} />
                    </div>
                    <span className="zt-num" style={{ fontSize: 11, color: bar.color, width: 62, textAlign: 'right', flexShrink: 0 }}>{bar.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11.5, color: 'var(--text-tertiary)' }}>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: 'var(--text-tertiary)', marginRight: 5 }} />owed</span>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: 'var(--accent)', marginRight: 5 }} />set aside</span>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: 'var(--indigo-400)', marginRight: 5 }} />paid</span>
        </div>
      </Card>

      {/* Per-source gross settings */}
      <Card>
        <SectionHeader
          eyebrow="Pre-tax gross per source"
          title="What tithing is computed on"
          action={!g.migrated ? <Tag size="sm" color="var(--amber-500)">run the July migration to edit</Tag> : null}
        />
        <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          The bank only shows take-home pay. Owed = {pct(g.rates.tithing + g.rates.charity)} of <b style={{ color: 'var(--text-secondary)' }}>gross</b>:
          set the real paystub gross per deposit when you know it, or a net→gross ratio. Blank = the household
          default ratio ({g.rates.defaultGrossRatio}× net, i.e. take-home ≈ {g.rates.netToGrossPct}% of gross — inferred from your $990-per-paycheck set-aside).
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(g.sources || []).map((src) => {
            const d = draftFor(src);
            return (
              <div key={src.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '11px 13px', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {src.memberName ? `${src.memberName} · ` : ''}{src.name}
                  </div>
                  <div className="zt-num" style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    last net {src.lastNetLabel}{src.impliedGrossLabel ? ` → gross ≈ ${src.impliedGrossLabel}` : ''}
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                  gross/check
                  <input
                    style={inputStyle}
                    inputMode="decimal"
                    placeholder="—"
                    value={d.grossPerPeriod}
                    onChange={(e) => setDraft(src.id, { grossPerPeriod: e.target.value })}
                  />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                  or ×ratio
                  <input
                    style={{ ...inputStyle, width: 64 }}
                    inputMode="decimal"
                    placeholder={String(g.rates.defaultGrossRatio)}
                    value={d.grossRatio}
                    onChange={(e) => setDraft(src.id, { grossRatio: e.target.value })}
                  />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!d.titheEnabled}
                    onChange={(e) => setDraft(src.id, { titheEnabled: e.target.checked })}
                  />
                  tithe
                </label>
                <Button size="sm" variant="secondary" disabled={savingId === src.id || !g.migrated} onClick={() => saveSource(src)}>
                  {savingId === src.id ? 'Saving…' : 'Save'}
                </Button>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Recurring donations */}
      <Card>
        <SectionHeader
          eyebrow="Foundations, lights, building fund"
          title="Recurring donations"
          action={
            g.migrated ? (
              <Button size="sm" variant="secondary" iconLeft={<Icon name="plus" size={14} />} onClick={() => setNewCommit(newCommit ? null : { name: '', amount: '', cadence: 'monthly' })}>
                Add
              </Button>
            ) : null
          }
        />
        {(g.commitments || []).length === 0 && !newCommit ? (
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-tertiary)' }}>
            Nothing tracked yet. Add the ~$25–50/mo foundation gift, the Christmas-lights donation, and the building fund —
            you'll get a nudge in any month one doesn't go out.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(g.commitments || []).map((c) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 13px', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)' }}>
                <Icon name="target" size={15} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{c.cadence}</span>
                <span className="zt-num" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{c.amountLabel}</span>
                <button
                  onClick={async () => { if (API.deleteGivingCommitment) { await API.deleteGivingCommitment(c.id); window.ZHQ_REFRESH && window.ZHQ_REFRESH(); } }}
                  style={{ background: 'none', border: 'none', padding: 8, margin: -8, cursor: 'pointer', color: 'var(--text-tertiary)', display: 'grid', placeItems: 'center' }}
                  title="Remove"
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        {newCommit ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
            <input
              style={{ ...inputStyle, width: 180, fontFamily: 'var(--font-sans)' }}
              placeholder="Name (e.g. Clinic fund)"
              value={newCommit.name}
              onChange={(e) => setNewCommit({ ...newCommit, name: e.target.value })}
            />
            <input
              style={inputStyle}
              inputMode="decimal"
              placeholder="Amount"
              value={newCommit.amount}
              onChange={(e) => setNewCommit({ ...newCommit, amount: e.target.value })}
            />
            <select
              value={newCommit.cadence}
              onChange={(e) => setNewCommit({ ...newCommit, cadence: e.target.value })}
              style={{ ...inputStyle, width: 110, fontFamily: 'var(--font-sans)' }}
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="seasonal">Seasonal</option>
            </select>
            <Button size="sm" variant="primary" disabled={savingId === 'new-commit'} onClick={addCommitment}>
              {savingId === 'new-commit' ? 'Adding…' : 'Save'}
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

Object.assign(window, { ZHQGiving });
