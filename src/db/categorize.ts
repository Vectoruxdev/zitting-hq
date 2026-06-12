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
  lastSeen?: number; // ms epoch of the most recent reinforcement (recency decay)
}
export type MemoryMap = Map<string, MemoryEntry[]>;

export interface Suggestion {
  categoryId: string;
  confidence: number; // 0..1
  source: "rule" | "transfer" | "learned" | "merchant" | "keyword" | "income" | "none";
  merchantKey: string;
  member?: string | null;
  reason?: string; // human-readable "why" — surfaced in the UI for trust
}

/** Engine inputs. `now`/`catKind` are optional but make scoring smarter:
 *  recency decay needs `now`; the income/expense sign guard needs `catKind`. */
export interface ScoreOpts {
  rules?: RuleLike[];
  memory?: MemoryMap;
  now?: number; // Date.now() — enables recency weighting of learned memory
  catKind?: Map<string, string>; // categoryId -> "income" | "expense" | "transfer"
}

/** Below this, a suggestion should be surfaced for review. */
export const REVIEW_THRESHOLD = 0.7;

/** Learned memory recency: a correction's weight halves every ~180 days, with a
 *  floor so old-but-consistent history still counts. */
const MEMORY_HALF_LIFE_MS = 180 * 24 * 60 * 60 * 1000;
function recencyWeight(lastSeen: number | undefined, now: number | undefined): number {
  if (!lastSeen || !now) return 1;
  const age = Math.max(0, now - lastSeen);
  return Math.max(0.4, Math.pow(0.5, age / MEMORY_HALF_LIFE_MS));
}
function kindOf(catKind: Map<string, string> | undefined, id: string): string | undefined {
  return catKind?.get(id);
}
/** A candidate category is sign-compatible if it doesn't contradict the amount:
 *  spending (amount<0) can't be an income category; a deposit (amount>0) isn't an
 *  expense. Transfers and unknown kinds always pass. */
function signCompatible(kind: string | undefined, amount: number): boolean {
  if (!kind || kind === "transfer") return true;
  if (amount < 0 && kind === "income") return false;
  if (amount > 0 && kind === "expense") return false;
  return true;
}

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
  // drop any token containing a digit (store/ref ids like "2a3b4", "us2a3b4")
  s = s.replace(/\b[a-z]*\d[a-z0-9]*\b/g, " ");
  // drop tlds, keep brand
  s = s.replace(/\.(com|net|org|co)\b/g, " ");
  // keep letters/spaces
  s = s.replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  // strip a trailing 2-letter state code
  s = s.replace(/\s+[a-z]{2}$/, "").trim();
  return s;
}

/** Leading payment-processor tokens that wrap the real merchant (e.g. "SQ *",
 *  "TST*", "PAYPAL *"). Stripped so the brand beneath them is what we learn. */
const PROCESSOR_PREFIX = /^(sq|tst|sp|paypal|pp|ppd|pos|dnh)\s+/;

/**
 * Canonicalize a cleaned description to one stable brand spelling so learning
 * generalizes across the many ways a bank writes the same merchant. Conservative
 * by design — only high-confidence merges. Keep dictionary matching on the raw
 * string (this only feeds the learnable key).
 */
export function canonicalizeBrand(clean: string): string {
  let s = clean.replace(PROCESSOR_PREFIX, "");
  s = s
    .replace(/\bamzn\b/g, "amazon")
    .replace(/\bamazon mktp\b/g, "amazon")
    .replace(/\bamazon com\b/g, "amazon")
    .replace(/\bwal mart\b/g, "walmart")
    .replace(/\bwm supercenter\b/g, "walmart")
    .replace(/\bchick fil a?\b/g, "chick fil a")
    .replace(/\bmcdonald s?\b/g, "mcdonalds");
  return s.replace(/\s+/g, " ").trim();
}

/** The cleaned, brand-canonical core of a description (shared by both keys). */
function coreMerchant(desc: string): string {
  return canonicalizeBrand(cleanDescription(desc));
}

/** A stable, learnable key: the first 1-2 meaningful tokens of the brand core.
 *  Broad — generalizes across e.g. "Costco #0456" and "Costco Gas #12". */
export function extractMerchant(desc: string): string {
  const core = coreMerchant(desc);
  const tokens = core.split(" ").filter((t) => t && !STOPWORDS.has(t));
  if (!tokens.length) return normalizeMerchant(desc).split(" ").slice(0, 2).join(" ");
  return tokens.slice(0, 2).join(" ");
}

/** A precise, learnable key: the full brand core (namespaced with "x:" so it
 *  never collides with token keys in the same memory map). More specific than
 *  extractMerchant — lets two long merchants that share a first token learn
 *  independently. */
