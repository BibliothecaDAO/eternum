/**
 * Ysolde's first-session script (lore draft approved 25 Sep 2026). Each step names the game state it answers; the guide
 * shows the first step not yet seen whose state holds, so a reload lands on the same line and a player who is ahead
 * never waits on an old one. Steps that read facts the d batch brings (the first pick, clear, chest and research, and
 * the later firsts) join when those facts land.
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
    id: "a-site",
    line: "A camp. The count you see is exactly what the fight will cost. No luck in it. Decide if the prize is worth those troops.",
    place: "camp",
    when: (facts) => facts.camp !== null,
  },
  {
    id: "come-home",
    mood: "pleased",
    line: "Take it home. Labor raises buildings.",
    place: "realm",
    when: (facts) => facts.castleAffordable && facts.onMap,
  },
  {
    id: "rest",
    mood: "pleased",
    line: "They are tired and the fog is patient. Come back when the bars fill. Tomorrow it is all new land.",
    when: (facts) => facts.armies > 0 && facts.armiesTired,
  },
];

/** Whether "Show me" has somewhere to take the player: the realm only from the expedition map. */
export const canShowPlace = (place: GuidePlace | undefined, facts: GuideFacts): place is GuidePlace =>
  place === "realm" ? facts.onMap : place !== undefined;

/** The line to show now: the first step not yet seen whose state holds; none once the script is done or skipped. */
export const nextGuideStep = (facts: GuideFacts, seen: ReadonlySet<string>): GuideStep | null =>
  GUIDE_STEPS.find((step) => !seen.has(step.id) && step.when(facts)) ?? null;
