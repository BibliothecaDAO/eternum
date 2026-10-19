import { isCoarsePointer } from "@/utils/pointer";

/**
 * The Aspect of Skill's script (frontier-narrative-2026-10/script.html, beat for beat). Each step names the game state
 * it answers; a slot shows the first step for its place not yet seen whose state holds, so a reload lands on the same
 * line and a player who is ahead never waits on an old one. A fact the client does not know yet never makes a line
 * speak.
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
  /** Beasts stand in view. */
  beasts: boolean;
  /** The realm can pay for its next castle level. */
  castleAffordable: boolean;
  /** The player is looking at the expedition map, not the realm. */
  onMap: boolean;
  /** The building whose first tier the realm can afford (Farm or Workshop), by its word; null for none. */
  typeTierAffordable: string | null;
  /** Every army of today lacks the stamina to explore. */
  armiesTired: boolean;
  /** A ruin stands on the map. */
  ruin: boolean;
  /** A ruin has been cleared: its chest has paid. */
  chestPaid: boolean;
  /** An army of today stands at Ethereal I or further. */
  armyBeyondSpire: boolean;
  /** The selected army's forecast on the open site says it cannot win. */
  losingFight: boolean;
  /** The store at its limit, where a payout or reveal no longer fits, by its word; null for none. */
  storeFull: string | null;
  /** The season is over. */
  seasonOver: boolean;
  /** No population is free: the next building that takes any is refused until a Hut stands. */
  populationFull: boolean;
  /** One of the player's armies is selected. */
  armySelected: boolean;
  /** An army of today stands beside a site whose guard still holds. */
  guardInReach: boolean;
  /** An army of today has earned XP. */
  xpEarned: boolean;
  /** The Research page is open. */
  researchOpen: boolean;
  /** Today is in its last hour with an army still out. */
  lastHour: boolean;
  /** The rules a line states in numbers, read from the game's own; null without a realm. */
  rules: GuideRules | null;
}

/** The numbers the guide's lines state, each read from the preset the game runs on, never typed into a line. */
export interface GuideRules {
  /** The population one Hut adds at its type's tier. */
  hutAdds: number;
  /** What an explore, a tile's move at the least and an attack cost in stamina, and what comes back an hour. */
  stamina: { explore: number; move: number; attack: number; anHour: number };
  /** The XP a reveal gives and the XP an attribute's first tier costs; unknown until the rules are served. */
  xp: { reveal: number; firstTier: number } | undefined;
  /** The share of an army's troops Homecoming sends home when the day ends, in percent, at today's lowest tier. */
  homecomingPercent: number;
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
    id: "build-barracks",
    mark: "speaking",
    line: say("Build barracks. Only barracks train new troops for your armies."),
    place: "realm",
    when: (facts) => facts.realm && !facts.barracks,
  },
  {
    id: "population-full",
    mark: "warning",
    line: ({ rules }) => `No population left. Every building takes some. A Hut adds ${rules?.hutAdds ?? "more"}.`,
    place: "realm",
    when: (facts) => facts.populationFull,
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
    id: "first-army-selected",
    mark: "speaking",
    line: ({ rules }) =>
      rules
        ? `Explore costs ${rules.stamina.explore} stamina, a move from ${rules.stamina.move} a tile, an attack ${rules.stamina.attack}. ${rules.stamina.anHour} come back each hour.`
        : "Exploring, moving and attacking each cost stamina. It comes back by the hour.",
    target: "army-stamina",
    when: (facts) => facts.armySelected && facts.rules !== null,
  },
  {
    id: "fast-order",
    mark: "speaking",
    line: () =>
      isCoarsePointer()
        ? "Tap a tile to see an order first. Hold the tile to send it at once."
        : "Click a tile to see an order first. Right-click sends it at once.",
    when: (facts) => facts.armySelected,
  },
  {
    id: "first-reveal",
    mark: "pleased",
    line: say("Each new tile sends Essence or labor home. Bigger armies send more."),
    target: "stores",
    when: (facts) => facts.armyActed,
  },
  {
    id: "first-xp",
    mark: "speaking",
    line: ({ rules }) =>
      rules?.xp
        ? `Each new tile gives ${rules.xp.reveal} XP. ${rules.xp.firstTier} XP buy an attribute's first tier.`
        : "Each new tile gives XP. XP buys an army's attribute tiers.",
    target: "army-xp",
    when: (facts) => facts.xpEarned && facts.rules?.xp !== undefined,
  },
  {
    id: "first-guard-in-reach",
    mark: "speaking",
    line: say("A guard stands beside your army. Tap it to see the fight before you choose."),
    when: (facts) => facts.guardInReach,
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
    id: "first-beasts",
    mark: "speaking",
    line: say("Beasts. Easier prey than the guards at camps, rifts and ruins."),
    when: (facts) => facts.beasts,
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
    id: "first-research",
    mark: "speaking",
    line: say(
      "Research spends Essence. A tier lifts every building of its type. A choice of sides holds for the season.",
    ),
    when: (facts) => facts.researchOpen,
  },
  {
    id: "first-type-tier",
    mark: "speaking",
    line: (facts) =>
      `Store more, or make more. Each choice holds for every ${facts.typeTierAffordable ?? "building of its type"}.`,
    when: (facts) => typeof facts.typeTierAffordable === "string",
  },
  {
    id: "last-hour",
    mark: "warning",
    line: ({ rules }) =>
      rules
        ? `The day ends within the hour. Armies still out end with it. Homecoming sends ${rules.homecomingPercent}% of their troops home.`
        : "The day ends within the hour. Armies still out end with it.",
    when: (facts) => facts.lastHour && facts.rules !== null,
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
    when: (facts) => facts.chestPaid,
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
    line: (facts) =>
      facts.storeFull
        ? `Your ${facts.storeFull} store is full. What does not fit is gone.`
        : "A store is full. What does not fit is gone.",
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

/** The mark the Menu leaves among the seen lines when the player turns the guide off; no line carries it. */
export const GUIDE_OFF = "guide-off";

/** The guide speaks until the player turns it off from the Menu; on again, it goes on from where it was. */
export const isGuideOn = (seen: ReadonlySet<string>): boolean => !seen.has(GUIDE_OFF);

/** The line a host shows now: its first step not yet seen whose state holds; none while the guide is off. */
export const nextGuideStep = (facts: GuideFacts, seen: ReadonlySet<string>, host: GuideHost): GuideStep | null =>
  isGuideOn(seen)
    ? (GUIDE_STEPS.find((step) => (step.host ?? "foot") === host && !seen.has(step.id) && step.when(facts)) ?? null)
    : null;

/** Every line the player has seen so far, in the script's order, as it reads now: the Menu's Guide lists them. */
export const seenGuideLines = (facts: GuideFacts, seen: ReadonlySet<string>): { id: string; line: string }[] =>
  GUIDE_STEPS.filter((step) => seen.has(step.id)).map((step) => ({ id: step.id, line: step.line(facts) }));
