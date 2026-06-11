/* Celebration lines for the "every transaction reviewed" moment, written by
   the household for the household. Each member has a celebration_style
   (spicy | clean | off) and only ever sees a line picked from THEIR style's
   pools, on their own login, when their own queue hits zero. */

export const CELEBRATION_POOLS = {
  spicy: [
    "All reviewed. Clothing is now optional for the rest of the evening.",
    "Queue cleared. Bedroom's next. Don't keep me waiting.",
    "You finished the whole queue... tonight I'll make sure you're not the only thing that gets finished.",
    "God, watching you handle money like that... I'm taking the rest off your hands tonight. Starting with the dress.",
    "Every transaction confirmed. Now confirm you're not wearing anything under that by the time I get home.",
    "Done already? Good girl. Now come get your reward. 😈",
    "Budget balanced. Now let's make the bed frame work for ITS money.",
    "That was disgustingly responsible. Meet me upstairs so I can be irresponsible with you.",
    "All caught up — and tonight, so help me, you won't be able to walk to the review queue.",
    "You + zero unreviewed transactions = me, on my knees, grateful. And not just grateful.",
    "Queue's empty. Tonight you won't be.",
    "Smart with money. Filthy everywhere else. That's my wife. Get over here.",
    "Transaction history: spotless. Tonight's history: about to get written. Loudly.",
    "Reviewed everything? Then tonight you get *thoroughly* reviewed. Five stars guaranteed.",
    "All sorted. Even our money is impressed, and it's seen you naked.",
    "Zero left. Your prize is a husband who saw this notification and got ideas.",
  ],
  funny: [
    "Done! The budget has been dominated. It said thank you.",
    "Queue annihilated. Somewhere a Mint app just uninstalled itself in shame.",
    "You did ALL of them?? Marry me. Oh wait. EXCELLENT decision, past me.",
    "All reviewed! You may now overspend at Target with a clear conscience.",
    "Finished! Quick — buy something so you have a queue again. The economy needs you.",
    "The queue is dead. You killed it. The funeral is at Olive Garden, your treat.",
    "All done! Somewhere an accountant just got their wings.",
    "Queue destroyed. Visa is scared. Mastercard is in therapy.",
    "All reviewed. The IRS could never.",
    "Every transaction sorted. Historians will call this The Great Categorizing.",
  ],
  sweet: [
    "All caught up. This family runs because of you.",
    "Done for the month. I notice everything you do for us — including this.",
    "Every box checked. Luckiest part of my day is still just being yours.",
    "Queue's empty, and I'm still full of reasons I married you.",
    "Finished again — you keep this family steady and you make it look effortless.",
    "All done. Ten years from now I'll remember it was always you doing the little things.",
  ],
};

/* Tone mix per style. spicy leans flirty; clean is what future kid logins
   would get; off = confetti with a plain "All caught up!". */
const MIX = {
  spicy: [
    ["spicy", 0.5],
    ["funny", 0.3],
    ["sweet", 0.2],
  ],
  clean: [
    ["funny", 0.6],
    ["sweet", 0.4],
  ],
};

/** Pick a celebration line for a member's style. Always returns something
 *  renderable: {text, tone}. Unknown styles fall back to clean. */
export function pickCelebration(style, rand = Math.random) {
  if (style === "off") return { text: "All caught up!", tone: "plain" };
  const mix = MIX[style] || MIX.clean;
  let roll = rand();
  let tone = mix[mix.length - 1][0];
  for (const [t, w] of mix) {
    if (roll < w) { tone = t; break; }
    roll -= w;
  }
  const pool = CELEBRATION_POOLS[tone];
  return { text: pool[Math.floor(rand() * pool.length) % pool.length], tone };
}

export const CELEBRATION_EMOJI = { spicy: "😈", funny: "🎉", sweet: "💚", plain: "🎉" };
