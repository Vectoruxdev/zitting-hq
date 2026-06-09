import React from 'react';
import Papa from 'papaparse';
import { dedupeKey, markDuplicates, looksLikeTransfer } from '@/db/categorize';

/* Import — multi-step CSV transaction import: upload → map → preview → done. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseToISO(raw, fmt) {
  const v = (raw || '').trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10); // already ISO
  const parts = v.split(/[/.-]/).map((p) => p.trim());
  if (parts.length === 3) {
    let mm, dd, yy;
    if (fmt === 'D/M/Y') { dd = parts[0]; mm = parts[1]; yy = parts[2]; }
    else { mm = parts[0]; dd = parts[1]; yy = parts[2]; } // default M/D/Y
    if (yy.length === 2) yy = '20' + yy;
    const iso = `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
function isoLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d.getTime()) ? iso : `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
function num(v) {
  const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function autoDetect(headers) {
  const find = (re) => headers.find((h) => re.test(h)) || '';
  const isMacu = headers.includes('Transaction ID') && headers.includes('Posting Date') && headers.includes('Amount');
  if (isMacu) {
    return {
      dateCol: 'Posting Date', merchantCol: 'Description', amountMode: 'signed',
      amountCol: 'Amount', debitCol: '', creditCol: '', externalIdCol: 'Transaction ID',
      typeCol: 'Type', balanceCol: 'Balance', dateFormat: 'M/D/Y', invertSign: false, bank: 'Mountain America CU',
    };
  }
  const debit = find(/debit|withdrawal/i);
  const credit = find(/credit|deposit/i);
  return {
    dateCol: find(/date/i), merchantCol: find(/desc|payee|name|merchant/i),
    amountMode: debit && credit ? 'debitCredit' : 'signed',
    amountCol: find(/^amount$|amount/i), debitCol: debit, creditCol: credit,
    externalIdCol: find(/transaction id|trans id|\bid\b/i), typeCol: find(/type/i),
    balanceCol: find(/balance/i), dateFormat: 'M/D/Y', invertSign: false, bank: '',
  };
}

function ZHQImport({ onNavigate }) {
  const {
    Button, Icon, Select, FileDropzone, SegmentedControl, Checkbox, Toggle,
    DataTable, Tag, Avatar, AmountCell, Badge, Card, Spinner,
  } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  const API = window.ZHQ_API || {};

  const accounts = D.accountsFlat || [];
  const members = D.members || [];
  const cats = D.allCategories || [];
  const catOpts = cats.map((c) => ({ value: c.id, label: c.name }));
  const memberOpts = members.map((m) => ({ value: m.id, label: m.name }));

  const [step, setStep] = React.useState('upload');
  const [filename, setFilename] = React.useState(null);
  const [headers, setHeaders] = React.useState([]);
  const [raw, setRaw] = React.useState([]); // parsed CSV objects
  const [accountId, setAccountId] = React.useState(accounts[0]?.id || '');
  const [defaultMember, setDefaultMember] = React.useState(members.find((m) => m.role === 'owner')?.id || members[0]?.id || '');
  const [mapping, setMapping] = React.useState(null);
  const [rows, setRows] = React.useState([]); // normalized preview rows
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState(null);

  const headerOpts = headers.map((h) => ({ value: h, label: h }));
  const headerOptsOpt = [{ value: '', label: '— none —' }, ...headerOpts];

  function onFile(file) {
    if (!file) return;
    setFilename(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const hs = res.meta.fields || [];
        setHeaders(hs);
        setRaw(res.data || []);
        setMapping(autoDetect(hs));
      },
    });
  }

  function normalize() {
    const map = mapping;
    return raw
      .map((r, i) => {
        const iso = parseToISO(r[map.dateCol], map.dateFormat);
        let amount;
        if (map.amountMode === 'debitCredit') amount = num(r[map.creditCol]) - num(r[map.debitCol]);
        else amount = num(r[map.amountCol]);
        if (map.invertSign) amount = -amount;
        const merchant = (r[map.merchantCol] || '').toString().trim() || '(no description)';
        const typeVal = map.typeCol ? r[map.typeCol] : '';
        const externalId = map.externalIdCol ? r[map.externalIdCol] : null;
        const isTransfer = looksLikeTransfer(merchant, typeVal);
        const balance = map.balanceCol && r[map.balanceCol] != null && String(r[map.balanceCol]).trim() !== '' ? num(r[map.balanceCol]) : null;
        return {
          idx: i,
          date: iso,
          merchant,
          amount,
          balance,
          income: amount > 0,
          externalId,
          isTransfer,
          categoryId: isTransfer ? 'transfer' : 'uncategorized',
          memberId: defaultMember,
          source: isTransfer ? 'transfer' : 'none',
          confidence: isTransfer ? 0.9 : 0,
          include: Boolean(iso) && amount !== 0,
          duplicate: false,
          dkey: iso ? dedupeKey({ externalId, date: iso, amount, merchant, accountId }) : '',
        };
      })
      .filter((r) => r.date); // drop unparseable rows
  }

  async function toPreview() {
    const normalized = normalize();
    setRows(normalized);
    setStep('preview');
    setBusy(true);
    try {
      // auto-categorize (server rules) + dedupe in parallel-ish (sequential to be safe)
      if (API.suggestCategories) {
        const cz = await API.suggestCategories(normalized.map((r) => ({ merchant: r.merchant, amount: r.amount, accountId, isTransfer: r.isTransfer })));
        normalized.forEach((r, i) => {
          const sug = cz[i];
          if (sug) {
            if (sug.categoryId) r.categoryId = sug.categoryId;
            if (sug.member) r.memberId = sug.member;
            r.source = sug.source;
            r.confidence = sug.confidence;
            if (sug.source === 'transfer') r.isTransfer = true;
          }
        });
      }
      if (API.findExistingHashes) {
        // Same multiset-aware dedup the server uses (markDuplicates), so the
        // preview is exact: skip rows already in the system (keep existing) and
        // exact repeats within this file.
        const counts = await API.findExistingHashes(accountId, normalized.map((r) => r.dkey));
        const decided = markDuplicates(normalized.map((r) => ({ dedupeKey: r.dkey, ref: r })), counts);
        decided.forEach((d) => {
          if (d.duplicate) { d.row.ref.duplicate = true; d.row.ref.include = false; d.row.ref.dupReason = d.reason; }
        });
      }
      setRows([...normalized]);
    } finally {
      setBusy(false);
    }
  }

  function patchRow(idx, patch) {
    setRows((rs) => rs.map((r) => (r.idx === idx ? { ...r, ...patch } : r)));
  }
  function setAll(patch) {
    setRows((rs) => rs.map((r) => ({ ...r, ...patch })));
  }

  async function commit() {
    const include = rows.filter((r) => r.include);
    if (!include.length || !API.commitImport) return;
    setBusy(true);
    try {
      // Latest running balance from the file → updates the account balance.
      const withBalance = rows.filter((r) => r.balance != null && r.date);
      let accountBalance = null;
      if (withBalance.length) {
        const latest = withBalance.reduce((a, b) => (a.date >= b.date ? a : b));
        accountBalance = latest.balance;
      }
      const res = await API.commitImport({
        accountId,
        filename,
        accountBalance,
        rows: include.map((r) => ({
          date: r.date, merchant: r.merchant, amount: r.amount, income: r.income,
          categoryId: r.categoryId, memberId: r.memberId, isTransfer: r.isTransfer, externalId: r.externalId,
          categorySource: r.source, categoryConfidence: r.confidence,
        })),
      });
      setResult(res);
      setStep('done');
      window.ZHQ_REFRESH && window.ZHQ_REFRESH();
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (result?.batchId && API.deleteImport) {
      setBusy(true);
      await API.deleteImport(result.batchId);
      window.ZHQ_REFRESH && window.ZHQ_REFRESH();
      setBusy(false);
    }
    reset();
  }

  const [removing, setRemoving] = React.useState(null);
  async function removeBatch(id) {
    if (!API.deleteImport) return;
    setRemoving(id);
    try {
      await API.deleteImport(id);
      window.ZHQ_REFRESH && window.ZHQ_REFRESH();
    } finally {
      setRemoving(null);
    }
  }
  function reset() {
    setStep('upload'); setFilename(null); setHeaders([]); setRaw([]); setMapping(null); setRows([]); setResult(null);
  }

  const stepIdx = { upload: 0, map: 1, preview: 2, done: 3 }[step];
  const stepLabels = ['Upload', 'Map columns', 'Review', 'Done'];

  // ---- no accounts yet ----
  if (!accounts.length) {
    return (
      <div style={{ maxWidth: 520 }}>
        <Card padding={28}>
          <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 600 }}>Add an account first</h2>
          <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', fontSize: 14 }}>
            You need at least one account to import transactions into. Create one on the Accounts page.
          </p>
          <Button variant="primary" onClick={() => onNavigate && onNavigate('accounts')}>Go to Accounts</Button>
        </Card>
      </div>
    );
  }

  return (
    <div>
      {/* stepper */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
        {stepLabels.map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 22, height: 22, borderRadius: 999, display: 'grid', placeItems: 'center', fontSize: 11.5, fontWeight: 600,
              background: i <= stepIdx ? 'var(--accent)' : 'var(--surface-raised)',
              color: i <= stepIdx ? 'var(--text-on-accent)' : 'var(--text-tertiary)',
            }}>{i + 1}</span>
            <span style={{ fontSize: 13, color: i === stepIdx ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: i === stepIdx ? 600 : 500 }}>{label}</span>
            {i < stepLabels.length - 1 ? <span style={{ width: 24, height: 1, background: 'var(--border-hairline)' }} /> : null}
          </div>
        ))}
      </div>

      {/* STEP: upload */}
      {step === 'upload' ? (
        <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FileDropzone onFile={onFile} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Select label="Import into account" value={accountId} onChange={setAccountId} options={accounts.map((a) => ({ value: a.id, label: a.plaidLinked ? `${a.label} (auto-synced)` : a.label }))} placeholder="Choose account" />
            <Select label="Default person" value={defaultMember} onChange={setDefaultMember} options={memberOpts} placeholder="Choose person" />
          </div>
          {accounts.find((a) => a.id === accountId)?.plaidLinked ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '10px 12px', background: 'var(--amber-glow, var(--surface-sunken))', border: '1px solid var(--warning)', borderRadius: 'var(--radius-sm)', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <Icon name="alert" size={15} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
              <span>This account <b style={{ color: 'var(--text-primary)' }}>auto-syncs from your bank</b> via Plaid. Importing a CSV here will likely create duplicate transactions — only do this for history older than the connection.</span>
            </div>
          ) : null}
          {headers.length ? (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Parsed <b style={{ color: 'var(--text-primary)' }}>{raw.length}</b> rows · {headers.length} columns{mapping?.bank ? ` · detected ${mapping.bank}` : ''}
            </div>
          ) : null}
          <div>
            <Button variant="primary" disabled={!headers.length || !accountId} onClick={() => setStep('map')} iconRight={<Icon name="chevronDown" size={15} style={{ transform: 'rotate(-90deg)' }} />}>
              Continue
            </Button>
          </div>

          {/* import history log */}
          {(D.importBatches || []).length ? (
            <div style={{ marginTop: 14 }}>
              <span className="zt-eyebrow" style={{ display: 'block', marginBottom: 10 }}>Recent imports</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(D.importBatches || []).map((b) => (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'var(--surface-raised)', color: b.source === 'plaid' ? 'var(--accent)' : 'var(--text-secondary)' }}>
                      <Icon name={b.source === 'plaid' ? 'bank' : 'arrowDown'} size={15} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.filename || 'Import'}
                        {b.account ? <span style={{ fontWeight: 500, color: 'var(--text-tertiary)' }}> · {b.account}</span> : null}
                        <span style={{ marginLeft: 7, fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: b.source === 'plaid' ? 'var(--accent)' : 'var(--text-tertiary)' }}>{b.source === 'plaid' ? 'Auto' : 'CSV'}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        {b.coversFrom ? (b.coversFrom === b.coversTo ? b.coversFrom : `${b.coversFrom} – ${b.coversTo}`) : 'no dated rows'}
                        {' · '}{b.rowsImported} imported{b.rowsSkipped ? ` · ${b.rowsSkipped} skipped` : ''}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{b.createdAt}</div>
                      <button
                        onClick={() => removeBatch(b.id)}
                        disabled={removing === b.id}
                        style={{ marginTop: 3, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 11.5, color: 'var(--danger, var(--text-tertiary))', opacity: removing === b.id ? 0.5 : 1 }}
                      >
                        {removing === b.id ? 'Removing…' : 'Remove'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* STEP: map */}
      {step === 'map' && mapping ? (
        <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Select label="Date column" value={mapping.dateCol} onChange={(v) => setMapping({ ...mapping, dateCol: v })} options={headerOpts} />
            <Select label="Date format" value={mapping.dateFormat} onChange={(v) => setMapping({ ...mapping, dateFormat: v })} options={[{ value: 'M/D/Y', label: 'M/D/Y (US)' }, { value: 'D/M/Y', label: 'D/M/Y' }, { value: 'ISO', label: 'YYYY-MM-DD' }]} />
            <Select label="Description column" value={mapping.merchantCol} onChange={(v) => setMapping({ ...mapping, merchantCol: v })} options={headerOpts} />
            <Select label="Transaction ID (dedup)" value={mapping.externalIdCol} onChange={(v) => setMapping({ ...mapping, externalIdCol: v })} options={headerOptsOpt} />
          </div>
          <div>
            <span className="zt-eyebrow" style={{ display: 'block', marginBottom: 6 }}>Amount</span>
            <SegmentedControl options={['signed', 'debitCredit']} value={mapping.amountMode} onChange={(v) => setMapping({ ...mapping, amountMode: v })} size="sm" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {mapping.amountMode === 'signed' ? (
              <Select label="Amount column" value={mapping.amountCol} onChange={(v) => setMapping({ ...mapping, amountCol: v })} options={headerOpts} />
            ) : (
              <>
                <Select label="Debit (outflow) column" value={mapping.debitCol} onChange={(v) => setMapping({ ...mapping, debitCol: v })} options={headerOpts} />
                <Select label="Credit (inflow) column" value={mapping.creditCol} onChange={(v) => setMapping({ ...mapping, creditCol: v })} options={headerOpts} />
              </>
            )}
            <Select label="Type column (optional)" value={mapping.typeCol} onChange={(v) => setMapping({ ...mapping, typeCol: v })} options={headerOptsOpt} />
            <Select label="Balance column (sets account balance)" value={mapping.balanceCol || ''} onChange={(v) => setMapping({ ...mapping, balanceCol: v })} options={headerOptsOpt} />
          </div>
          <Toggle label="Flip amount signs (if expenses are positive)" checked={mapping.invertSign} onChange={(v) => setMapping({ ...mapping, invertSign: v })} />

          {/* live mini preview */}
          <div style={{ marginTop: 4 }}>
            <span className="zt-eyebrow" style={{ display: 'block', marginBottom: 8 }}>Preview (first 5 rows)</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {normalize().slice(0, 5).map((r) => (
                <div key={r.idx} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, padding: '7px 11px', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)' }}>
                  <span className="zt-num" style={{ color: 'var(--text-tertiary)', width: 54 }}>{isoLabel(r.date)}</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.merchant}</span>
                  <AmountCell value={r.amount} income={r.income} />
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="ghost" onClick={() => setStep('upload')}>Back</Button>
            <Button variant="primary" disabled={!mapping.dateCol || !mapping.merchantCol} onClick={toPreview}>Review transactions</Button>
          </div>
        </div>
      ) : null}

      {/* STEP: preview */}
      {step === 'preview' ? (
        <div>
          {(() => {
            const willImport = rows.filter((r) => r.include).length;
            const dupExists = rows.filter((r) => r.dupReason === 'exists').length;
            const dupFile = rows.filter((r) => r.dupReason === 'file').length;
            const allDupes = !busy && rows.length > 0 && willImport === 0 && (dupExists + dupFile) === rows.length;
            return (
              <>
                {/* duplicate-detection banner */}
                {!busy && (dupExists || dupFile) ? (
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', marginBottom: 14,
                    background: allDupes ? 'var(--surface-raised)' : 'var(--amber-glow, var(--surface-sunken))',
                    border: `1px solid ${allDupes ? 'var(--border-hairline)' : 'var(--warning)'}`, borderRadius: 'var(--radius-md)',
                  }}>
                    <span style={{ flexShrink: 0, color: allDupes ? 'var(--text-secondary)' : 'var(--warning)', marginTop: 1 }}>
                      <Icon name={allDupes ? 'check' : 'alert'} size={16} />
                    </span>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {allDupes ? (
                        <><b style={{ color: 'var(--text-primary)' }}>Already imported.</b> Every one of these {rows.length} transactions is already in {accounts.find((a) => a.id === accountId)?.label || 'this account'}, so there's nothing new to add. Your existing records are kept as-is.</>
                      ) : (
                        <><b style={{ color: 'var(--text-primary)' }}>Duplicate transactions detected and skipped.</b>{' '}
                          {dupExists ? `${dupExists} already exist in this account (kept as-is). ` : ''}
                          {dupFile ? `${dupFile} repeat earlier in this file. ` : ''}
                          Overlapping date ranges are fine — only genuinely new transactions import.</>
                      )}
                    </div>
                  </div>
                ) : null}

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                    <b style={{ color: 'var(--text-primary)' }}>{willImport}</b> of {rows.length} will import
                    {(dupExists + dupFile) ? <span style={{ color: 'var(--warning)' }}> · {dupExists + dupFile} duplicate(s) skipped</span> : null}
                  </span>
                  {busy ? <Spinner size={16} /> : null}
                  <span style={{ flex: 1 }} />
                  <Button variant="ghost" size="sm" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, include: !r.duplicate })))}>Select all new</Button>
                  <Button variant="ghost" size="sm" onClick={() => setAll({ include: false })}>Deselect all</Button>
                </div>
              </>
            );
          })()}

          <DataTable
            rowKey="idx"
            rows={rows}
            columns={[
              { key: 'include', header: '', render: (r) => <Checkbox checked={r.include} onChange={(v) => patchRow(r.idx, { include: v })} /> },
              { key: 'date', header: 'Date', render: (r) => <span className="zt-num" style={{ color: 'var(--text-tertiary)', fontSize: 12.5 }}>{isoLabel(r.date)}</span> },
              { key: 'merchant', header: 'Description', render: (r) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.merchant}</span>
                  {r.duplicate ? <Badge tone="warning" size="sm">{r.dupReason === 'file' ? 'repeat in file' : 'already imported'}</Badge> : null}
                  {r.isTransfer ? <Badge tone="neutral" size="sm">transfer</Badge> : null}
                </span>
              ) },
              { key: 'categoryId', header: 'Category', render: (r) => (
                <Select value={r.categoryId} onChange={(v) => patchRow(r.idx, { categoryId: v, source: 'manual', confidence: 1 })} options={catOpts} style={{ minWidth: 150 }} />
              ) },
              { key: 'conf', header: 'Auto', render: (r) => {
                if (r.source === 'manual') return <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>you</span>;
                const low = (r.confidence || 0) < 0.7;
                return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: low ? 'var(--warning)' : 'var(--text-tertiary)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: low ? 'var(--warning)' : 'var(--accent)' }} />
                  {Math.round((r.confidence || 0) * 100)}%
                </span>;
              } },
              { key: 'memberId', header: 'Person', render: (r) => (
                <Select value={r.memberId} onChange={(v) => patchRow(r.idx, { memberId: v })} options={memberOpts} style={{ minWidth: 120 }} />
              ) },
              { key: 'amount', header: 'Amount', align: 'right', render: (r) => <AmountCell value={r.amount} income={r.income} /> },
            ]}
          />

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <Button variant="ghost" onClick={() => setStep('map')}>Back</Button>
            <Button variant="primary" disabled={busy || !rows.some((r) => r.include)} onClick={commit}>
              Import {rows.filter((r) => r.include).length} transactions
            </Button>
          </div>
        </div>
      ) : null}

      {/* STEP: done */}
      {step === 'done' && result ? (
        <div style={{ maxWidth: 480 }}>
          <Card padding={28}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <span style={{ width: 36, height: 36, borderRadius: 999, display: 'grid', placeItems: 'center', background: 'var(--green-glow)', color: 'var(--accent)' }}>
                <Icon name="check" size={20} />
              </span>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Imported {result.imported} transactions</h2>
            </div>
            <p style={{ margin: '0 0 18px', color: 'var(--text-secondary)', fontSize: 14 }}>
              {result.skipped ? `${result.skipped} duplicate(s) were skipped. ` : ''}Your dashboard and transactions are updated.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="primary" onClick={() => onNavigate && onNavigate('transactions')}>View transactions</Button>
              <Button variant="secondary" onClick={reset}>Import another</Button>
              <Button variant="ghost" onClick={undo} disabled={busy}>Undo</Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

Object.assign(window, { ZHQImport });
