/**
 * Plaid → Family HQ bridge. Connecting a bank and syncing transactions both
 * funnel into the EXISTING import pipeline (`commitImport`): each Plaid
 * transaction becomes an ImportRow whose `externalId` is Plaid's stable
 * `transaction_id`, so dedup, auto-categorization, transfer-linking, and
 * balance reconciliation all apply unchanged.
 *
 * Access tokens live only in `plaid_items` (server-side) — never sent to the
 * client and never read by getFinanceData.
 */
import { eq, inArray } from "drizzle-orm";
import { db } from "./index";
import * as s from "./schema";
import { getPlaid, PLAID_PRODUCTS, PLAID_COUNTRY_CODES, PLAID_WEBHOOK_URL } from "@/lib/plaid";
import { commitImport, suggestCategories, createNotification } from "./mutations";
import { looksLikeTransfer, dedupeKey } from "./categorize";
import { mapAccountType, signedBankBalance } from "./accountType";

function requireDb() {
  if (!db) throw new Error("Database not configured");
  return db;
}

// Pure type/sign helpers live in ./accountType (dependency-free + unit-tested).

/** Create a short-lived link_token to open Plaid Link on the client. */
export async function createLinkToken(clientUserId: string): Promise<string> {
  const plaid = getPlaid();
  if (!plaid) throw new Error("Plaid is not configured");
  try {
    const res = await plaid.linkTokenCreate({
      user: { client_user_id: clientUserId },
      client_name: "Family HQ",
      products: PLAID_PRODUCTS,
      country_codes: PLAID_COUNTRY_CODES,
      language: "en",
      webhook: PLAID_WEBHOOK_URL,
    });
    return res.data.link_token;
  } catch (e) {
    const data = (e as { response?: { data?: unknown } })?.response?.data as
      | { error_code?: string; error_message?: string }
      | undefined;
    console.error("[plaid linkTokenCreate] error:", JSON.stringify(data));
    throw new Error(`Plaid ${data?.error_code || "error"}: ${data?.error_message || "request failed"}`);
  }
}

/** Exchange the public_token, store the item + accounts, run the first sync. */
export async function exchangePublicToken(publicToken: string, createdBy: string | null) {
  const plaid = getPlaid();
  if (!plaid) throw new Error("Plaid is not configured");
  const database = requireDb();

  const ex = await plaid.itemPublicTokenExchange({ public_token: publicToken });
  const accessToken = ex.data.access_token;
  const itemId = ex.data.item_id;

  const acctsRes = await plaid.accountsGet({ access_token: accessToken });
  const institutionId = acctsRes.data.item.institution_id ?? null;
  let institutionName: string | null = null;
  if (institutionId) {
    try {
      const inst = await plaid.institutionsGetById({
        institution_id: institutionId,
        country_codes: PLAID_COUNTRY_CODES,
      });
      institutionName = inst.data.institution.name;
    } catch {
      /* institution lookup is best-effort */
    }
  }

  // Store the item (idempotent on re-link of the same institution).
  const existingItem = await database.select().from(s.plaidItems).where(eq(s.plaidItems.itemId, itemId));
  if (existingItem.length) {
    await database
      .update(s.plaidItems)
      .set({ accessToken, status: "good", error: null, institutionName, institutionId })
      .where(eq(s.plaidItems.itemId, itemId));
  } else {
    await database.insert(s.plaidItems).values({
      id: crypto.randomUUID(),
      itemId,
      accessToken,
      institutionId,
      institutionName,
      createdBy,
    });
  }

  // Reconnecting a bank gives a NEW item + NEW Plaid account_ids for the SAME
  // real accounts. Match incoming accounts to existing ones by institution +
  // mask + name + type and RE-USE them, so a re-link doesn't create duplicates.
  const instName = institutionName || "";
  const acctKey = (mask: string | null | undefined, name: string | null | undefined, type: string) =>
    `${mask ?? ""}|${(name || "").trim().toLowerCase()}|${type}`;
  const existingByKey = new Map<string, string>();
  if (instName) {
    const existing = await database
      .select({ id: s.accounts.id, mask: s.accounts.mask, name: s.accounts.name, type: s.accounts.type })
      .from(s.accounts)
      .where(eq(s.accounts.institution, instName));
    for (const a of existing) if (!existingByKey.has(acctKey(a.mask, a.name, a.type))) existingByKey.set(acctKey(a.mask, a.name, a.type), a.id);
  }

  for (const pa of acctsRes.data.accounts) {
    const [mapped] = await database
      .select()
      .from(s.plaidAccounts)
      .where(eq(s.plaidAccounts.plaidAccountId, pa.account_id));
    if (mapped) continue;
    const type = mapAccountType(pa.type, pa.subtype);
    const key = acctKey(pa.mask, pa.name || pa.official_name, type);
    let ourId = existingByKey.get(key); // re-use the matching existing account if any
    if (!ourId) {
      ourId = crypto.randomUUID();
      await database.insert(s.accounts).values({
        id: ourId,
        name: pa.name || pa.official_name || "Account",
        institution: instName,
        type,
        mask: pa.mask || null,
        who: "Household",
        syncedLabel: "Synced just now",
      });
      existingByKey.set(key, ourId);
    }
    await database.insert(s.plaidAccounts).values({
      itemId,
      plaidAccountId: pa.account_id,
      accountId: ourId,
      name: pa.name,
      mask: pa.mask,
      type: pa.type,
      subtype: pa.subtype ?? null,
    });
  }

  // A reconnect REPLACES the prior connection for this institution. Drop the old
  // item(s) (different item_id) + their account mappings so accounts aren't
  // double-synced and the dead item doesn't linger. The accounts are kept (now
  // linked to the new item), so balances/history carry over.
  if (institutionId) {
    const oldItems = await database
      .select({ itemId: s.plaidItems.itemId, accessToken: s.plaidItems.accessToken })
      .from(s.plaidItems)
      .where(eq(s.plaidItems.institutionId, institutionId));
    for (const it of oldItems) {
      if (it.itemId === itemId) continue;
      try { await plaid.itemRemove({ access_token: it.accessToken }); } catch { /* best-effort revoke */ }
      await database.delete(s.plaidAccounts).where(eq(s.plaidAccounts.itemId, it.itemId));
      await database.delete(s.plaidItems).where(eq(s.plaidItems.itemId, it.itemId));
    }
  }

  const result = await syncItem(itemId);
  return { ok: true as const, itemId, institutionName, ...result };
}

