/**
 * Notification event catalog for members (in-app / push / email per event).
 * Client-safe: no database imports — the profile page renders this list.
 */
export interface NotificationEvent { key: string; label: string; body: string; module: string; /** Off until the person switches it on. */ defaultOff?: boolean }

export const MEMBER_NOTIFICATION_EVENTS: NotificationEvent[] = [
  { key: "new_transactions", label: "New purchases to review", body: "When a purchase on your accounts needs a category or a receipt.", module: "finance" },
  { key: "large_charges", label: "Large charges", body: "A charge well above the usual on your accounts.", module: "finance" },
  { key: "member_nudges", label: "Reminders", body: "Gentle nudges when a review has been waiting a while.", module: "finance" },
  { key: "dinner_swap", label: "Dinner-night swaps", body: "Someone asks to trade a night, or answers your request.", module: "meals" },
  { key: "appointment_reminder", label: "Appointment reminders", body: "Before appointments you're taking someone to.", module: "calendar" },
  { key: "shared_with_you", label: "Shared with you", body: "A photo, quote, goal or trip was shared with you.", module: "family" },
  { key: "grocery_request", label: "Grocery requests", body: "Someone asked you to grab something.", module: "groceries" },
  { key: "goal_completed", label: "Goals reached", body: "A family or personal goal is finished.", module: "goals" },
  { key: "cleaning_today", label: "Cleaning: morning list", body: "A morning note with what's on your list today, and the kids' lists.", module: "chores" },
  { key: "cleaning_assigned", label: "Cleaning: handed to you", body: "Someone hands you a job for this week or this time.", module: "chores" },
  { key: "chore_check", label: "Cleaning: kids' work to check", body: "A kid finished a task that needs a grown-up's okay.", module: "chores" },
  { key: "cleaning_evening", label: "Cleaning: evening nudge", body: "At 6pm, what's still open on your list. Off unless you want it.", module: "chores", defaultOff: true },
];

export interface MemberPref { event: string; inApp: boolean; push: boolean; email: boolean }
