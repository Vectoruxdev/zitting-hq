/**
 * Default category taxonomy + family members.
 *
 * This is the ONLY content seeded into a fresh database now that demo
 * transactions/accounts are gone. Shared by `seed.ts` and the SQL generator.
 * Colors reuse the design-system CSS vars so the donut/Tag render correctly.
 *
 * Taxonomy = the Zitting household chart of accounts (parent group → child
 * categories). Standalone items are modeled as a one-category group so they
 * show at the top level and are directly budgetable. Two system categories are
 * always present regardless of the chart: `transfer` (internal money movement,
 * referenced by the transfer engine) and `uncategorized` (the safe fallback).
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
  { id: "automobile", name: "Automobile", sortOrder: 1 },
  { id: "babysitting", name: "Babysitting/Day Care", sortOrder: 2 },
  { id: "charitable", name: "Charitable Contributions", sortOrder: 3 },
  { id: "groceries-household", name: "Groceries & Household", sortOrder: 4 },
  { id: "home-yard-improvements", name: "Home/Yard Improvements", sortOrder: 5 },
  { id: "insurance", name: "Insurance", sortOrder: 6 },
  { id: "interest-fees", name: "Interest, Fees & Finance Charges", sortOrder: 7 },
  { id: "maintenance-home", name: "Maintenance & Repairs (Home/Yard)", sortOrder: 8 },
  { id: "miscellaneous", name: "Miscellaneous", sortOrder: 9 },
  { id: "taxes", name: "Taxes", sortOrder: 10 },
  { id: "travel-entertainment", name: "Travel & Entertainment", sortOrder: 11 },
  { id: "rent", name: "Rent", sortOrder: 12 },
  { id: "small-tools", name: "Small Tools/Yard Equipment", sortOrder: 13 },
  { id: "utilities", name: "Utilities", sortOrder: 14 },
  { id: "transfers", name: "Transfers", sortOrder: 15 },
  { id: "other", name: "Other", sortOrder: 16 },
];

const PALETTE = [
  "var(--green-500)",
  "var(--indigo-500)",
  "var(--amber-500)",
  "var(--green-600)",
  "var(--indigo-400)",
  "var(--green-400)",
  "var(--gray-500)",
];

// Compact builder: child categories listed per group; colors auto-cycle.
type Child = [id: string, name: string, icon?: string];
function group(
  groupId: string,
  kind: SeedCategory["kind"],
  defaultIcon: string,
  children: Child[],
  opts?: { excludeFromBudget?: boolean }
): SeedCategory[] {
  return children.map(([id, name, icon], i) => ({
    id,
    name,
    groupId,
    color: PALETTE[colorIdx++ % PALETTE.length],
    icon: icon ?? defaultIcon,
    kind,
    excludeFromBudget: opts?.excludeFromBudget,
    sortOrder: i,
  }));
}
let colorIdx = 0;

export const DEFAULT_CATEGORIES: SeedCategory[] = [
  ...group("income", "income", "trendingUp", [
    ["income-paycheck", "Paycheck", "trendingUp"],
    ["income-self-employment", "Self-Employment", "dollar"],
    ["income-other", "Other income", "dollar"],
  ]),
  ...group("automobile", "expense", "transfers", [
    ["auto-fuel", "Fuel"],
    ["auto-maintenance", "Maintenance & Repairs"],
    ["auto-insurance", "Insurance"],
    ["auto-other", "Other"],
  ]),
  ...group("babysitting", "expense", "users", [["babysitting", "Babysitting/Day Care"]]),
  ...group("charitable", "expense", "dollar", [
    ["charitable-tithing", "Tithing"],
    ["charitable-united-order", "United Order"],
    ["charitable-priesthood", "Addl. Priesthood Contr. (Clinic, AAT, Lights)"],
    ["charitable-other", "Other"],
  ]),
  ...group("groceries-household", "expense", "list", [
    ["groc-basic-american", "Basic American Supply"],
    ["groc-bees", "Bee's Marketplace"],
    ["groc-sunset-farms", "Sunset Farms"],
    ["groc-costco-walmart", "Costco/Walmart"],
    ["groc-health-food", "Health Food Stores"],
    ["groc-other", "Other"],
  ]),
  ...group("home-yard-improvements", "expense", "wallet", [["home-yard-improvements", "Home/Yard Improvements"]]),
  ...group("insurance", "expense", "target", [
    ["ins-health", "Health"],
    ["ins-home", "Home"],
    ["ins-life", "Life"],
    ["ins-other", "Other (Licenses)"],
  ]),
  ...group("interest-fees", "expense", "creditCard", [["interest-fees", "Interest, Fees & Finance Charges"]]),
  ...group("maintenance-home", "expense", "settings", [
    ["maint-basic-american", "Basic American Supply"],
    ["maint-other", "Other"],
  ]),
  ...group("miscellaneous", "expense", "grid", [
    ["misc-children-activities", "Children's Activities"],
    ["misc-clothing", "Clothing"],
    ["misc-community", "Community Functions/Activities"],
    ["misc-dental", "Dental"],
    ["misc-education", "Education (Tuition, Books, etc.)"],
    ["misc-medical", "Medical"],
    ["misc-other", "Other (Gifts, Personal, etc.)"],
  ]),
  ...group("taxes", "expense", "receipt", [
    ["tax-income", "Income"],
    ["tax-property", "Property"],
    ["tax-self-employment", "Self-Employment"],
    ["tax-other", "Other"],
  ]),
  ...group("travel-entertainment", "expense", "sparkles", [
    ["te-entertainment-local", "Entertainment (local)"],
    ["te-travel-outside", "Travel & Entertainment (outside)"],
  ]),
  ...group("rent", "expense", "bank", [["rent", "Rent"]]),
  ...group("small-tools", "expense", "settings", [["small-tools", "Small Tools/Yard Equipment"]]),
  ...group("utilities", "expense", "repeat", [
    ["util-electricity", "Electricity"],
    ["util-gas", "Gas"],
    ["util-phone-internet", "Phone/Internet"],
    ["util-water-sewer-garbage", "Water & Sewer & Garbage"],
  ]),
  // System categories (always present) ------------------------------------
  ...group("transfers", "transfer", "transfers", [["transfer", "Transfer"]], { excludeFromBudget: true }),
  ...group("other", "expense", "list", [["uncategorized", "Uncategorized"]]),
];

export const DEFAULT_MEMBERS = [
  { id: "jared", name: "Jared", role: "owner" },
  { id: "sarah", name: "Sarah", role: "member" },
  { id: "rebecca", name: "Rebecca", role: "member" },
  { id: "household", name: "Household", role: "member" },
];

export const UNCATEGORIZED_ID = "uncategorized";
