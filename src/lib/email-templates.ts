/**
 * Email digest templates (pure). Produce { subject, html, text } from the
 * digest summaries in src/db/digest.ts. Hand-built table-based HTML with inline
 * styles + explicit hex colors (email clients have none of the app's CSS vars
 * and poor fl/grid support). Dark "premium fintech" palette to match the app.
 * Pure + deterministic → testable.
 */
import type { OwnerDigest, MemberDigest, CatSlice, BiggestTxn } from "@/db/digest";

const C = {
  bg: "#0A0A0B",
  card: "#161618",
  raised: "#1F1F23",
  hair: "#2A2A2E",
  text: "#F5F5F4",
  sub: "#A8A8AD",
  faint: "#76767C",
  accent: "#3FD07F",
  negative: "#F2705A",
  warning: "#F2B14C",
};

// Map the app's CSS-var category colors to hex for email.
const VAR_HEX: Record<string, string> = {
  "var(--accent)": C.accent,
  "var(--green-500)": C.accent,
  "var(--green-600)": "#2FA866",
  "var(--indigo-500)": "#6E8BFF",
  "var(--amber-500)": C.warning,
  "var(--gray-500)": "#6B6B70",
};
const hex = (v: string | null | undefined) => (v && VAR_HEX[v]) || "#6B6B70";

const usd = (v: number) => "$" + Math.round(v).toLocaleString("en-US");
const signed = (v: number) => (v < 0 ? "−" : "+") + usd(Math.abs(v));
const esc = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function shell(inner: string, preheader: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:0;background:${C.bg};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.bg};">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td style="padding:4px 8px 20px;">
  <span style="font-size:18px;font-weight:700;color:${C.text};letter-spacing:-0.02em;">Zitting</span>
  <span style="font-size:18px;font-weight:700;color:${C.accent};letter-spacing:-0.02em;"> HQ</span>
</td></tr>
${inner}
<tr><td style="padding:24px 8px;border-top:1px solid ${C.hair};">
  <p style="margin:0;font-size:12px;color:${C.faint};line-height:1.6;">You're getting this because finance digests are on. Change the cadence or turn it off anytime in Zitting HQ → Notifications.</p>
</td></tr>
</table>
</td></tr></table></body></html>`;
}

function card(inner: string): string {
  return `<tr><td style="padding:0 0 14px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.hair};border-radius:14px;"><tr><td style="padding:18px 18px;">${inner}</td></tr></table></td></tr>`;
}
const eyebrow = (t: string) =>
  `<div style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${C.faint};margin:0 0 12px;">${esc(t)}</div>`;

function kpi(label: string, value: string, sub?: string, accent = false): string {
  return `<td style="padding:0 8px;" valign="top">
    <div style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:${C.faint};margin-bottom:6px;">${esc(label)}</div>
    <div style="font-size:26px;font-weight:700;letter-spacing:-0.02em;color:${accent ? C.accent : C.text};">${esc(value)}</div>
    ${sub ? `<div style="font-size:12px;color:${C.sub};margin-top:4px;">${esc(sub)}</div>` : ""}
  </td>`;
}

function catBars(cats: CatSlice[]): string {
  if (!cats.length) return `<div style="font-size:13px;color:${C.sub};">No spending this period.</div>`;
  return cats.map((c) => `
    <div style="margin-bottom:11px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:13.5px;color:${C.text};">${esc(c.name)}</td>
        <td align="right" style="font-size:13.5px;color:${C.sub};font-variant-numeric:tabular-nums;">${usd(c.amount)} · ${c.percent}%</td>
      </tr></table>
      <div style="height:6px;background:${C.raised};border-radius:99px;margin-top:6px;">
        <div style="height:6px;width:${Math.max(3, c.percent)}%;background:${hex(c.color)};border-radius:99px;"></div>
      </div>
    </div>`).join("");
}