export function exactMerchantKey(desc: string): string {
  const core = coreMerchant(desc);
  const norm = core
    .split(" ")
    .filter((t) => t && !STOPWORDS.has(t))
    .join(" ")
    .trim();
  return "x:" + (norm || normalizeMerchant(desc)).slice(0, 48);
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

/** Amount-condition match for `field:"amount"` rules. Compares ABSOLUTE amount
 *  (so "> 200" catches a $250 charge whether it's stored +250 or −250).
 *  matchType: gt | lt | between ("100:300"); else exact-ish equality. */
function amountMatches(matchType: string, matchValue: string, amount: number): boolean {
  const abs = Math.abs(amount);
  const v = (matchValue || "").trim();
  if (matchType === "gt") return abs > parseFloat(v);
  if (matchType === "lt") return abs < parseFloat(v);
  if (matchType === "between") {
    const [lo, hi] = v.split(":").map((x) => parseFloat(x));
    if (isNaN(lo) || isNaN(hi)) return false;
    return abs >= Math.min(lo, hi) && abs <= Math.max(lo, hi);
  }
  return String(amount) === v || abs.toFixed(2) === v || abs === parseFloat(v);
}

/** First-match rules helper (explicit user rules). Returns the category, the
 *  optional person, and a human reason. Supports merchant/account/amount fields. */
export function matchRules(
  txn: TxnLike,
  rules: RuleLike[]
): { categoryId: string | null; member: string | null; reason: string } | null {
  const sorted = [...rules].filter((r) => r.enabled).sort((a, b) => a.priority - b.priority || (a.id ?? 0) - (b.id ?? 0));
  const merch = normalizeMerchant(txn.merchant);
  for (const r of sorted) {
    let hit = false;
    if (r.field === "amount") {
      hit = amountMatches(r.matchType, r.matchValue, txn.amount);
    } else {
      let hay = "";
      if (r.field === "account") hay = (txn.accountId ?? "").toLowerCase();
      else hay = merch; // merchant (default)
      const needle = (r.matchValue || "").toLowerCase();
      if (r.matchType === "exact") hit = hay === needle;
      else if (r.matchType === "regex") {
        try { hit = new RegExp(r.matchValue, "i").test(r.field === "merchant" ? txn.merchant : hay); } catch { hit = false; }
      } else hit = needle.length > 0 && hay.includes(needle);
    }
    if (hit) return { categoryId: r.categoryId, member: r.member, reason: `Matches your rule (${r.field} ${r.matchType} “${r.matchValue}”)` };
  }
  return null;
}

interface MemResult { categoryId: string; member: string | null; confidence: number; n: number; ratio: number; }
/**
 * Score one bucket of learned memory entries for a merchant key. Each entry is
 * weighted by count × recency; sign-incompatible categories are dropped. The
 * winner's confidence rises with both its share of the vote (ratio) AND the
 * amount of evidence (sample-size smoothing) — so a single correction is taken
 * seriously but not treated as gospel, and a 50/50 split surfaces for review.
 */
function scoreMemoryEntries(
  entries: MemoryEntry[] | undefined,
  txn: TxnLike,
  opts: ScoreOpts,
  base: number,
  spread: number
): MemResult | null {
  if (!entries || !entries.length) return null;
  const weighted = entries
    .map((e) => ({ e, w: e.count * recencyWeight(e.lastSeen, opts.now) }))
    .filter(({ e }) => signCompatible(kindOf(opts.catKind, e.categoryId), txn.amount));
  if (!weighted.length) return null;
  const total = weighted.reduce((s, x) => s + x.w, 0);
  const top = weighted.slice().sort((a, b) => b.w - a.w)[0];
  const ratio = total > 0 ? top.w / total : 1;
  const smooth = total / (total + 2); // evidence weight: 1 sample → 0.33, 6 → 0.75
  const confidence = Math.min(0.98, base + spread * ratio * smooth);
  return { categoryId: top.e.categoryId, member: top.e.member ?? null, confidence, n: Math.round(total), ratio };
}

/**
 * The main engine. Layers, strongest first: explicit rules → transfer → learned
 * memory (exact merchant, then broad token) → merchant dictionary → keyword
 * heuristics → income-by-sign → unknown. Returns the best category with a
 * confidence (0-1), the source layer, the learnable merchant key, and a
 * human-readable reason.
 */
export function scoreCategory(txn: TxnLike, opts: ScoreOpts = {}): Suggestion {
  const merchantKey = extractMerchant(txn.merchant);
  const exactKey = exactMerchantKey(txn.merchant);
  const raw = (txn.merchant || "").toLowerCase();

  // 1. Explicit user rules win outright.
  if (opts.rules?.length) {
    const m = matchRules(txn, opts.rules);
    if (m?.categoryId) return { categoryId: m.categoryId, confidence: 1, source: "rule", merchantKey, member: m.member, reason: m.reason };
  }

  // 2. Internal transfer.
  if (txn.isTransfer || looksLikeTransfer(txn.merchant, txn.type ?? undefined)) {
    return { categoryId: "transfer", confidence: 0.9, source: "transfer", merchantKey, reason: "Looks like a transfer between your own accounts" };
  }

  // 3a. Learned memory — exact merchant first (most specific, highest trust).
  const exact = scoreMemoryEntries(opts.memory?.get(exactKey), txn, opts, 0.7, 0.28);
  if (exact) {
    return { categoryId: exact.categoryId, confidence: exact.confidence, source: "learned", merchantKey, member: exact.member, reason: `You've categorized this exact merchant ${exact.n}× before` };
  }
  // 3b. Learned memory — broad token key (generalizes across variants).
  const tok = scoreMemoryEntries(opts.memory?.get(merchantKey), txn, opts, 0.62, 0.33);
  if (tok) {
    return { categoryId: tok.categoryId, confidence: tok.confidence, source: "learned", merchantKey, member: tok.member, reason: `You've categorized “${merchantKey}” ${tok.n}× — ${Math.round(tok.ratio * 100)}% this way` };
  }

  // 4. Built-in merchant dictionary (sign-guarded).
  for (const [sub, catId] of DICTIONARY) {
    if (raw.includes(sub) && signCompatible(kindOf(opts.catKind, catId), txn.amount)) {
      return { categoryId: catId, confidence: 0.8, source: "merchant", merchantKey, reason: `Recognized merchant (“${sub}”)` };
    }
  }

  // 5. Keyword heuristics (sign-guarded).
  for (const [re, catId] of KEYWORDS) {
    if (re.test(raw) && signCompatible(kindOf(opts.catKind, catId), txn.amount)) {
      const conf = catId.startsWith("income") ? 0.68 : 0.55;
      return { categoryId: catId, confidence: conf, source: "keyword", merchantKey, reason: "Matched a keyword in the description" };
    }
  }

  // 6. Positive amount with no other signal → likely income.
  if (txn.amount > 0) return { categoryId: "income-other", confidence: 0.55, source: "income", merchantKey, reason: "Money coming in, with no other signal yet" };

  // 7. Give up — surfaced for review.
  return { categoryId: "uncategorized", confidence: 0, source: "none", merchantKey, reason: "No signal yet — categorize it once and I'll remember" };
}

/** Map an engine source to a short UI label (for "why this category?" chips). */
export function sourceLabel(source: Suggestion["source"]): string {
  switch (source) {
    case "rule": return "Your rule";
    case "transfer": return "Transfer";
    case "learned": return "Learned";
    case "merchant": return "Known merchant";
    case "keyword": return "Keyword";
    case "income": return "Income";
    default: return "Needs review";
  }
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
  return contentDupKey(args);
}

/**
 * Content-identity key (account + date + amount + normalized merchant). This is
 * the no-externalId form of `dedupeKey`, exported separately so imports can
 * also catch a re-linked bank feed: Plaid issues brand-new transaction_ids for
 * the same history, so id-based keys see "new" rows even though the content is
 * already stored.
 */
export function contentDupKey(args: {
  date: string;
  amount: number;
  merchant: string;
  accountId?: string | null;
}): string {
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
 *
 * Rows may also carry a `contentKey` (account+date+amount+merchant). When the
 * id-based key misses but the content key matches a stored row (consumed
 * one-for-one, same multiset semantics), the row is still "exists" — this is
 * what stops a re-linked Plaid item (new transaction_ids, same history) or a
 * CSV-after-Plaid overlap from double-importing an account's history. Content
 * matching is only consulted against EXISTING rows, never within the file, so
 * two genuinely identical same-day purchases arriving together both import.
 */
export function markDuplicates<T extends { dedupeKey: string; contentKey?: string | null }>(
  rows: T[],
  existingCounts: Record<string, number> | Map<string, number>,
  existingContentCounts?: Record<string, number> | Map<string, number>
): { row: T; duplicate: boolean; reason: DupReason }[] {
  const countIn = (m: Record<string, number> | Map<string, number> | undefined, k: string) =>
    m == null ? 0 : m instanceof Map ? m.get(k) || 0 : m[k] || 0;
  const consumed = new Map<string, number>();
  const contentConsumed = new Map<string, number>();
  const seenInFile = new Set<string>();
  return rows.map((row) => {
    const k = row.dedupeKey;
    const used = consumed.get(k) || 0;
    if (used < countIn(existingCounts, k)) {
      consumed.set(k, used + 1);
      return { row, duplicate: true, reason: "exists" as const };
    }
    if (seenInFile.has(k)) return { row, duplicate: true, reason: "file" as const };
    const ck = row.contentKey;
    if (ck) {
      const cUsed = contentConsumed.get(ck) || 0;
      if (cUsed < countIn(existingContentCounts, ck)) {
        contentConsumed.set(ck, cUsed + 1);
        return { row, duplicate: true, reason: "exists" as const };
      }
    }
    seenInFile.add(k);
    return { row, duplicate: false, reason: null };
  });
}
