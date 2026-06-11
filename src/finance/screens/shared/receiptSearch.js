/* Receipt line-item search. Scanned receipts store each item's name, so a
   member can search "apples" and get a count + spend across their history.
   Matching is stem-based (drops a trailing "s") so "apples" finds "apple",
   "Honeycrisp Apple", "Apples, Gala", etc. */

/** Lowercase word roots of a phrase, trailing "s" dropped. */
export function stemWords(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/s$/, ''))
    .filter(Boolean);
}

/** Does a line-item name match the query? Every query word must prefix-match
 *  (either direction) some word in the item name. Empty query → no match. */
export function lineMatchesQuery(name, queryStems) {
  if (!queryStems || !queryStems.length) return false;
  const words = stemWords(name);
  return queryStems.every((qs) => words.some((w) => w.startsWith(qs) || qs.startsWith(w)));
}

/** Aggregate every matching line occurrence across receipts.
 *  Returns { occ:[{name,qty,price,merchant,date,dateISO,receipt}], qty, spend, receipts }. */
export function searchLineItems(receipts, query) {
  const queryStems = stemWords(query);
  const occ = [];
  let qty = 0;
  let spend = 0;
  const receiptIds = new Set();
  if (!queryStems.length) return { occ, qty, spend, receipts: 0 };
  for (const r of receipts || []) {
    for (const l of r.lines || []) {
      if (!lineMatchesQuery(l.name, queryStems)) continue;
      const n = l.qty != null && l.qty > 0 ? l.qty : 1;
      qty += n;
      if (l.price != null && l.price > 0) spend += l.price;
      receiptIds.add(r.id);
      occ.push({
        name: l.name,
        qty: l.qty,
        price: l.price,
        merchant: r.merchant || (r.txn && r.txn.merchant) || 'Receipt',
        date: r.receiptDate || r.uploaded || '',
        dateISO: r.dateISO || '',
        receipt: r,
      });
    }
  }
  occ.sort((a, b) => (b.dateISO || '').localeCompare(a.dateISO || ''));
  return { occ, qty, spend, receipts: receiptIds.size };
}

/** Most-bought items (by total quantity) across receipts, for the empty-search
 *  state. Discounts (negative price) are skipped. */
export function topItems(receipts, limit = 8) {
  const map = new Map();
  for (const r of receipts || []) {
    for (const l of r.lines || []) {
      if (!l || !l.name || (l.price != null && l.price < 0)) continue;
      const key = stemWords(l.name).join(' ');
      if (!key) continue;
      const e = map.get(key) || { label: l.name, qty: 0, count: 0 };
      e.qty += l.qty != null && l.qty > 0 ? l.qty : 1;
      e.count += 1;
      map.set(key, e);
    }
  }
  return [...map.values()].sort((a, b) => b.qty - a.qty || b.count - a.count).slice(0, limit);
}
