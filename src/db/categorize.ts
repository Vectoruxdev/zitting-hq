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
  // groceries
  ["harmons", "groceries"], ["smith", "groceries"], ["kroger", "groceries"], ["walmart", "groceries"],
  ["costco", "groceries"], ["trader joe", "groceries"], ["aldi", "groceries"], ["whole foods", "groceries"],
  ["winco", "groceries"], ["sprouts", "groceries"], ["sam s club", "groceries"], ["instacart", "groceries"],
  ["safeway", "groceries"], ["fresh market", "groceries"], ["macey", "groceries"],
  // dining
  ["chick-fil", "dining"], ["chick fil", "dining"], ["mcdonald", "dining"], ["starbucks", "dining"],
  ["domino", "dining"], ["pizza", "dining"], ["taco", "dining"], ["wendy", "dining"], ["burger", "dining"],
  ["chipotle", "dining"], ["panda express", "dining"], ["subway", "dining"], ["dunkin", "dining"],
  ["in n out", "dining"], ["crumbl", "dining"], ["swig", "dining"], ["cafe", "dining"], ["restaurant", "dining"],
  ["grubhub", "dining"], ["doordash", "dining"], ["uber eats", "dining"], ["kfc", "dining"], ["cafe rio", "dining"],
  // transportation
  ["chevron", "transportation"], ["shell", "transportation"], ["sinclair", "transportation"],
  ["maverik", "transportation"], ["exxon", "transportation"], ["phillips 66", "transportation"],
  ["conoco", "transportation"], ["7-eleven", "transportation"], ["uber", "transportation"], ["lyft", "transportation"],
  ["delta air", "transportation"], ["parking", "transportation"], ["jiffy lube", "transportation"],
  ["autozone", "transportation"], ["supercharg", "transportation"], ["frontier air", "transportation"],
  // utilities
  ["rocky mountain power", "utilities"], ["dominion energy", "utilities"], ["xfinity", "utilities"],
  ["comcast", "utilities"], ["centurylink", "utilities"], ["verizon", "utilities"], ["t-mobile", "utilities"],
  ["at&t", "utilities"], ["google fiber", "utilities"], ["questar", "utilities"], ["waste management", "utilities"],
  // insurance
  ["state farm", "insurance"], ["geico", "insurance"], ["progressive", "insurance"], ["allstate", "insurance"],
  ["american family", "insurance"], ["select health", "insurance"], ["blue cross", "insurance"], ["bcbs", "insurance"],
  // subscriptions
  ["netflix", "subscriptions"], ["spotify", "subscriptions"], ["hulu", "subscriptions"], ["disney", "subscriptions"],
  ["apple", "subscriptions"], ["icloud", "subscriptions"], ["amazon prime", "subscriptions"], ["youtube", "subscriptions"],
  ["hbo", "subscriptions"], ["paramount", "subscriptions"], ["peacock", "subscriptions"], ["audible", "subscriptions"],
  ["dropbox", "subscriptions"], ["adobe", "subscriptions"], ["openai", "subscriptions"], ["chatgpt", "subscriptions"],
  ["github", "subscriptions"], ["patreon", "subscriptions"],
  // shopping
  ["amazon", "shopping"], ["target", "shopping"], ["best buy", "shopping"], ["home depot", "shopping"],
  ["lowes", "shopping"], ["ikea", "shopping"], ["etsy", "shopping"], ["ebay", "shopping"], ["old navy", "shopping"],
  ["nike", "shopping"], ["ulta", "shopping"], ["sephora", "shopping"], ["walgreens", "shopping"], ["cvs", "shopping"],
  // health
  ["intermountain", "health"], ["revere health", "health"], ["pharmacy", "health"], ["dental", "health"],
  ["dentist", "health"], ["clinic", "health"], ["vasa", "health"], ["planet fitness", "health"], ["life time", "health"],
  // kids
  ["kindercare", "kids"], ["daycare", "kids"], ["tuition", "kids"],
  // income
  ["adp", "paycheck"], ["payroll", "paycheck"], ["eddyhr", "paycheck"], ["paychex", "paycheck"], ["gusto", "paycheck"],
  // tithing
  ["tithing", "tithing"], ["church of jesus christ", "tithing"], ["deseret", "tithing"],
];

const KEYWORDS: [RegExp, string][] = [
  [/\b(power|electric|energy|utility|water|sewer|natural gas)\b/, "utilities"],
  [/\binsuranc/, "insurance"],
  [/\b(mortgage|escrow|hoa)\b/, "housing"],
  [/\b(payroll|direct dep)\b/, "paycheck"],
  [/\binterest\b/, "other-income"],
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
  if (txn.amount > 0) return { categoryId: "other-income", confidence: 0.55, source: "income", merchantKey };

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
