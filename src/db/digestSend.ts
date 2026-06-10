/**
 * Email-digest orchestration (server). Loads the data, builds the per-recipient
 * summaries via the pure digest.ts, renders templates, and sends through Resend
 * — idempotently (digest_log dedupes a (recipient, period, kind) send). Mirrors
 * the transfers-cron pattern; degrades to a no-op when email/DB isn't configured.
 */
import { and, eq } from "drizzle-orm";
import { db } from "./index";
import * as s from "./schema";
import {
  generateDigests,
  windowFor,
  type DigestInput,
  type DigestCadence,
} from "./digest";
import { firstRunOnOrAfter, nextOccurrence } from "./schedule";
import { sendEmail, isEmailConfigured, SITE_URL } from "@/lib/email";
import { renderOwnerDigest, renderMemberDigest } from "@/lib/email-templates";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const num = (v: unknown) => (v == null ? 0 : Number(v));
const todayISO = () => new Date().toISOString().slice(0, 10);
const dayLabel = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso.slice(0, 10) + "T00:00:00");
  return isNaN(d.getTime()) ? iso : `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
};
const OWNER_EMAILS = (process.env.OWNER_EMAILS || "jared@vectorux.com")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

type Settings = typeof s.digestSettings.$inferSelect;

/** Read the household settings row, creating the default if absent. */
async function loadSettings(): Promise<Settings | null> {
  if (!db) return null;
  const [row] = await db.select().from(s.digestSettings).where(eq(s.digestSettings.id, "household"));
  if (row) return row;
  const seed = { id: "household", cadence: "monthly", enabled: true, ownerEnabled: true, membersEnabled: true, anchorDate: todayISO(), nextRunDate: firstRunOnOrAfter("monthly", todayISO(), todayISO()) };
  await db.insert(s.digestSettings).values(seed).onConflictDoNothing();
  const [created] = await db.select().from(s.digestSettings).where(eq(s.digestSettings.id, "household"));
  return created ?? null;
}

/** Assemble the pure DigestInput for a given run date + cadence. */
async function buildInput(runDate: string, cadence: DigestCadence): Promise<DigestInput> {
  const database = db!;
  const [txnRows, splitRows, catRows, memRows, acctRows, budgetRows, goalRows, contribRows, instRows, acctMemRows] = [
    await database.select().from(s.transactions),
    await database.select().from(s.transactionSplits).catch(() => []),
    await database.select().from(s.categories).catch(() => []),
    await database.select().from(s.familyMembers).catch(() => []),
    await database.select().from(s.accounts).catch(() => []),
    await database.select().from(s.budgets).catch(() => []),
    await database.select().from(s.savingsGoals).catch(() => []),
    await database.select().from(s.savingsContributions).catch(() => []),
    await database.select().from(s.transferInstances).catch(() => []),
    await database.select().from(s.accountMembers).catch(() => [] as { accountId: string; memberId: string }[]),
  ];

  const categories = new Map(catRows.map((c) => [c.id, { name: c.name, color: c.color, kind: c.kind }]));
  const members = new Map(memRows.map((m) => [m.id, { name: m.name, allowance: num(m.allowance) }]));
  const acctById = new Map(acctRows.map((a) => [a.id, a]));
  // Business-space accounts never appear in digests (kept out of the household).
  const businessIds = new Set(acctRows.filter((a) => ((a as { space?: string }).space ?? "household") !== "household").map((a) => a.id));
  const visibleTxns = txnRows.filter((t) => !t.accountId || !businessIds.has(t.accountId));

  const savedByGoal = new Map<string, number>();
  for (const c of contribRows) savedByGoal.set(c.goalId, (savedByGoal.get(c.goalId) || 0) + num(c.amount));

  // Unreviewed counts on each member's managed accounts (for the "to categorize" nudge).
  const managedByMember = new Map<string, Set<string>>();
  for (const am of acctMemRows) {
    const set = managedByMember.get(am.memberId) || new Set<string>();
    set.add(am.accountId);
    managedByMember.set(am.memberId, set);
  }
  const toCategorizeByMember = new Map<string, number>();
  for (const [memberId, accts] of managedByMember) {
    let cnt = 0;
    for (const t of visibleTxns) if (!t.reviewed && t.accountId && accts.has(t.accountId)) cnt++;
    toCategorizeByMember.set(memberId, cnt);
  }

  return {
    txns: visibleTxns.map((t) => ({
      id: t.id, date: t.date as string | null, amount: num(t.amount), income: t.income,
      isTransfer: t.isTransfer, memberId: t.memberId, categoryId: t.categoryId,
      merchant: t.merchant, hasSplit: t.hasSplit,
    })),
    splits: splitRows.map((sp) => ({ transactionId: sp.transactionId, categoryId: sp.categoryId, amount: num(sp.amount) })),
    categories,
    members,
    budgets: budgetRows.map((b) => ({ name: b.name, categoryId: b.categoryId, memberId: b.memberId, limit: num(b.limitAmount) })),
    goals: goalRows.map((g) => ({ name: g.name, saved: savedByGoal.has(g.id) ? savedByGoal.get(g.id)! : num(g.saved), target: num(g.target) })),
    upcoming: instRows
      .filter((i) => i.status === "pending")
      .map((i) => ({
        label: (i.toAccountId ? acctById.get(i.toAccountId)?.name : null) ?? "Transfer",
        amount: num(i.amount),
        due: dayLabel(i.plannedDate as string | null),
      })),
    window: windowFor(cadence, runDate),
    toCategorizeByMember,
  };
}

interface SendResult { sent: number; skipped: number; failed: number; due: boolean }

/**
 * Send all due digests. `force` ignores the schedule (sends for the current
 * window now); recipients are still deduped per period via digest_log.
 */
export async function runDigests(today?: string, opts: { force?: boolean } = {}): Promise<SendResult> {
  const empty: SendResult = { sent: 0, skipped: 0, failed: 0, due: false };
  if (!db) return empty;
  const settings = await loadSettings();
  if (!settings || !settings.enabled) return empty;

  const runDate = (today ?? todayISO()).slice(0, 10);
  const cadence = (settings.cadence as DigestCadence) || "monthly";
  const due = opts.force || !settings.nextRunDate || (settings.nextRunDate as string) <= runDate;
  if (!due) return empty;

  const input = await buildInput(runDate, cadence);
  const { household, byMember } = generateDigests(input);
  const periodKey = `${runDate}:${cadence}`;
  const result: SendResult = { sent: 0, skipped: 0, failed: 0, due: true };

  const memberRows = await db.select().from(s.familyMembers);
  const memById = new Map(memberRows.map((m) => [m.id, m]));

  // Recipients: owners get the household overview; members get their own.
  const ownerEmails = new Set<string>();
  if (settings.ownerEnabled) {
    for (const e of OWNER_EMAILS) ownerEmails.add(e);
    for (const m of memberRows) if ((m.role === "owner" || m.role === "partner") && m.email) ownerEmails.add(m.email.toLowerCase());
  }
  const recipients: { email: string; kind: "owner" | "member"; memberId: string | null }[] = [];
  for (const email of ownerEmails) recipients.push({ email, kind: "owner", memberId: null });
  if (settings.membersEnabled) {
    for (const m of memberRows) {
      if (m.role === "member" && m.email && m.digestOptIn && !ownerEmails.has(m.email.toLowerCase())) {
        recipients.push({ email: m.email.toLowerCase(), kind: "member", memberId: m.id });
      }
    }
  }

  for (const r of recipients) {
    // Idempotency — already sent this period?
    const [dup] = await db.select({ id: s.digestLog.id }).from(s.digestLog)
      .where(and(eq(s.digestLog.recipientEmail, r.email), eq(s.digestLog.periodKey, periodKey), eq(s.digestLog.kind, r.kind)))
      .limit(1);
    if (dup) { result.skipped++; continue; }

    let mail: { subject: string; html: string; text: string } | null = null;
    if (r.kind === "owner") {
      mail = renderOwnerDigest(household, SITE_URL);
    } else if (r.memberId) {
      const md = byMember.get(r.memberId);
      // Skip members with literally nothing to report.
      if (md && (md.totalSpent > 0 || md.toCategorizeCount > 0)) mail = renderMemberDigest(md, SITE_URL);
    }
    if (!mail) { result.skipped++; continue; }

    const res = await sendEmail({ to: r.email, subject: mail.subject, html: mail.html, text: mail.text });
    if (res.ok) {
      await db.insert(s.digestLog).values({ recipientEmail: r.email, kind: r.kind, memberId: r.memberId, periodKey, status: "sent" });
      result.sent++;
    } else if ("skipped" in res && res.skipped) {
      result.skipped++; // email not configured — don't log, so it retries once set up
    } else {
      await db.insert(s.digestLog).values({ recipientEmail: r.email, kind: r.kind, memberId: r.memberId, periodKey, status: "failed", error: ("error" in res ? res.error : null) ?? null });
      result.failed++;
    }
  }

  // Advance the schedule (only on a real, scheduled run — not a forced preview-style run).
  if (!opts.force) {
    const next = nextOccurrence(cadence, (settings.anchorDate as string) || runDate, runDate);
    await db.update(s.digestSettings).set({ nextRunDate: next, lastRunDate: runDate, updatedAt: new Date() }).where(eq(s.digestSettings.id, "household"));
  }
  return result;
}

/** Build the OWNER digest for the current window and send it to one address now
 *  (the "send me a test" button) — bypasses schedule + dedupe. */
export async function sendDigestPreview(toEmail: string) {
  if (!db) return { ok: false as const, skipped: true as const };
  if (!isEmailConfigured) return { ok: false as const, skipped: true as const };
  const settings = await loadSettings();
  const cadence = ((settings?.cadence as DigestCadence) || "monthly");
  const input = await buildInput(todayISO(), cadence);
  const { household } = generateDigests(input);
  const mail = renderOwnerDigest(household, SITE_URL);
  const res = await sendEmail({ to: toEmail, subject: `[Test] ${mail.subject}`, html: mail.html, text: mail.text });
  return res;
}