/** Incremental transaction sync for one item → commitImport pipeline.
 *  Any failure (not just the Plaid pull — also the import/reconcile steps) is
 *  persisted to the item row before rethrowing. Without that, a mid-sync crash
 *  left status "good" + a stale lastSyncedAt, so the UI showed an Active bank
 *  that silently hadn't synced in days. */
export async function syncItem(itemId: string) {
  try {
    return await syncItemInner(itemId);
  } catch (e) {
    const msg = (e as { message?: string })?.message || String(e);
    try {
      const database = requireDb();
      await database.update(s.plaidItems).set({ status: "error", error: msg }).where(eq(s.plaidItems.itemId, itemId));
    } catch {
      /* persisting the failure is best-effort */
    }
    throw e;
  }
}

async function syncItemInner(itemId: string) {
  const plaid = getPlaid();
  if (!plaid) throw new Error("Plaid is not configured");
  const database = requireDb();

  const [item] = await database.select().from(s.plaidItems).where(eq(s.plaidItems.itemId, itemId));
  if (!item) throw new Error("Unknown Plaid item");

  const paRows = await database.select().from(s.plaidAccounts).where(eq(s.plaidAccounts.itemId, itemId));
  // Accounts moved to a non-household space (e.g. business) are skipped — their
  // Plaid transactions are not imported. Defensive read so a pre-migration DB
  // (no `space` column) just syncs everything as before.
  const acctSpaceRows = await database
    .select({ id: s.accounts.id, space: s.accounts.space })
    .from(s.accounts)
    .catch(() => [] as { id: string; space: string }[]);
  const businessAcctIds = new Set(acctSpaceRows.filter((a) => (a.space ?? "household") !== "household").map((a) => a.id));
  const ourByPlaid = new Map(
    paRows
      .filter((p) => !p.accountId || !businessAcctIds.has(p.accountId))
      .map((p) => [p.plaidAccountId, p.accountId] as const)
  );

  // 1) Pull the incremental delta.
  let cursor = item.cursor || undefined;
  const added: PlaidTxn[] = [];
  const modified: PlaidTxn[] = [];
  const removedIds: string[] = [];
  try {
    let hasMore = true;
    while (hasMore) {
      const res = await plaid.transactionsSync({ access_token: item.accessToken, cursor, count: 500 });
      added.push(...(res.data.added as unknown as PlaidTxn[]));
      modified.push(...(res.data.modified as unknown as PlaidTxn[]));
      removedIds.push(...res.data.removed.map((r) => r.transaction_id).filter(Boolean) as string[]);
      cursor = res.data.next_cursor;
      hasMore = res.data.has_more;
    }
  } catch (e) {
    const msg = (e as { message?: string })?.message || String(e);
    await database.update(s.plaidItems).set({ status: "error", error: msg }).where(eq(s.plaidItems.itemId, itemId));
    throw e;
  }

  // 2) Balances per account. We reconcile our displayed balance to the bank's
  // CURRENT balance (the posted ledger balance — the main number on the card)
  // and separately snapshot the AVAILABLE balance (spendable after pending holds)
  // for the secondary line. The bank doesn't always report `available`.
  const balanceByPlaid = new Map<string, number>(); // current (main)
  const availableByPlaid = new Map<string, number | null>(); // available (snapshot)
  const capture = (accts: Array<{ account_id: string; balances?: { available?: number | null; current?: number | null } | null }>) => {
    for (const a of accts) {
      const bals = a.balances;
      if (!bals) continue;
      if (bals.current != null) balanceByPlaid.set(a.account_id, bals.current);
      availableByPlaid.set(a.account_id, bals.available ?? null);
    }
  };
  // Seed from accountsGet first — it returns cached balances and is reliable
  // (the same call used at connect). accountsBalanceGet does a LIVE pull from the
  // bank and frequently times out / rate-limits (MACU especially); when it threw,
  // the old code left this map empty and the reconcile below silently no-op'd,
  // so every account's balance stayed stale. Seeding from accountsGet guarantees
  // we always have a value to reconcile against.
  try {
    const acc = await plaid.accountsGet({ access_token: item.accessToken });
    capture(acc.data.accounts);
  } catch {
    /* fall through to the live balance call */
  }
  // Refresh with the live balance where it succeeds (more up to date).
  try {
    const bal = await plaid.accountsBalanceGet({ access_token: item.accessToken });
    capture(bal.data.accounts);
  } catch {
    /* balances are best-effort — accountsGet seed above covers us */
  }

  // 3) Delete removed + modified rows (modified get reinserted fresh).
  const deleteIds = [...removedIds, ...modified.map((m) => m.transaction_id)];
  if (deleteIds.length) {
    const keys: string[] = [];
    for (const txnId of deleteIds) {
      for (const aid of ourByPlaid.values()) {
        if (aid) keys.push(dedupeKey({ externalId: txnId, date: "", amount: 0, merchant: "", accountId: aid }));
      }
    }
    if (keys.length) await database.delete(s.transactions).where(inArray(s.transactions.dedupeHash, keys));
  }

  // 4) Insert added + modified via the import pipeline (per account).
  const toInsert = [...added, ...modified].filter((t) => ourByPlaid.get(t.account_id));
  let imported = 0;
  // What actually landed per account (post-dedup) → drives notifications.
  const freshByAccount = new Map<string, InsertedRow[]>();
  if (toInsert.length) {
    // Plaid's merchant enrichment misreads MACU share-transfer memos as retail
    // brands ("Trans To ZITTING,JARED" → "Jared The Galleria Of Jewelry",
    // share deposits → "Costco"). When the raw bank text says transfer and the
    // enriched name doesn't, trust the raw text — otherwise transfers leak
    // into spending categories under bogus merchants.
    const pickMerchant = (t: { name?: string | null; merchant_name?: string | null }) =>
      t.name && looksLikeTransfer(t.name) && t.merchant_name && !looksLikeTransfer(t.merchant_name)
        ? t.name
        : t.merchant_name || t.name;

    // Auto-categorize with our engine (same as CSV import).
    const sugg = await suggestCategories(
      toInsert.map((t) => ({
        merchant: pickMerchant(t) || "",
        amount: -t.amount, // Plaid: +out / −in → our signed convention
        accountId: ourByPlaid.get(t.account_id) ?? null,
        isTransfer: false,
      }))
    );

    // Person attribution: a rule/memory suggestion wins; otherwise a
    // transaction on an account with exactly ONE assigned manager belongs to
    // that member (Jae's card spend is Jaelynn's, Katelynn's is Katelynn's).
    // Shared accounts (2 managers) stay unattributed = Household.
    const acctMemberRows = await db!
      .select()
      .from(s.accountMembers)
      .catch(() => [] as (typeof s.accountMembers.$inferSelect)[]);
    const managersByAcct = new Map<string, string[]>();
    for (const am of acctMemberRows) {
      const arr = managersByAcct.get(am.accountId) || [];
      arr.push(am.memberId);
      managersByAcct.set(am.accountId, arr);
    }
    const soloManager = (accountId: string) => {
      const arr = managersByAcct.get(accountId);
      return arr && arr.length === 1 ? arr[0] : null;
    };

    const byAccount = new Map<string, ImportRowLite[]>();
    toInsert.forEach((t, i) => {
      const accountId = ourByPlaid.get(t.account_id)!;
      const ourAmount = -t.amount;
      const merchant = pickMerchant(t) || "(no description)";
      // Keep the full raw bank text when it's richer than the cleaned merchant
      // name (Plaid's `name` vs `merchant_name`) — surfaced in the detail drawer
      // to help identify ambiguous charges.
      const description = t.name && t.name !== merchant ? t.name : null;
      const sg = sugg[i];
      const isTransfer = sg?.source === "transfer" || looksLikeTransfer(merchant);
      const arr = byAccount.get(accountId) || [];
      arr.push({
        date: t.date,
        merchant,
        description,
        amount: ourAmount,
        income: ourAmount > 0,
        externalId: t.transaction_id,
        categoryId: sg?.categoryId ?? null,
        categorySource: sg?.source ?? null,
        categoryConfidence: sg?.confidence ?? null,
        isTransfer,
        memberId: sg?.member ?? soloManager(accountId),
      });
      byAccount.set(accountId, arr);
    });

    for (const [accountId, rows] of byAccount) {
      // find this account's Plaid current balance
      const plaidAcctId = paRows.find((p) => p.accountId === accountId)?.plaidAccountId;
      const accountBalance = plaidAcctId ? balanceByPlaid.get(plaidAcctId) ?? null : null;
      const res = await commitImport({
        accountId,
        filename: `${item.institutionName || "Bank"} · auto-sync`,
        createdBy: item.createdBy,
        accountBalance,
        source: "plaid",
        rows,
      });
      imported += res.imported;
      // Collect what actually landed (post-dedup) for notifications below.
      for (const ir of res.insertedRows) {
        freshByAccount.set(accountId, [...(freshByAccount.get(accountId) || []), ir]);
      }
    }
  }

  // 4b) Reconcile EVERY linked account's balance to the bank's reported balance
  // on every sync — not only when new transactions arrived. `accounts.balance`
  // is the OPENING balance; the displayed balance is opening + the net of the
  // account's transactions, so we set opening = bankBalance − net. Without this,
  // a sync that brings no new rows for an account leaves its balance stale and
  // it drifts away from the bank.
  for (const p of paRows) {
    if (!p.accountId) continue;
    const bankBal = balanceByPlaid.get(p.plaidAccountId);
    if (bankBal == null) continue;
    // Plaid reports credit-card and loan balances as a POSITIVE "amount owed".
    // We store debt as NEGATIVE so net worth subtracts it and signs stay
    // consistent across every card/loan (depository balances pass through).
    // Without this, a $30k auto loan and credit-card debt show up as positive
    // assets and inflate net worth. mapAccountType buckets credit+loan as
    // "credit"; p.type/p.subtype are the raw Plaid values.
    const isDebt = mapAccountType(p.type ?? "", p.subtype) === "credit";
    const signedBank = signedBankBalance(p.type ?? "", p.subtype, bankBal);
    const balRows = await database
      .select({ a: s.transactions.amount })
      .from(s.transactions)
      .where(eq(s.transactions.accountId, p.accountId));
    const net = balRows.reduce((sum, r) => sum + Number(r.a ?? 0), 0);
    // Core reconcile: displayed (current) balance = opening + net = signedBank.
    await database.update(s.accounts).set({ balance: String(signedBank - net) }).where(eq(s.accounts.id, p.accountId));
    // Available snapshot (point-in-time, not derived). For depository accounts
    // this is spendable cash; for credit it's available credit, so only keep it
    // on non-debt accounts (a credit "available" isn't cash and must never feed
    // a cash/coverage total). Written separately + defensively so a
    // not-yet-migrated `available_balance` column can't break the core sync.
    const avail = isDebt ? null : availableByPlaid.get(p.plaidAccountId);
    await database
      .update(s.accounts)
      .set({ availableBalance: avail != null ? String(avail) : null })
      .where(eq(s.accounts.id, p.accountId))
      .catch(() => {});
  }

  // 5) In-app notifications for what just arrived (owners + managing members).
  await emitSyncNotifications(item.institutionName, freshByAccount, ourByPlaid, paRows);

  await database
    .update(s.plaidItems)
    .set({ cursor: cursor ?? null, status: "good", error: null, lastSyncedAt: new Date() })
    .where(eq(s.plaidItems.itemId, itemId));

  return { imported, added: added.length, modified: modified.length, removed: removedIds.length };
}

