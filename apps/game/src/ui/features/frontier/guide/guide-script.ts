/**
 * The Aspect of Skill's script (frontier-narrative-2026-10/script.html, beat for beat). Each step names the game state
 * it answers; a slot shows the first step for its place not yet seen whose state holds, so a reload lands on the same
 * line and a player who is ahead never waits on an old one. A fact the client cannot read yet is undefined, and a step
 * never speaks on one.
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
  /** An army's XP buys a tier of an attribute now. */
  armyTierAffordable: boolean;
  /** A guarded camp of today's region on the board, where "Show me" frames it; null when there is none. */
  camp: { x: number; y: number } | null;
  /** A site of the expedition has been cleared. */
  siteCleared: boolean;
  /** Stragglers are in view (the generated site taxonomy). */
  stragglers: boolean | undefined;
  /** The realm can pay for its next castle level. */
  castleAffordable: boolean;
  /** The player is looking at the expedition map, not the realm. */
  onMap: boolean;
  /** The building whose first tier the realm can afford (RealmKnowledge, with the contracts' schema); null for none. */
  typeTierAffordable: string | null | undefined;
  /** Every army of today lacks the stamina to explore. */
  armiesTired: boolean;
  /** A ruin stands on the map. */
  ruin: boolean;
  /** The player's first ruin chest has paid (its LORDS, with the contracts' ruin chests). */
  chestPaid: boolean | undefined;
  /** An army of today stands at Ethereal I or further. */
  armyBeyondSpire: boolean;
  /** The selected army's forecast on the open site says it cannot win. */
  losingFight: boolean;
  /** The store a payout or reveal did not fit (the contracts' store limits); null for none. */
  storeFull: string | null | undefined;
  /** The season is over. */
  seasonOver: boolean;
}

/** Where a line speaks: the HUD's foot, inside the open site card, or on the season-over card. */
export type GuideHost = "foot" | "site-card" | "season-over";

/** The Aspect's mark: dim between lines, gold as it speaks, glowing after play, amber on a warning. */
export type GuideMark = "rest" | "speaking" | "pleased" | "warning";

/** A HUD control the line names, which its thread reaches. */
export type GuideTarget = "realm-tab" | "open-slot" | "stores" | "army-xp" | "army-stamina" | "forecast";

/** A place the line names off the HUD, which "Show me" takes the player to. */
export type GuidePlace = "realm" | "deploy" | "camp";

interface GuideStep {
  id: string;
  host?: GuideHost;
  mark: GuideMark;
  line: (facts: GuideFacts) => string;
  target?: GuideTarget;
  place?: GuidePlace;
  when: (facts: GuideFacts) => boolean;
}

const say = (line: string) => () => line;

export const GUIDE_STEPS: readonly GuideStep[] = [
  {
    id: "arrival",
    mark: "speaking",
    line: say("I am the Aspect of Skill, Lord. Your realm stays. Each day, the mist takes the rest."),
    place: "realm",
    when: (facts) => facts.realm,
  },
  {
    id: "build-on-the-mark",
    mark: "speaking",
    line: say("Build barracks on the marked plot. It trains troops twice as fast."),
    place: "realm",
    when: (facts) => facts.realm && !facts.barracks,
  },
  {
    id: "deploy",
    mark: "speaking",
    line: say("One strong army, two scouts. They stay out until the day ends."),
    target: "open-slot",
    place: "deploy",
    when: (facts) => facts.troopsAtHome !== undefined && facts.troopsAtHome >= 1 && facts.armies === 0,
  },
  {
    id: "first-reveal",
    mark: "pleased",
    line: say("Each new tile sends Essence or labor home. Bigger armies send more."),
    target: "stores",
    when: (facts) => facts.armyActed,
  },
  {
    id: "first-army-tier",
    mark: "speaking",
    line: say("Enough XP. Upgrade a tier: Battle for the main army, Scouting for scouts."),
    when: (facts) => facts.armyTierAffordable,
  },
  {
    id: "a-camp",
    mark: "speaking",
    line: say("A camp. Count their troops, then yours. These numbers do not lie."),
    place: "camp",
    when: (facts) => facts.camp !== null,
  },
  {
    id: "first-clear",
    mark: "pleased",
    line: say("Cleared. That is where an army learns."),
    target: "army-xp",
    when: (facts) => facts.siteCleared,
  },
  {
    id: "first-stragglers",
    mark: "speaking",
    line: say("Stragglers. They went too far, long ago. Learn from them."),
    when: (facts) => facts.stragglers === true,
  },
  {
    id: "come-home",
    mark: "pleased",
    line: say("Enough labor. Your castle can grow."),
    target: "realm-tab",
    place: "realm",
    when: (facts) => facts.castleAffordable && facts.onMap,
  },
  {
    id: "first-type-tier",
    mark: "speaking",
    line: (facts) => `Store more, or make more. Each choice holds for every ${facts.typeTierAffordable}.`,
    when: (facts) => typeof facts.typeTierAffordable === "string",
  },
  {
    id: "rest",
    mark: "rest",
    line: say("Out of stamina. It comes back while you are away."),
    target: "army-stamina",
    when: (facts) => facts.armies > 0 && facts.armiesTired,
  },
  // After the first session, the guide speaks only on firsts.
  {
    id: "first-fallen-site",
    mark: "speaking",
    line: say("This ruin is from the old war. Its beast guards a chest."),
    when: (facts) => facts.ruin,
  },
  {
    id: "first-chest",
    mark: "pleased",
    line: say("Only one a day. The next one comes tomorrow."),
    when: (facts) => facts.chestPaid === true,
  },
  {
    id: "first-ethereal",
    mark: "speaking",
    line: say("Beyond the spire: harder guards, richer ground."),
    when: (facts) => facts.armyBeyondSpire,
  },
  {
    id: "store-full",
    mark: "warning",
    line: (facts) => `Your ${facts.storeFull} store is full. What does not fit is gone.`,
    when: (facts) => typeof facts.storeFull === "string",
  },
  {
    id: "losing-fight",
    host: "site-card",
    mark: "warning",
    line: say("This army cannot win here. It can weaken them for the next one."),
    target: "forecast",
    when: (facts) => facts.losingFight,
  },
  // The season's ending is not a recorded fact yet: the mist lifted stands until Herald names it.
  {
    id: "season-over",
    host: "season-over",
    mark: "pleased",
    line: say("The mist has lifted. For a while, the land remembers."),
    when: (facts) => facts.seasonOver,
  },
];

/** Whether "Show me" has somewhere to take the player: the realm only from the expedition map. */
export const canShowPlace = (place: GuidePlace | undefined, facts: GuideFacts): place is GuidePlace =>
  place === "realm" ? facts.onMap : place !== undefined;

/** The line a host shows now: its first step not yet seen whose state holds; none once its script is seen. */
export const nextGuideStep = (facts: GuideFacts, seen: ReadonlySet<string>, host: GuideHost): GuideStep | null =>
  GUIDE_STEPS.find((step) => (step.host ?? "foot") === host && !seen.has(step.id) && step.when(facts)) ?? null;

/** The guide is on while any line is still to come; off once every line is seen (or turned off from the Menu). */
export const isGuideOn = (seen: ReadonlySet<string>): boolean => GUIDE_STEPS.some((step) => !seen.has(step.id));
