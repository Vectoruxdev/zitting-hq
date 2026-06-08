/**
 * Default category taxonomy + family members.
 *
 * This is the ONLY content seeded into a fresh database now that demo
 * transactions/accounts are gone. Shared by `seed.ts` and the SQL generator.
 * Colors reuse the design-system CSS vars so the donut/Tag render correctly.
 */

export interface SeedGroup {
  id: string;
  name: string;
  sortOrder: number;
}
export interface SeedCategory {
  id: string;
  name: string;
  groupId: string;
  color: string;
  icon?: string;
  kind: "income" | "expense" | "transfer";
  excludeFromBudget?: boolean;
  sortOrder: number;
}

export const DEFAULT_GROUPS: SeedGroup[] = [
  { id: "income", name: "Income", sortOrder: 0 },
  { id: "essentials", name: "Essentials", sortOrder: 1 },
  { id: "lifestyle", name: "Lifestyle", sortOrder: 2 },
  { id: "transfers", name: "Transfers", sortOrder: 3 },
  { id: "other", name: "Other", sortOrder: 4 },
];

export const DEFAULT_CATEGORIES: SeedCategory[] = [
  // Income
  { id: "paycheck", name: "Paycheck", groupId: "income", color: "var(--green-500)", icon: "trendingUp", kind: "income", sortOrder: 0 },
  { id: "other-income", name: "Other income", groupId: "income", color: "var(--green-400)", icon: "dollar", kind: "income", sortOrder: 1 },
  // Essentials
  { id: "housing", name: "Housing", groupId: "essentials", color: "var(--green-500)", icon: "wallet", kind: "expense", sortOrder: 0 },
  { id: "utilities", name: "Utilities", groupId: "essentials", color: "var(--gray-500)", icon: "repeat", kind: "expense", sortOrder: 1 },
  { id: "groceries", name: "Groceries", groupId: "essentials", color: "var(--indigo-500)", icon: "list", kind: "expense", sortOrder: 2 },
  { id: "insurance", name: "Insurance", groupId: "essentials", color: "var(--indigo-400)", icon: "target", kind: "expense", sortOrder: 3 },
  { id: "transportation", name: "Transportation", groupId: "essentials", color: "var(--gray-500)", icon: "transfers", kind: "expense", sortOrder: 4 },
  // Lifestyle
  { id: "dining", name: "Dining", groupId: "lifestyle", color: "var(--amber-500)", icon: "list", kind: "expense", sortOrder: 0 },
  { id: "shopping", name: "Shopping", groupId: "lifestyle", color: "var(--green-600)", icon: "receipt", kind: "expense", sortOrder: 1 },
  { id: "entertainment", name: "Entertainment", groupId: "lifestyle", color: "var(--indigo-500)", icon: "sparkles", kind: "expense", sortOrder: 2 },
  { id: "subscriptions", name: "Subscriptions", groupId: "lifestyle", color: "var(--amber-500)", icon: "repeat", kind: "expense", sortOrder: 3 },
  { id: "health", name: "Health", groupId: "lifestyle", color: "var(--green-600)", icon: "target", kind: "expense", sortOrder: 4 },
  { id: "kids", name: "Kids", groupId: "lifestyle", color: "var(--green-600)", icon: "sparkles", kind: "expense", sortOrder: 5 },
  // Transfers
  { id: "transfer", name: "Transfer", groupId: "transfers", color: "var(--gray-500)", icon: "transfers", kind: "transfer", excludeFromBudget: true, sortOrder: 0 },
  { id: "tithing", name: "Tithing", groupId: "transfers", color: "var(--green-500)", icon: "dollar", kind: "transfer", excludeFromBudget: true, sortOrder: 1 },
  { id: "savings-contrib", name: "Savings", groupId: "transfers", color: "var(--indigo-500)", icon: "target", kind: "transfer", excludeFromBudget: true, sortOrder: 2 },
  // Other
  { id: "uncategorized", name: "Uncategorized", groupId: "other", color: "var(--gray-500)", icon: "list", kind: "expense", sortOrder: 0 },
];

export const DEFAULT_MEMBERS = [
  { id: "jared", name: "Jared", role: "owner" },
  { id: "sarah", name: "Sarah", role: "member" },
  { id: "rebecca", name: "Rebecca", role: "member" },
  { id: "household", name: "Household", role: "member" },
];

export const UNCATEGORIZED_ID = "uncategorized";