const LARGE_CHARGE = 200; // $ outflow that earns its own owner alert
const fmtUsd = (v: number) => "$" + Math.abs(Math.round(v)).toLocaleString("en-US");

/**
 * Write in-app notifications for the rows that just synced. Owners get a
 * household feed (large charges individually, the rest as a single/batch
 * summary); members who manage an account get a "new to categorize" nudge.
 * All keyed by stable dedupe hashes so the webhook + nightly cron can't
 * double-post. Best-effort — never throws into the sync path.
 */
async function emitSyncNotifications(
  institutionName: string | null,
  freshByAccount: Map<string, InsertedRow[]>,
  _ourByPlaid: Map<string, string | null>,
  paRows: { plaidAccountId: string; accountId: string | null; name: string | null; mask: string | null }[]
) {
  try {
    const database = requireDb();
    const acctIds = [...freshByAccount.keys()];
    // Internal transfers between own accounts aren't "news".
    const fresh = acctIds
      .flatMap((aid) => freshByAccount.get(aid)!.map((r) => ({ ...r, accountId: aid })))
      .filter((r) => !r.isTransfer);
    if (!fresh.length) return;
    const bank = institutionName || "your bank";

    // Owners — large charges, surfaced individually.
    const large = fresh.filter((r) => r.amount < 0 && Math.abs(r.amount) >= LARGE_CHARGE);
    const largeIds = new Set(large.map((r) => r.externalId));
    for (const r of large) {
      await createNotification({
        type: "large-charge",
        tone: "warning",
        icon: "alert",
        audience: "owners",
        title: `Large charge · ${fmtUsd(r.amount)}`,
        body: `${r.merchant} — posted at ${bank}.`,
        linkTo: "transactions",
        entityType: "transaction",
        entityRef: r.externalId || null,
        dedupeKey: r.externalId ? `plaid:large:${r.externalId}` : undefined,
      });
    }

    // Owners — the rest, as a single line or a batch summary.
    const rest = fresh.filter((r) => !largeIds.has(r.externalId));
    if (rest.length === 1) {
      const r = rest[0];
      await createNotification({
        type: "new-transaction",
        tone: "info",
        icon: "list",
        audience: "owners",
        title: `New transaction · ${fmtUsd(r.amount)}`,
        body: `${r.merchant} — ${r.income ? "deposit at" : "from"} ${bank}.`,
        linkTo: "transactions",
        entityType: "transaction",
        entityRef: r.externalId || null,
        dedupeKey: r.externalId ? `plaid:txn:${r.externalId}` : undefined,
      });
    } else if (rest.length > 1) {
      const spent = rest.reduce((sum, r) => sum + (r.amount < 0 ? Math.abs(r.amount) : 0), 0);
      const ids = rest.map((r) => r.externalId || "").sort().join(",");
      await createNotification({
        type: "new-transactions",
        tone: "info",
        icon: "list",
        audience: "owners",
        title: `${rest.length} new transactions`,
        body: `${fmtUsd(spent)} in spending synced from ${bank}.`,
        linkTo: "transactions",
        entityType: "transaction-group",
        entityRef: ids, // comma-joined externalIds → detail resolves the set
        dedupeKey: `plaid:sync:${ids}`,
      });
    }

    // Members — nudge whoever is in charge of each account with new rows.
    const memberRows = await database
      .select()
      .from(s.accountMembers)
      .where(inArray(s.accountMembers.accountId, acctIds))
      .catch(() => [] as { accountId: string; memberId: string }[]);
    if (!memberRows.length) return;
    const managersByAccount = new Map<string, string[]>();
    for (const am of memberRows) {
      managersByAccount.set(am.accountId, [...(managersByAccount.get(am.accountId) || []), am.memberId]);
    }
    const labelById = new Map<string, string>();
    for (const p of paRows) {
      if (p.accountId) labelById.set(p.accountId, p.mask ? `${p.name || "account"} ••${p.mask}` : p.name || "your account");
    }
    for (const aid of acctIds) {
      const managers = managersByAccount.get(aid);
      if (!managers?.length) continue;
      const rows = (freshByAccount.get(aid) || []).filter((r) => !r.isTransfer);
      if (!rows.length) continue;
      const ids = rows.map((r) => r.externalId || "").sort().join(",");
      const label = labelById.get(aid) || "your account";
      for (const memberId of managers) {
        await createNotification({
          type: "categorize-nudge",
          tone: "accent",
          icon: "list",
          audience: "member",
          memberId,
          title: rows.length === 1 ? "1 new transaction to categorize" : `${rows.length} new transactions to categorize`,
          body: `New activity on ${label}. Tap to review and confirm.`,
          entityType: "account", // account-scoped → drives the member access guard
          entityRef: aid,
          dedupeKey: `plaid:mnudge:${memberId}:${aid}:${ids}`,
        });
      }
    }
  } catch {
    /* notifications are best-effort — never break the sync */
  }
}

