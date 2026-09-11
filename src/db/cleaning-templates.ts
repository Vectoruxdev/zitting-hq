/**
 * Starter lists. Rhythms that need an anchor ("every N weeks") take today's
 * date when the template is applied; rotations take the adults in the family.
 */
import type { Rhythm } from "@/lib/cleaning/schedule";
import type { ListTint } from "./cleaning";

export interface TemplateTask { title: string; icon: string; rhythm: Rhythm | { type: "every_weeks"; n: number; weekday: number }; who?: "adults" | "kids" | "anyone"; timeOfDay?: "morning" | "afternoon" | "evening" | "any"; points?: number }
export interface Template { key: string; name: string; icon: string; tint: ListTint; body: string; tasks: TemplateTask[] }

const sat = (n = 1): TemplateTask["rhythm"] => ({ type: "every_weeks", n, weekday: 6 });

export const CLEANING_TEMPLATES: Template[] = [
  {
    key: "daily", name: "Daily basics", icon: "sun", tint: "butter",
    body: "The things that keep the house running every day. Whoever is home ticks them off.",
    tasks: [
      { title: "Make the beds", icon: "bed", rhythm: { type: "daily" }, timeOfDay: "morning" },
      { title: "Dishes and counters", icon: "utensils", rhythm: { type: "daily" }, timeOfDay: "evening" },
      { title: "Sweep the kitchen floor", icon: "sparkles", rhythm: { type: "daily" }, timeOfDay: "evening" },
      { title: "Tidy the living room", icon: "house", rhythm: { type: "daily" }, timeOfDay: "evening" },
      { title: "Wipe the bathroom sink", icon: "droplets", rhythm: { type: "daily" } },
      { title: "One load of laundry", icon: "wind", rhythm: { type: "weekly", weekdays: [1, 2, 3, 4, 5] }, timeOfDay: "morning" },
      { title: "Take the trash out", icon: "trash-2", rhythm: { type: "weekly", weekdays: [1, 4] }, timeOfDay: "evening" },
    ],
  },
  {
    key: "saturday", name: "Saturday deep clean", icon: "sparkles", tint: "mint",
    body: "The bigger jobs, done together on Saturday. Open all week so Friday counts too.",
    tasks: [
      { title: "Vacuum the whole house", icon: "sparkles", rhythm: sat() },
      { title: "Mop the floors", icon: "droplets", rhythm: sat(), who: "adults" },
      { title: "Bathrooms: toilets, showers, tubs", icon: "droplets", rhythm: sat(), who: "adults" },
      { title: "Dust shelves and surfaces", icon: "wind", rhythm: sat() },
      { title: "Change the bed sheets", icon: "bed", rhythm: sat() },
      { title: "Mirrors and glass", icon: "sun", rhythm: sat() },
      { title: "Wipe down appliances", icon: "refrigerator", rhythm: sat() },
      { title: "Kids' rooms: floor clear, toys away", icon: "baby", rhythm: sat(), who: "kids", points: 2 },
    ],
  },
  {
    key: "sometimes", name: "Every so often", icon: "calendar-days", tint: "sky",
    body: "Fortnightly, monthly and seasonal jobs that are easy to forget.",
    tasks: [
      { title: "AC and furnace filters", icon: "snowflake", rhythm: sat(2), who: "adults" },
      { title: "Vacuum under the furniture", icon: "sparkles", rhythm: sat(2) },
      { title: "Clean out the fridge", icon: "refrigerator", rhythm: { type: "monthly", day: 1 } },
      { title: "Wash the windows", icon: "sun", rhythm: { type: "monthly", day: 15 } },
      { title: "Clean the oven and microwave", icon: "cooking-pot", rhythm: { type: "monthly", day: "last" } },
      { title: "Baseboards and door frames", icon: "house", rhythm: { type: "monthly", day: 20 } },
      { title: "Washer and dryer: drum, lint, seal", icon: "wind", rhythm: { type: "monthly", day: 10 } },
      { title: "Flip or rotate the mattresses", icon: "bed", rhythm: sat(12) },
    ],
  },
];
