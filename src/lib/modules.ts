/**
 * Family HQ module registry.
 *
 * Family HQ is a hub for the Zitting household. Each "module" is a top-level
 * area of the app. Finance is the first one being built out; the rest are
 * placeholders that describe where the app is headed.
 */

export type ModuleStatus = "active" | "planned";

export interface HqModule {
  /** URL slug, e.g. "finance" -> /finance */
  slug: string;
  name: string;
  /** One-line description shown on cards. */
  description: string;
  /** Emoji used as a lightweight icon until a real icon set is added. */
  icon: string;
  status: ModuleStatus;
}

export const MODULES: HqModule[] = [
  {
    slug: "finance",
    name: "Finance",
    description: "Accounts, spending, budgets, and where the money goes.",
    icon: "💰",
    status: "active",
  },
  {
    slug: "calendar",
    name: "Calendar",
    description: "Shared family schedule and upcoming events.",
    icon: "📅",
    status: "planned",
  },
  {
    slug: "tasks",
    name: "Tasks",
    description: "Chores, to-dos, and who owns what.",
    icon: "✅",
    status: "planned",
  },
  {
    slug: "meals",
    name: "Meals",
    description: "Meal planning and the running grocery list.",
    icon: "🍽️",
    status: "planned",
  },
];

export const ACTIVE_MODULES = MODULES.filter((m) => m.status === "active");

export function getModule(slug: string): HqModule | undefined {
  return MODULES.find((m) => m.slug === slug);
}
