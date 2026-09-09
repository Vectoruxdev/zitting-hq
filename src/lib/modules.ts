/**
 * Zitting HQ module registry — the single navigation data list.
 *
 * Every surface reads this: the phone tab bar (first four `primary`), the
 * tablet rail, the desktop sidebar (grouped by `group`), the "More" sheet, and
 * the Home launcher. Adding a module is one entry here plus a route.
 * Icons are Lucide names (see src/ui/core/Icon.tsx); no emoji anywhere.
 */
import type { Tint } from "@/ui";

export type ModuleStatus = "active" | "planned";
export type ModuleGroup = "Family" | "Money" | "Home";
export type Role = "owner" | "partner" | "member";

export interface HqModule {
  /** Stable key, also the URL slug (except home → "/" and finance → "/finance"). */
  slug: string;
  name: string;
  /** Short label for the tablet rail. */
  short?: string;
  /** One-line description shown on launcher cards and the login roadmap. */
  description: string;
  /** Lucide icon name. */
  icon: string;
  tint: Tint;
  group: ModuleGroup;
  status: ModuleStatus;
  /** In the phone tab bar (first four in list order). */
  primary?: boolean;
  /** Only these roles see it (default: everyone). */
  roles?: Role[];
  href: string;
}

export const MODULES: HqModule[] = [
  { slug: "home", name: "Home", description: "Today, the family, and what needs you.", icon: "house", tint: "coral", group: "Family", status: "active", primary: true, href: "/" },
  { slug: "photos", name: "Photos", description: "The family library — moments, albums, people.", icon: "image", tint: "rose", group: "Family", status: "active", primary: true, href: "/photos" },
  { slug: "meals", name: "Meals", description: "Whose night it is, what's for dinner, and the recipe box.", icon: "utensils", tint: "butter", group: "Family", status: "active", primary: true, href: "/meals" },
  { slug: "groceries", name: "Groceries", short: "List", description: "The shared list, plus the pantry and what's running low.", icon: "shopping-cart", tint: "mint", group: "Family", status: "active", href: "/groceries" },
  { slug: "calendar", name: "Calendar", short: "Cal", description: "The family schedule in one place.", icon: "calendar", tint: "sky", group: "Family", status: "active", href: "/calendar" },
  { slug: "appointments", name: "Appointments", short: "Appts", description: "Doctor, dentist, school — who it's for and who's driving.", icon: "stethoscope", tint: "lilac", group: "Family", status: "active", href: "/appointments" },
  { slug: "quotes", name: "Quotes", description: "The funny and tender things people say.", icon: "quote", tint: "rose", group: "Family", status: "active", href: "/quotes" },
  { slug: "goals", name: "Goals", description: "Family and personal goals, with progress.", icon: "target", tint: "mint", group: "Family", status: "active", href: "/goals" },
  { slug: "trips", name: "Trips", description: "Itineraries, documents, packing lists.", icon: "plane", tint: "sky", group: "Family", status: "active", href: "/trips" },
  { slug: "chores", name: "Chores", description: "Per-kid checklists and the weekly chart.", icon: "square-check", tint: "butter", group: "Family", status: "active", href: "/chores" },
  { slug: "finance", name: "Finance", description: "Accounts, spending, budgets, and where the money goes.", icon: "wallet", tint: "sky", group: "Money", status: "active", primary: true, href: "/finance" },
  { slug: "people", name: "People", description: "Who's in the family and what each person can see.", icon: "users", tint: "lilac", group: "Home", status: "active", roles: ["owner"], href: "/people" },
  { slug: "nest", name: "Cameras", description: "Nest cameras trigger the Govee lights — person, motion, doorbell.", icon: "video", tint: "lilac", group: "Home", status: "active", roles: ["owner"], href: "/nest" },
];

export const ACTIVE_MODULES = MODULES.filter((m) => m.status === "active");

export function getModule(slug: string): HqModule | undefined {
  return MODULES.find((m) => m.slug === slug);
}

/** Modules a given role may see, with the finance label per role. */
export function modulesFor(role: Role): HqModule[] {
  return MODULES.filter((m) => !m.roles || m.roles.includes(role)).map((m) =>
    m.slug === "finance" && role === "member" ? { ...m, name: "Spendable", icon: "hand-coins" } : m
  );
}

/** Module key for a pathname ("/" → home, "/finance/…" → finance). */
export function moduleForPath(pathname: string): string {
  if (pathname === "/") return "home";
  const seg = pathname.split("/")[1] || "";
  return MODULES.some((m) => m.slug === seg) ? seg : "home";
}
