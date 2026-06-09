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
import { commitImport, suggestCategories } from "./mutations";
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
    }
  }

  await database
    .update(s.plaidItems)
    .set({ cursor: cursor ?? null, status: "good", error: null, lastSyncedAt: new Date() })
    .where(eq(s.plaidItems.itemId, itemId));

  return { imported, added: added.length, modified: modified.length, removed: removedIds.length };
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
