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

function requireDb() {
  if (!db) throw new Error("Database not configured");
  return db;
}

/**
 * Map a Plaid account type/subtype to our 3 buckets (checking | savings |
 * credit). Credit cards and loans are debt; savings/CD/money-market/HSA and
 * investment accounts are treated as savings-side assets; everyday spending
 * accounts are checking. We don't have a dedicated investment bucket, so
 * investments land in savings (an asset) rather than checking.
 */
function mapAccountType(type: string, subtype: string | null | undefined): string {
  const sub = (subtype || "").toLowerCase();
  if (type === "credit" || type === "loan") return "credit";
  if (type === "investment" || type === "brokerage") return "savings";
  if (type === "depository") {
    const savingsLike = ["savings", "cd", "money market", "hsa", "prepaid"];
    return savingsLike.includes(sub) ? "savings" : "checking";
  }
  return "checking";
}

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

  // Create + link one of our accounts per Plaid account (first connect only).
  for (const pa of acctsRes.data.accounts) {
    const [mapped] = await database
      .select()
      .from(s.plaidAccounts)
      .where(eq(s.plaidAccounts.plaidAccountId, pa.account_id));
    if (mapped) continue;
    const ourId = crypto.randomUUID();
    await database.insert(s.accounts).values({
      id: ourId,
      name: pa.name || pa.official_name || "Account",
      institution: institutionName || "",
      type: mapAccountType(pa.type, pa.subtype),
      mask: pa.mask || null,
      who: "Household",
      syncedLabel: "Synced just now",
    });
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

  const result = await syncItem(itemId);
  return { ok: true as const, itemId, institutionName, ...result };
}

/** Incremental transaction sync for one item → commitImport pipeline. */
export async function syncItem(itemId: string) {
  const plaid = getPlaid();
  if (!plaid) throw new Error("Plaid is not configured");
  const database = requireDb();

  const [item] = await database.select().from(s.plaidItems).where(eq(s.plaidItems.itemId, itemId));
  if (!item) throw new Error("Unknown Plaid item");

  const paRows = await database.select().from(s.plaidAccounts).where(eq(s.plaidAccounts.itemId, itemId));
  const ourByPlaid = new Map(paRows.map((p) => [p.plaidAccountId, p.accountId] as const));

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

  // 2) Current balances per account (to reconcile our opening balance).
  const balanceByPlaid = new Map<string, number>();
  try {
    const bal = await plaid.accountsBalanceGet({ access_token: item.accessToken });
    for (const a of bal.data.accounts) {
      if (a.balances?.current != null) balanceByPlaid.set(a.account_id, a.balances.current);
    }
  } catch {
    /* balances are best-effort */
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
    // Auto-categorize with our engine (same as CSV import).
    const sugg = await suggestCategories(
      toInsert.map((t) => ({
        merchant: t.merchant_name || t.name,
        amount: -t.amount, // Plaid: +out / −in → our signed convention
        accountId: ourByPlaid.get(t.account_id) ?? null,
        isTransfer: false,
      }))
    );

    const byAccount = new Map<string, ImportRowLite[]>();
    toInsert.forEach((t, i) => {
      const accountId = ourByPlaid.get(t.account_id)!;
      const ourAmount = -t.amount;
      const merchant = t.merchant_name || t.name || "(no description)";
      const sg = sugg[i];
      const isTransfer = sg?.source === "transfer" || looksLikeTransfer(merchant);
      const arr = byAccount.get(accountId) || [];
      arr.push({
        date: t.date,
        merchant,
        amount: ourAmount,
        income: ourAmount > 0,
        externalId: t.transaction_id,
        categoryId: sg?.categoryId ?? null,
        categorySource: sg?.source ?? null,
        categoryConfidence: sg?.confidence ?? null,
        isTransfer,
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
        icon: "transactions",
        audience: "owners",
        title: `New transaction · ${fmtUsd(r.amount)}`,
        body: `${r.merchant} — ${r.income ? "deposit at" : "from"} ${bank}.`,
        linkTo: "transactions",
        dedupeKey: r.externalId ? `plaid:txn:${r.externalId}` : undefined,
      });
    } else if (rest.length > 1) {
      const spent = rest.reduce((sum, r) => sum + (r.amount < 0 ? Math.abs(r.amount) : 0), 0);
      const ids = rest.map((r) => r.externalId || "").sort().join(",");
      await createNotification({
        type: "new-transactions",
        tone: "info",
        icon: "transactions",
        audience: "owners",
        title: `${rest.length} new transactions`,
        body: `${fmtUsd(spent)} in spending synced from ${bank}.`,
        linkTo: "transactions",
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
          icon: "transactions",
          audience: "member",
          memberId,
          title: rows.length === 1 ? "1 new transaction to categorize" : `${rows.length} new transactions to categorize`,
          body: `New activity on ${label}. Tap to review and confirm.`,
          dedupeKey: `plaid:mnudge:${memberId}:${aid}:${ids}`,
        });
      }
    }
  } catch {
    /* notifications are best-effort — never break the sync */
  }
}

/** Sync every connected item (used by the nightly cron + webhook fan-out). */
export async function syncAllItems() {
  const database = requireDb();
  const items = await database.select({ itemId: s.plaidItems.itemId }).from(s.plaidItems);
  let total = 0;
  for (const it of items) {
    try {
      const r = await syncItem(it.itemId);
      total += r.imported;
    } catch {
      /* one bad item shouldn't stop the rest */
    }
  }
  return { ok: true as const, items: items.length, imported: total };
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
  amount: number;
  income: boolean;
  externalId: string;
  categoryId: string | null;
  categorySource: string | null;
  categoryConfidence: number | null;
  isTransfer: boolean;
}
