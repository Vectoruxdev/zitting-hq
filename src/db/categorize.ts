/**
 * Auto-categorization engine (pure, server-side, no DB access).
 *
 * Given a transaction description, it extracts a stable merchant key, then
 * scores the best category from layered signals — user rules, learned memory,
 * a built-in merchant dictionary, and keyword heuristics — returning a category
 * with a confidence (0-1), a reason, and the merchant key used for learning.
 */

export interface RuleLike {
  id?: number;
  matchType: string; // contains | exact | regex
  matchValue: string;
  field: string; // merchant | amount | account
  categoryId: string | null;
  member: string | null;
  priority: number;
  enabled: boolean;
}

export interface MemoryEntry {
  categoryId: string;
  count: number;
  member?: string | null;
}
export type MemoryMap = Map<string, MemoryEntry[]>;

export interface Suggestion {
  categoryId: string;
  confidence: number; // 0..1
  source: "rule" | "transfer" | "learned" | "merchant" | "keyword" | "income" | "none";
  merchantKey: string;
  member?: string | null;
}

/** Below this, a suggestion should be surfaced for review. */
export const REVIEW_THRESHOLD = 0.7;

// ---------------------------------------------------------------------------
// Normalization + merchant extraction
// ---------------------------------------------------------------------------

const NOISE_PREFIX =
  /^(debit( card)?( purch(ase)?| withdrawal)?|credit( card)?|card purchase|ach withdrawal|ach deposit|deposit ach|withdrawal transfer to|home banking|withdrawal|deposit|pos|purchase|online|recurring|payment|external|web|transfer to|transfer from|to|from)\b/;
const STOPWORDS = new Set(["the", "of", "llc", "inc", "co", "corp", "company", "the", "and", "type", "comment", "ach", "ppd", "web"]);