function txnList(txns: BiggestTxn[]): string {
  return txns.map((t, i) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${i ? `border-top:1px solid ${C.hair};` : ""}"><tr>
      <td style="padding:9px 0;font-size:13.5px;color:${C.text};">${esc(t.merchant)}${t.member ? `<span style="color:${C.faint};"> · ${esc(t.member)}</span>` : ""}${t.date ? `<span style="color:${C.faint};"> · ${esc(t.date)}</span>` : ""}</td>
      <td align="right" style="padding:9px 0;font-size:13.5px;font-weight:600;color:${C.text};font-variant-numeric:tabular-nums;">${usd(t.amount)}</td>
    </tr></table>`).join("");
}

function deltaSub(delta: number, pct: number | null, invertGood = true): string {
  if (!delta) return "flat vs. last period";
  const up = delta > 0;
  const word = up ? "more" : "less";
  return `${signed(delta)}${pct != null ? ` (${up ? "+" : "−"}${Math.abs(pct)}%)` : ""} ${word} than last period`;
}

export function renderOwnerDigest(d: OwnerDigest, siteUrl: string): { subject: string; html: string; text: string } {
  const subject = `Your finance digest · ${d.periodLabel}`;
  const sections: string[] = [];

  sections.push(card(`${eyebrow(`Household · ${d.periodLabel}`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      ${kpi("Spent", usd(d.totalSpent), deltaSub(d.vsPrev.spentDelta, d.vsPrev.spentPct), true)}
      ${kpi("Income", usd(d.totalIncome))}
      ${kpi("Net", signed(d.net))}
    </tr></table>
    <div style="font-size:12px;color:${C.faint};margin-top:14px;">${d.txnCount} transactions this period.</div>`));

  sections.push(card(`${eyebrow("Where it went")}${catBars(d.topCategories)}`));

  if (d.perMember.length) {
    sections.push(card(`${eyebrow("By person")}${d.perMember.map((m, i) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${i ? `border-top:1px solid ${C.hair};` : ""}"><tr>
        <td style="padding:9px 0;font-size:13.5px;color:${C.text};">${esc(m.name)}${m.topCategory ? `<span style="color:${C.faint};"> · mostly ${esc(m.topCategory)}</span>` : ""}</td>
        <td align="right" style="padding:9px 0;font-size:13.5px;font-weight:600;color:${C.text};font-variant-numeric:tabular-nums;">${usd(m.spent)}</td>
      </tr></table>`).join("")}`));
  }

  if (d.biggest.length) sections.push(card(`${eyebrow("Biggest transactions")}${txnList(d.biggest)}`));

  if (d.topMerchants.length) {
    sections.push(card(`${eyebrow("Top merchants")}${d.topMerchants.map((m, i) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${i ? `border-top:1px solid ${C.hair};` : ""}"><tr>
        <td style="padding:8px 0;font-size:13.5px;color:${C.text};">${esc(m.merchant)}</td>
        <td align="right" style="padding:8px 0;font-size:13.5px;color:${C.sub};font-variant-numeric:tabular-nums;">${usd(m.amount)}</td>
      </tr></table>`).join("")}`));
  }

  if (d.budgets.length) {
    sections.push(card(`${eyebrow("Budgets")}${d.budgets.map((b, i) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${i ? `border-top:1px solid ${C.hair};` : ""}"><tr>
        <td style="padding:8px 0;font-size:13.5px;color:${C.text};">${esc(b.name)}</td>
        <td align="right" style="padding:8px 0;font-size:13px;font-weight:600;color:${b.over ? C.negative : C.accent};font-variant-numeric:tabular-nums;">${usd(b.spent)} / ${usd(b.limit)}${b.over ? " · over" : ""}</td>
      </tr></table>`).join("")}`));
  }

  if (d.goals.length) {
    sections.push(card(`${eyebrow("Savings goals")}${d.goals.map((g) => `
      <div style="margin-bottom:11px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:13.5px;color:${C.text};">${esc(g.name)}</td>
          <td align="right" style="font-size:13px;color:${C.sub};font-variant-numeric:tabular-nums;">${usd(g.saved)} / ${usd(g.target)} · ${g.pct}%</td>
        </tr></table>
        <div style="height:6px;background:${C.raised};border-radius:99px;margin-top:6px;"><div style="height:6px;width:${Math.max(3, g.pct)}%;background:${C.accent};border-radius:99px;"></div></div>
      </div>`).join("")}`));
  }

  if (d.upcoming.length) {
    sections.push(card(`${eyebrow("Upcoming transfers to make")}${d.upcoming.map((u, i) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${i ? `border-top:1px solid ${C.hair};` : ""}"><tr>
        <td style="padding:8px 0;font-size:13.5px;color:${C.text};">${esc(u.label)}${u.due ? `<span style="color:${C.faint};"> · ${esc(u.due)}</span>` : ""}</td>
        <td align="right" style="padding:8px 0;font-size:13.5px;color:${C.sub};font-variant-numeric:tabular-nums;">${usd(u.amount)}</td>
      </tr></table>`).join("")}`));
  }

  sections.push(`<tr><td style="padding:6px 8px 0;"><a href="${esc(siteUrl)}/finance" style="display:inline-block;background:${C.accent};color:#0A0A0B;font-size:14px;font-weight:600;text-decoration:none;padding:11px 18px;border-radius:10px;">Open Zitting HQ →</a></td></tr>`);

  const text = [
    `Zitting HQ — Household finance digest (${d.periodLabel})`,
    `Spent ${usd(d.totalSpent)} · Income ${usd(d.totalIncome)} · Net ${signed(d.net)} (${d.txnCount} transactions)`,
    "",
    "Where it went: " + d.topCategories.map((c) => `${c.name} ${usd(c.amount)} (${c.percent}%)`).join(", "),
    d.perMember.length ? "By person: " + d.perMember.map((m) => `${m.name} ${usd(m.spent)}`).join(", ") : "",
    `${siteUrl}/finance`,
  ].filter(Boolean).join("\n");

  return { subject, html: shell(sections.join(""), `${usd(d.totalSpent)} spent · ${d.periodLabel}`), text };
}

export function renderMemberDigest(d: MemberDigest, siteUrl: string): { subject: string; html: string; text: string } {
  const subject = `${d.name}, your spending recap · ${d.periodLabel}`;
  const sections: string[] = [];

  sections.push(card(`${eyebrow(`Hi ${d.name} · ${d.periodLabel}`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      ${kpi("You spent", usd(d.totalSpent), deltaSub(d.vsPrev.spentDelta, d.vsPrev.spentPct), true)}
      ${d.allowance ? kpi("Left this month", usd(Math.max(0, d.allowance.left)), `of ${usd(d.allowance.limit)} allowance`) : kpi("Transactions", String(d.txnCount))}
    </tr></table>`));

  sections.push(card(`${eyebrow("Your categories")}${catBars(d.topCategories)}`));

  if (d.biggest.length) sections.push(card(`${eyebrow("Your biggest purchases")}${txnList(d.biggest)}`));

  if (d.toCategorizeCount > 0) {
    sections.push(card(`<div style="font-size:13.5px;color:${C.text};">📋 You have <b style="color:${C.warning};">${d.toCategorizeCount}</b> transaction${d.toCategorizeCount === 1 ? "" : "s"} to categorize on your accounts.</div>`));
  }

  sections.push(`<tr><td style="padding:6px 8px 0;"><a href="${esc(siteUrl)}/finance" style="display:inline-block;background:${C.accent};color:#0A0A0B;font-size:14px;font-weight:600;text-decoration:none;padding:11px 18px;border-radius:10px;">Open Zitting HQ →</a></td></tr>`);

  const text = [
    `Hi ${d.name} — your spending recap (${d.periodLabel})`,
    `You spent ${usd(d.totalSpent)} across ${d.txnCount} transactions.`,
    d.allowance ? `Allowance: ${usd(d.allowance.spent)} of ${usd(d.allowance.limit)} (${usd(Math.max(0, d.allowance.left))} left)` : "",
    "Categories: " + d.topCategories.map((c) => `${c.name} ${usd(c.amount)}`).join(", "),
    d.toCategorizeCount > 0 ? `${d.toCategorizeCount} transactions to categorize.` : "",
    `${siteUrl}/finance`,
  ].filter(Boolean).join("\n");

  return { subject, html: shell(sections.join(""), `You spent ${usd(d.totalSpent)} · ${d.periodLabel}`), text };
}
