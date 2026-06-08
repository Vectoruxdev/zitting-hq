import React from 'react';
import Papa from 'papaparse';
import { dedupeKey, looksLikeTransfer } from '@/db/categorize';

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
      typeCol: 'Type', dateFormat: 'M/D/Y', invertSign: false, bank: 'Mountain America CU',
    };
  }
  const debit = find(/debit|withdrawal/i);
  const credit = find(/credit|deposit/i);
  return {
    dateCol: find(/date/i), merchantCol: find(/desc|payee|name|merchant/i),
    amountMode: debit && credit ? 'debitCredit' : 'signed',
    amountCol: find(/^amount$|amount/i), debitCol: debit, creditCol: credit,
    externalIdCol: find(/transaction id|trans id|\bid\b/i), typeCol: find(/type/i),
    dateFormat: 'M/D/Y', invertSign: false, bank: '',
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
        return {
          idx: i,
          date: iso,
          merchant,
          amount,
          income: amount > 0,
          externalId,
          isTransfer,
          categoryId: isTransfer ? 'transfer' : 'uncategorized',
          memberId: defaultMember,
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
      if (API.previewCategorize) {
        const cz = await API.previewCategorize(normalized.map((r) => ({ merchant: r.merchant, amount: r.amount, accountId })));
        normalized.forEach((r, i) => {
          const hit = cz[i];
          if (hit && hit.categoryId) {
            r.categoryId = hit.categoryId;
            if (hit.member) r.memberId = hit.member;
          }
        });
      }
      if (API.findExistingHashes) {
        const dupes = await API.findExistingHashes(accountId, normalized.map((r) => r.dkey));
        const dset = new Set(dupes);
        normalized.forEach((r) => {
          if (dset.has(r.dkey)) { r.duplicate = true; r.include = false; }
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
      const res = await API.commitImport({
        accountId,
        filename,
        rows: include.map((r) => ({
          date: r.date, merchant: r.merchant, amount: r.amount, income: r.income,
          categoryId: r.categoryId, memberId: r.memberId, isTransfer: r.isTransfer, externalId: r.externalId,
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
            <Select label="Import into account" value={accountId} onChange={setAccountId} options={accounts.map((a) => ({ value: a.id, label: a.label }))} placeholder="Choose account" />
            <Select label="Default person" value={defaultMember} onChange={setDefaultMember} options={memberOpts} placeholder="Choose person" />
          </div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              <b style={{ color: 'var(--text-primary)' }}>{rows.filter((r) => r.include).length}</b> of {rows.length} will import
              {rows.some((r) => r.duplicate) ? <span style={{ color: 'var(--warning)' }}> · {rows.filter((r) => r.duplicate).length} duplicate(s) skipped</span> : null}
            </span>
            {busy ? <Spinner size={16} /> : null}
            <span style={{ flex: 1 }} />
            <Button variant="ghost" size="sm" onClick={() => setAll({ include: true })}>Select all</Button>
            <Button variant="ghost" size="sm" onClick={() => setAll({ include: false })}>Deselect all</Button>
          </div>

          <DataTable
            rowKey="idx"
            rows={rows}
            columns={[
              { key: 'include', header: '', render: (r) => <Checkbox checked={r.include} onChange={(v) => patchRow(r.idx, { include: v })} /> },
              { key: 'date', header: 'Date', render: (r) => <span className="zt-num" style={{ color: 'var(--text-tertiary)', fontSize: 12.5 }}>{isoLabel(r.date)}</span> },
              { key: 'merchant', header: 'Description', render: (r) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.merchant}</span>
                  {r.duplicate ? <Badge tone="warning" size="sm">dup</Badge> : null}
                  {r.isTransfer ? <Badge tone="neutral" size="sm">transfer</Badge> : null}
                </span>
              ) },
              { key: 'categoryId', header: 'Category', render: (r) => (
                <Select value={r.categoryId} onChange={(v) => patchRow(r.idx, { categoryId: v })} options={catOpts} style={{ minWidth: 150 }} />
              ) },
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