/** Loose normalizer (lower, strip punctuation, collapse) — used for dedupe + rule "contains". */
export function normalizeMerchant(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Reduce a noisy bank description to its brand-ish core, e.g.
 * "Debit Card purch COMMENT: Netflix.com ***-***3700 CA" -> "netflix"
 * "ACH Withdrawal COMMENT: TYPE: CHASE ACH CO: JPMORGAN CHASE - JPMORGAN CHASE" -> "jpmorgan chase"
 */
export function cleanDescription(desc: string): string {
  let s = (desc || "").toLowerCase();
  // MACU ACH puts the company after "co:"; card purchases after "comment:".
  const coIdx = s.indexOf(" co:");
  const cIdx = s.indexOf("comment:");
  if (coIdx >= 0) s = s.slice(coIdx + 4);
  else if (cIdx >= 0) s = s.slice(cIdx + 8);
  // cut trailing bank noise segments
  s = s.split(/ - | type:| entry class| ach trace| trace number| name:| id:/)[0];
  // strip a leading noise phrase (possibly twice: "debit card purch comment ...")
  s = s.replace(/comment:/g, " ");
  for (let i = 0; i < 2; i++) s = s.replace(NOISE_PREFIX, " ").trim();
  // remove masks / store numbers / long digit runs / ref numbers
  s = s.replace(/[*#x]{2,}[-\d]*/g, " ").replace(/#\d+/g, " ").replace(/\b\d{3,}\b/g, " ");
  // drop tlds, keep brand
  s = s.replace(/\.(com|net|org|co)\b/g, " ");
  // keep letters/spaces
  s = s.replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  // strip a trailing 2-letter state code
  s = s.replace(/\s+[a-z]{2}$/, "").trim();
  return s;
}

/** A stable, learnable key: the first 1-2 meaningful tokens of the cleaned description. */
export function extractMerchant(desc: string): string {
  const clean = cleanDescription(desc);
  const tokens = clean.split(" ").filter((t) => t && !STOPWORDS.has(t));
  if (!tokens.length) return normalizeMerchant(desc).split(" ").slice(0, 2).join(" ");
  return tokens.slice(0, 2).join(" ");
}

/** Internal transfer heuristic (MACU patterns). */
export function looksLikeTransfer(merchant: string, type?: string): boolean {
  if (type && /transfer/i.test(type)) return true;
  return /\b(transfer to|transfer from|to share|from share|webxfr|web xfr)\b/i.test(merchant || "");
}

// ---------------------------------------------------------------------------
// Built-in knowledge: merchant dictionary + keyword heuristics
// (categoryIds must exist in the default taxonomy / seedCategories.ts)
// ---------------------------------------------------------------------------

const DICTIONARY: [string, string][] = [
  // groceries & household — Costco/Walmart get their own line; the rest are "Other"
  ["costco", "groc-costco-walmart"], ["walmart", "groc-costco-walmart"], ["sam s club", "groc-costco-walmart"],
  ["basic american", "groc-basic-american"], ["bee s market", "groc-bees"], ["bees market", "groc-bees"],
  ["sunset farm", "groc-sunset-farms"], ["sprouts", "groc-health-food"], ["whole foods", "groc-health-food"],
  ["harmons", "groc-other"], ["smith", "groc-other"], ["kroger", "groc-other"], ["trader joe", "groc-other"],
  ["aldi", "groc-other"], ["winco", "groc-other"], ["instacart", "groc-other"], ["safeway", "groc-other"],
  ["fresh market", "groc-other"], ["macey", "groc-other"],
  // dining / local entertainment
  ["chick-fil", "te-entertainment-local"], ["chick fil", "te-entertainment-local"], ["mcdonald", "te-entertainment-local"],
  ["starbucks", "te-entertainment-local"], ["domino", "te-entertainment-local"], ["pizza", "te-entertainment-local"],
  ["taco", "te-entertainment-local"], ["wendy", "te-entertainment-local"], ["burger", "te-entertainment-local"],
  ["chipotle", "te-entertainment-local"], ["panda express", "te-entertainment-local"], ["subway", "te-entertainment-local"],
  ["dunkin", "te-entertainment-local"], ["in n out", "te-entertainment-local"], ["crumbl", "te-entertainment-local"],
  ["swig", "te-entertainment-local"], ["cafe", "te-entertainment-local"], ["restaurant", "te-entertainment-local"],
  ["grubhub", "te-entertainment-local"], ["doordash", "te-entertainment-local"], ["uber eats", "te-entertainment-local"],
  ["kfc", "te-entertainment-local"], ["cafe rio", "te-entertainment-local"],
  ["vasa", "te-entertainment-local"], ["planet fitness", "te-entertainment-local"], ["life time", "te-entertainment-local"],
  // automobile — fuel, maintenance, rideshare/parking
  ["chevron", "auto-fuel"], ["shell", "auto-fuel"], ["sinclair", "auto-fuel"], ["maverik", "auto-fuel"],
  ["exxon", "auto-fuel"], ["phillips 66", "auto-fuel"], ["conoco", "auto-fuel"], ["7-eleven", "auto-fuel"],
  ["supercharg", "auto-fuel"], ["jiffy lube", "auto-maintenance"], ["autozone", "auto-maintenance"],
  ["uber", "auto-other"], ["lyft", "auto-other"], ["parking", "auto-other"],
  // travel (outside) — air travel
  ["delta air", "te-travel-outside"], ["frontier air", "te-travel-outside"], ["southwest air", "te-travel-outside"],
  // utilities (sub-categorized)
  ["rocky mountain power", "util-electricity"], ["dominion energy", "util-gas"], ["questar", "util-gas"],
  ["xfinity", "util-phone-internet"], ["comcast", "util-phone-internet"], ["centurylink", "util-phone-internet"],
  ["verizon", "util-phone-internet"], ["t-mobile", "util-phone-internet"], ["at&t", "util-phone-internet"],
  ["google fiber", "util-phone-internet"], ["waste management", "util-water-sewer-garbage"],
  // insurance — auto vs health
  ["state farm", "auto-insurance"], ["geico", "auto-insurance"], ["progressive", "auto-insurance"],
  ["allstate", "auto-insurance"], ["american family", "auto-insurance"],
  ["select health", "ins-health"], ["blue cross", "ins-health"], ["bcbs", "ins-health"],
  // streaming → local entertainment; software/cloud → misc other
  ["netflix", "te-entertainment-local"], ["spotify", "te-entertainment-local"], ["hulu", "te-entertainment-local"],
  ["disney", "te-entertainment-local"], ["youtube", "te-entertainment-local"], ["hbo", "te-entertainment-local"],
  ["paramount", "te-entertainment-local"], ["peacock", "te-entertainment-local"], ["audible", "te-entertainment-local"],
  ["apple", "misc-other"], ["icloud", "misc-other"], ["amazon prime", "misc-other"], ["dropbox", "misc-other"],
  ["adobe", "misc-other"], ["openai", "misc-other"], ["chatgpt", "misc-other"], ["github", "misc-other"], ["patreon", "misc-other"],
  // home/yard improvements + clothing + medical + general shopping
  ["home depot", "home-yard-improvements"], ["lowes", "home-yard-improvements"], ["ikea", "home-yard-improvements"],
  ["old navy", "misc-clothing"], ["nike", "misc-clothing"],
  ["walgreens", "misc-medical"], ["cvs", "misc-medical"], ["intermountain", "misc-medical"],
  ["revere health", "misc-medical"], ["pharmacy", "misc-medical"], ["clinic", "misc-medical"],
  ["dental", "misc-dental"], ["dentist", "misc-dental"],
  ["amazon", "misc-other"], ["target", "misc-other"], ["best buy", "misc-other"], ["etsy", "misc-other"],
  ["ebay", "misc-other"], ["ulta", "misc-other"], ["sephora", "misc-other"],
  // child care + education
  ["kindercare", "babysitting"], ["daycare", "babysitting"], ["tuition", "misc-education"],
  // income
  ["adp", "income-paycheck"], ["payroll", "income-paycheck"], ["eddyhr", "income-paycheck"],
  ["paychex", "income-paycheck"], ["gusto", "income-paycheck"],
  // tithing / charitable
  ["tithing", "charitable-tithing"], ["church of jesus christ", "charitable-tithing"], ["deseret", "charitable-tithing"],
];

const KEYWORDS: [RegExp, string][] = [
  [/\b(power|electric|energy)\b/, "util-electricity"],
  [/\b(water|sewer|garbage|trash)\b/, "util-water-sewer-garbage"],
  [/\bnatural gas\b/, "util-gas"],
  [/\binsuranc/, "ins-other"],
  [/\b(mortgage|escrow|hoa|rent)\b/, "rent"],
  [/\b(payroll|direct dep)\b/, "income-paycheck"],
  [/\binterest\b/, "interest-fees"],
];

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface TxnLike {
  merchant: string;
  amount: number;
  accountId?: string | null;
  type?: string | null; // bank "type" column, if available
  isTransfer?: boolean;
}

/** Legacy first-match rules helper (still used by explicit user rules). */
export function matchRules(txn: TxnLike, rules: RuleLike[]): { categoryId: string | null; member: string | null } | null {
  const sorted = [...rules].filter((r) => r.enabled).sort((a, b) => a.priority - b.priority || (a.id ?? 0) - (b.id ?? 0));
  const merch = normalizeMerchant(txn.merchant);
  for (const r of sorted) {
    let hay = "";
    if (r.field === "merchant") hay = merch;
    else if (r.field === "account") hay = (txn.accountId ?? "").toLowerCase();
    else if (r.field === "amount") hay = String(txn.amount);
    const needle = (r.matchValue || "").toLowerCase();
    let hit = false;
    if (r.matchType === "exact") hit = hay === needle;
    else if (r.matchType === "regex") {
      try { hit = new RegExp(r.matchValue, "i").test(r.field === "merchant" ? txn.merchant : hay); } catch { hit = false; }
    } else hit = needle.length > 0 && hay.includes(needle);
    if (hit) return { categoryId: r.categoryId, member: r.member };
  }
  return null;
}

/**
 * The main engine. Returns the best category suggestion with confidence + reason.
 */
export function scoreCategory(txn: TxnLike, opts: { rules?: RuleLike[]; memory?: MemoryMap }): Suggestion {
  const merchantKey = extractMerchant(txn.merchant);
  const raw = (txn.merchant || "").toLowerCase();

  // 1. Explicit user rules win outright.
  if (opts.rules?.length) {
    const m = matchRules(txn, opts.rules);
    if (m?.categoryId) return { categoryId: m.categoryId, confidence: 1, source: "rule", merchantKey, member: m.member };
  }

  // 2. Internal transfer.
  if (txn.isTransfer || looksLikeTransfer(txn.merchant, txn.type ?? undefined)) {
    return { categoryId: "transfer", confidence: 0.9, source: "transfer", merchantKey };
  }

  // 3. Learned memory (frequency-weighted).
  const mem = opts.memory?.get(merchantKey);
  if (mem && mem.length) {
    const total = mem.reduce((s, e) => s + e.count, 0);
    const top = [...mem].sort((a, b) => b.count - a.count)[0];
    const ratio = total > 0 ? top.count / total : 1;
    const confidence = Math.min(0.98, 0.72 + 0.25 * ratio);
    return { categoryId: top.categoryId, confidence, source: "learned", merchantKey, member: top.member ?? null };
  }

  // 4. Built-in merchant dictionary.
  for (const [sub, catId] of DICTIONARY) {
    if (raw.includes(sub)) return { categoryId: catId, confidence: 0.8, source: "merchant", merchantKey };
  }

  // 5. Keyword heuristics.
  for (const [re, catId] of KEYWORDS) {
    if (re.test(raw)) {
      const conf = catId === "paycheck" ? 0.7 : 0.55;
      return { categoryId: catId, confidence: conf, source: "keyword", merchantKey };
    }
  }

  // 6. Positive amount with no other signal → likely income.
  if (txn.amount > 0) return { categoryId: "income-other", confidence: 0.55, source: "income", merchantKey };

  // 7. Give up.
  return { categoryId: "uncategorized", confidence: 0, source: "none", merchantKey };
}

/** Deterministic dedupe key. Prefers the bank's transaction id when present. */
export function dedupeKey(args: {
  externalId?: string | null;
  date: string;
  amount: number;
  merchant: string;
  accountId?: string | null;
}): string {
  if (args.externalId && args.externalId.trim()) {
    return `ext:${args.accountId ?? ""}:${args.externalId.trim()}`;
  }
  return [args.accountId ?? "", args.date, args.amount.toFixed(2), normalizeMerchant(args.merchant)].join("|");
}

export type DupReason = "exists" | "file" | null;

/**
 * Multiset-aware duplicate detection — the single source of truth shared by the
 * import preview (client) and `commitImport` (server). Given rows in file order
 * (each carrying its `dedupeKey`) and how many of each key ALREADY exist in the
 * target account, decide which rows are new vs duplicates:
 *   - "exists": matches a record already in the system → skip, keep the existing
 *     one. Existing records are consumed one-for-one, so re-imports and
 *     overlapping date ranges skip exactly what's already stored (no double
 *     count) while genuinely new rows in the overlap window still import.
 *   - "file": an exact repeat of an earlier row in the same file.
 */
export function markDuplicates<T extends { dedupeKey: string }>(
  rows: T[],
  existingCounts: Record<string, number> | Map<string, number>
): { row: T; duplicate: boolean; reason: DupReason }[] {
  const countOf = (k: string) =>
    existingCounts instanceof Map ? existingCounts.get(k) || 0 : existingCounts[k] || 0;
  const consumed = new Map<string, number>();
  const seenInFile = new Set<string>();
  return rows.map((row) => {
    const k = row.dedupeKey;
    const used = consumed.get(k) || 0;
    if (used < countOf(k)) {
      consumed.set(k, used + 1);
      return { row, duplicate: true, reason: "exists" as const };
    }
    if (seenInFile.has(k)) return { row, duplicate: true, reason: "file" as const };
    seenInFile.add(k);
    return { row, duplicate: false, reason: null };
  });
}
