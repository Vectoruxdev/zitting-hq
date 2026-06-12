/**
 * Pure account-type + balance-sign helpers. Kept dependency-free (no Plaid SDK,
 * no db) so it's trivially unit-testable and importable anywhere.
 */

/**
 * Map a Plaid account type/subtype to our 3 buckets (checking | savings |
 * credit). Credit cards and loans are debt; savings/CD/money-market/HSA and
 * investment accounts are treated as savings-side assets; everyday spending
 * accounts are checking. We don't have a dedicated investment bucket, so
 * investments land in savings (an asset) rather than checking.
 */
export function mapAccountType(type: string, subtype: string | null | undefined): string {
  const sub = (subtype || "").toLowerCase();
  if (type === "credit" || type === "loan") return "credit";
  if (type === "investment" || type === "brokerage") return "savings";
  if (type === "depository") {
    const savingsLike = ["savings", "cd", "money market", "hsa", "prepaid"];
    return savingsLike.includes(sub) ? "savings" : "checking";
  }
  return "checking";
}

/**
 * The signed balance we store for an account. Plaid reports credit-card and
 * loan balances as a POSITIVE "amount owed"; we store debt as NEGATIVE so net
 * worth subtracts it and signs are consistent across every card/loan.
 * Depository (checking/savings) balances pass through unchanged.
 */
export function signedBankBalance(
  plaidType: string,
  plaidSubtype: string | null | undefined,
  current: number
): number {
  return mapAccountType(plaidType, plaidSubtype) === "credit" ? -Math.abs(current) : current;
}