/** Sync every connected item (used by the nightly cron + webhook fan-out).
 *  One bad item doesn't stop the rest, but failures are returned (not
 *  swallowed) so the manual "Sync now" can tell the user what broke. */
export async function syncAllItems() {
  const database = requireDb();
  const items = await database
    .select({ itemId: s.plaidItems.itemId, institutionName: s.plaidItems.institutionName })
    .from(s.plaidItems);
  let total = 0;
  const failed: { itemId: string; institutionName: string | null; error: string }[] = [];
  for (const it of items) {
    try {
      const r = await syncItem(it.itemId);
      total += r.imported;
    } catch (e) {
      console.error(`[plaid] sync failed for ${it.institutionName || it.itemId}`, e);
      failed.push({ itemId: it.itemId, institutionName: it.institutionName, error: (e as { message?: string })?.message || String(e) });
    }
  }
  return { ok: failed.length === 0, items: items.length, imported: total, failed };
}

/** Disconnect a bank: remove the item at Plaid + locally (keeps transactions). */
export async function removePlaidItem(itemId: string) {
  const database = requireDb();
  const [item] = await database.select().from(s.plaidItems).where(eq(s.plaidItems.itemId, itemId));
  if (!item) return { ok: true as const };
  const plaid = getPlaid();
  if (plaid) {
    try {
      await plaid.itemRemove({ access_token: item.accessToken });
    } catch {
      /* best-effort — still drop locally */
    }
  }
  await database.delete(s.plaidAccounts).where(eq(s.plaidAccounts.itemId, itemId));
  await database.delete(s.plaidItems).where(eq(s.plaidItems.itemId, itemId));
  return { ok: true as const };
}

/** List connected banks for the UI (no secrets). */
export async function listPlaidItems() {
  const database = requireDb();
  const rows = await database.select().from(s.plaidItems);
  return rows.map((r) => ({
    itemId: r.itemId,
    institutionName: r.institutionName,
    status: r.status,
    error: r.error,
    lastSyncedAt: r.lastSyncedAt ? new Date(r.lastSyncedAt).toISOString() : null,
  }));
}

// Minimal shapes (avoid leaking the full Plaid SDK types through the app).
interface PlaidTxn {
  transaction_id: string;
  account_id: string;
  date: string;
  amount: number;
  name: string;
  merchant_name?: string | null;
}
interface InsertedRow {
  merchant: string;
  amount: number;
  date: string | null;
  externalId: string | null; // stable dedupe hash → notification idempotency
  isTransfer: boolean;
  income: boolean;
}
interface ImportRowLite {
  date: string;
  merchant: string;
  description: string | null;
  amount: number;
  income: boolean;
  externalId: string;
  categoryId: string | null;
  categorySource: string | null;
  categoryConfidence: number | null;
  isTransfer: boolean;
  memberId: string | null;
}
