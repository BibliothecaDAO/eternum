/**
 * Ysolde's first-session script (lore draft approved 25 Sep 2026). Each step names the game state it answers; the guide
 * shows the first step not yet seen whose state holds, so a reload lands on the same line and a player who is ahead
 * never waits on an old one.
 */
export interface GuideFacts {
  /** The player's Frontier realm exists. */
  realm: boolean;
  /** The realm has a barracks. */
  barracks: boolean;
  /** Whole troops waiting at home; undefined while unknown. */
  troopsAtHome: number | undefined;
  /** Today's armies. */
  armies: number;
  /** An army of today has spent stamina: it has explored or moved. */
  armyActed: boolean;
  /** A guarded camp of today's region on the board, where "Show me" frames it; null when there is none. */
  camp: { x: number; y: number } | null;
  /** The realm can pay for its next castle level. */
  castleAffordable: boolean;
  /** The player is looking at the expedition map, not the realm. */
  onMap: boolean;
  /** Every army of today lacks the stamina to explore. */
  armiesTired: boolean;
  /** An army of today has an attribute offer waiting. */
  pickWaiting: boolean;
  /** A site of the expedition has been cleared. */
  siteCleared: boolean;
  /** A closed chest waits on a tile. */
  closedChest: boolean;
  /** A fallen realm stands on the map. */
  fallenRealm: boolean;
  /** One of the player's chests paid a relic because the day's LORDS were spent. */
  lordsSpent: boolean;
  /** The realm has learned nothing yet and holds the Essence for its cheapest research. */
  firstResearchAffordable: boolean;
  /** An army of today stands at Ethereal I or deeper. */
  armyBelowSurface: boolean;
}

export type GuidePlace = "realm" | "muster" | "camp";

interface GuideStep {
  id: string;
  line: string;
  /** Ysolde's face for the line: pleased when the player has just made progress. */
  mood?: "pleased";
  /** The place the line names, which "Show me" takes the player to. */
  place?: GuidePlace;
  when: (facts: GuideFacts) => boolean;
}

export const GUIDE_STEPS: readonly GuideStep[] = [
  {
    id: "arrival",
    line: "You made it through the fog, Lord. Good. It forgets everything by midnight, except your realm.",
    when: (facts) => facts.realm,
  },
  {
    id: "build-on-the-mark",
    line: "See the lit plot? The land is kinder there: whatever you build on it does twice the work. Put your Barracks on it. It will feed on your farms.",
    place: "realm",
    when: (facts) => facts.realm && !facts.barracks,
  },
  {
    id: "muster",
    line: "Send one strong army and a couple of scouts. What walks into the fog does not walk back, so send what today needs.",
    place: "muster",
    when: (facts) => facts.troopsAtHome !== undefined && facts.troopsAtHome >= 1 && facts.armies === 0,
  },
  {
    id: "first-reveal",
    mood: "pleased",
    line: "Every tile you uncover sends Essence or labor home. The stronger the army, the more it sends. You saw the number before you went.",
    when: (facts) => facts.armyActed,
  },
  {
    id: "first-pick",
    line: "It has learned something. Choose one of three. Scouts like Scouting; your main army likes Battle.",
    when: (facts) => facts.pickWaiting,
  },
  {
    id: "a-site",
    line: "A camp. The count you see is exactly what the fight will cost. No luck in it. Decide if the prize is worth those troops.",
    place: "camp",
    when: (facts) => facts.camp !== null,
  },
  {
    id: "first-clear",
    mood: "pleased",
    line: "Paid on the spot. Labor from camps, Essence from rifts. Bigger guards, bigger purse.",
    when: (facts) => facts.siteCleared,
  },
  {
    id: "closed-chest",
    line: "Chests wait on their tile until midnight. The army that opens it keeps what is inside.",
    when: (facts) => facts.closedChest,
  },
  {
    id: "come-home",
    mood: "pleased",
    line: "Take it home. Labor raises buildings.",
    place: "realm",
    when: (facts) => facts.castleAffordable && facts.onMap,
  },
  {
    id: "first-research",
    line: "Essence buys knowing. Learn Farm II first: your barracks eats more than one farm grows.",
    when: (facts) => facts.firstResearchAffordable,
  },
  {
    id: "rest",
    mood: "pleased",
    line: "They are tired and the fog is patient. Come back when the bars fill. Tomorrow it is all new land.",
    when: (facts) => facts.armies > 0 && facts.armiesTired,
  },
  // After the first session, the guide speaks only on firsts.
  {
    id: "first-fallen-realm",
    line: "A realm the Mist took. Something lives in it now. There is a chest inside, if you are strong enough to ask for it.",
    when: (facts) => facts.fallenRealm,
  },
  {
    id: "first-ethereal-depth",
    line: "Below the surface the Mist is older. Bigger guards, better chests. Your reveals pay a little more.",
    when: (facts) => facts.armyBelowSurface,
  },
  {
    id: "first-lords-spent",
    line: "The coin is gone for today; the Mist gave you a relic instead. More coin at midnight.",
    when: (facts) => facts.lordsSpent,
  },
];

/** Whether "Show me" has somewhere to take the player: the realm only from the expedition map. */
export const canShowPlace = (place: GuidePlace | undefined, facts: GuideFacts): place is GuidePlace =>
  place === "realm" ? facts.onMap : place !== undefined;

/** The line to show now: the first step not yet seen whose state holds; none once the script is done or skipped. */
export const nextGuideStep = (facts: GuideFacts, seen: ReadonlySet<string>): GuideStep | null =>
  GUIDE_STEPS.find((step) => !seen.has(step.id) && step.when(facts)) ?? null;
