/**
 * The client's phrases (the glossary, frontier-narrative-2026-10/glossary.html, ruled final 7 October 2026, and every
 * screen's words), each spelled once. A screen that needs one imports it from here; nothing else spells it. The rules
 * every client and core's story text share (nouns, numbers, times, names, the voice) are @bibliothecadao/types' words.
 */
import { APP_HOST } from "@/config/app-address";
import type { ResolvedGameMode } from "@/config/game-modes/resolved-mode";
import { SHARED_MOMENT_WORDS, type CampaignKey, type SocialProvider } from "@realms-world/identity";
import type { NotificationKind, NotificationLevel } from "@bibliothecadao/notifications";
import type { RuinChest } from "@bibliothecadao/eternum";
import {
  BuildingType,
  XP,
  buildingName,
  formatAmount,
  formatPercent,
  formatExact,
  formatCount,
  formatClockTime,
  formatDuration,
  getRelicInfo,
  relicEffect,
  ResourcesIds,
  formatCharge,
  resourceName,
  formatHeldAgainst,
  structurePlural,
  structureName,
  StructureType,
  tierNumeral as rankNumeral,
  asRanked,
  type RankedWords,
} from "@bibliothecadao/types";

/** One scale for chests, building types and attributes. */
export { TIER_WORDS } from "@bibliothecadao/types";
/** A step on that scale, common (1) to legendary (5). */
export type Tier = 1 | 2 | 3 | 4 | 5;
export type Rank = 0 | Tier;
/** A tier by its numeral, Common I to Legendary V; untrained is 0. */
export const tierNumeral = (tier: Rank): string => (tier === 0 ? "0" : rankNumeral(tier));
/** Words with ranks in them, a skill point's gain, and their plain text: one way to write a rank in a line. */
export { type RankedWords, rankedText, skillPointGain } from "@bibliothecadao/types";

/** Species names shared by Frontier's models, plates and selected-site cards. */
export { BEAST_NAMES } from "@bibliothecadao/types";

export const LEFT = "left";
export const DAY = "Day";
/** A day of the season against its last: "Day 10 of 14". */
export const dayOfSeason = (day: string, lastDay: string) => `${DAY} ${day} of ${lastDay}`;
/** When the season ends, as a local day and clock time: "Season ends 31 Oct 21:40". */
export const seasonEnds = (moment: string) => `Season ends ${moment}`;

/**
 * The day's clock, written here once (live-qa-night-1 P3-8: the HUD said "Tomorrow lasts 1d" where Play said "24h"):
 * when today ends in local clock time, the time left, and how long tomorrow lasts. A day runs 8 to 24 hours, so its
 * lengths read in hours, never days. Each phrase is its words and its reading, for a surface that sets the reading
 * apart; `phraseText` writes it whole: "Day ends 21:40", "7h 14m left", "Tomorrow lasts 24h".
 */
export type ClockPhrase = { words: string; reading: string; readingFirst?: boolean };
const dayLength = (seconds: number | undefined) => formatDuration(seconds, { days: false });
export const dayEnds = (endsAt: number | undefined): ClockPhrase => ({
  words: "Day ends",
  reading: formatClockTime(endsAt),
});
export const dayLeft = (secondsLeft: number | undefined): ClockPhrase => ({
  words: LEFT,
  reading: dayLength(secondsLeft),
  readingFirst: true,
});
export const tomorrowLasts = (seconds: number | undefined): ClockPhrase => ({
  words: "Tomorrow lasts",
  reading: dayLength(seconds),
});
export const phraseText = ({ words, reading, readingFirst }: ClockPhrase): string =>
  readingFirst ? `${reading} ${words}` : `${words} ${reading}`;

/**
 * The day's end, before it comes (Devcon feedback, 4 November 2026: players did not know the day was ending or what it
 * takes): the last hour's line, which opens Today, and Today's block of what goes and what can still be done. What goes
 * is the contract's: each day is its own map, and an army lives only on its day's map (expeditions.cairo).
 */
export const DAY_END = {
  endsIn: (day: number | undefined, secondsLeft: number | undefined) =>
    `${DAY} ${day ?? "—"} ends in ${dayLength(secondsLeft)}`,
  open: "Open",
  goes: "At day end, today's map, its armies and chests go",
  claim: "Claim today's Labor",
  claimVerb: "Claim",
  site: (name: string) => `Clear today's ${name}`,
  siteVerb: "Show",
  explore: "Your army can explore",
  exploreVerb: "Select",
} as const;

/** ClockChip's prefix words: a moment that begins something, or one that ends it. */
export const CLOCK_WORDS = {
  starts: "Starts",
  opens: "Opens",
  ends: "Ends",
  expires: "Expires",
  /** A slot's registration: "Entry closes 16:25 · 1h 59m left". */
  closes: "Entry closes",
  /** The next game's registration, before the schedule opens it: "Entry opens 10:25 · in 17m". */
  entryOpens: "Entry opens",
  /** Before the time left to a beginning: "Starts 16:30 · in 2h 4m". */
  in: "in",
} as const;
/** The day-done card: "Day 12 done · Realm kept · Day 13 is open", and its one verb. */
export const DAY_DONE = "done";
export const REALM_KEPT = "Realm kept";
export const DAY_OPEN = "is open";
export const CONTINUE = "Continue";
/** Past the day end's rolling mist, to its summary. */
export const SKIP = "Skip";
export const FULL_IN = "Full in";
/** A production that never runs out, where its time left would stand. */
export const NO_END = "no end";
/** A store's line on its tooltip: "Wheat 1,771 of 6,000 · +5/min · Full in 14h". */
export const OF = "of";

export const OFFLINE = "Offline";
export const TRY_AGAIN = "Try again";
export const LATER = "Later";
export const CLOSE = "Close";
/** The safe choice on a confirm: the primary. */
export const KEEP = "Keep";

export { XP, xpGainedLine } from "@bibliothecadao/types";
/** The resources Frontier's stores hold, by the catalog's names: one casing, at a line's start or inside it. */
export const ESSENCE = resourceName(ResourcesIds.Essence);
export const LABOR = resourceName(ResourcesIds.Labor);
export const WHEAT = resourceName(ResourcesIds.Wheat);
/** The realm's troops, as a store and an army's figure are named. */
export const TROOPS = "Troops";
export const STAMINA = "stamina";
/** The explores a Well's stamina buys the army it refills: "+3 explores". */
export const exploresBought = (count: number) => `+${count} ${count === 1 ? "explore" : "explores"}`;

/** The HUD's tab for everything the player holds. */
export const EMPIRE = "Empire";
/** The places: the nav's words. */
export const REALM = "Realm";
/** The world map, as the Realm / World switch names it. */
export const WORLD = "World";
/** The realm's way home from its card's header: the map centred on it. */
export const SHOW_MY_REALM = "Show my realm";
/** A realm's place on its ranks' ladder, as its steps say it: "City, rank 2 of 4". */
export const rankStep = (rank: string, step: number, of: number) => `${rank}, rank ${step} of ${of}`;
export const RESEARCH = "Research";
export const CHAT = "Chat";
export const MENU = "Menu";

/** The Menu's rows and its two buttons. */
export const TODAY = "Today";
export const PRODUCTION = "Production";
/** A store at its limit. */
export const FULL = "Full";
/**
 * What the castle holds of a resource, and how much: its storage (owner, 26 October: "store its storage"). The one word
 * for it, on every card that says it.
 */
export const STORAGE = "Storage";
/** On a payout's Full mark: the storage took what it had room for. */
/** A clear's payout over the store's room, on its chip: what goes past the limit is lost. */
export const REST_DID_NOT_FIT = "Full: the rest did not fit";
/** The most troops one army takes, as a castle level sets it (owner, 26 October: "max army size you mean"). */
export const MAX_ARMY_SIZE = "Max army size";
/** What a castle level gives, on its card: the one wording for each (owner, 26 October). */
export const CASTLE_GIVES = {
  plots: "Plots",
  armySlots: "Army slots",
  storage: STORAGE,
  maxArmySize: MAX_ARMY_SIZE,
} as const;
export const SEASON = "Season";
/** The season board's columns, by their heads; the two number columns' full names on the heads' tooltip. */
export const RANK = "Rank";
export const SITES = "Sites";
export const SITES_CLEARED = "Sites cleared";
/**
 * How the Season board ranks, said where players look (owner, 4 November 2026: "ppl have asked how to increase sites in the
 * leaderboard"): Herald ranks by sites cleared, then deepest depth (frontier-leaderboard.ts compareStandings), and every
 * guarded site an army clears counts one (creditSiteClear). The Sites column's tip, the board's line while the player is
 * off the podium, and a site card's "+1 site".
 */
export const SEASON_CLIMB = {
  rule: "Ranked by sites cleared, then deepest depth",
  climb: "Clear sites with your armies to climb",
  plusOne: "+1 site",
} as const;
export const LORDS_EARNED = "LORDS earned";
export const SETTINGS = "Settings";
/** Settings' row for the keys, and the list it opens in Settings' place. */
/** The Build order panel: its name, and what it says when no realm has a step it can take now. */
export const BUILD_ORDER_WORDS = {
  title: "Build order",
  /** A step's verb: the row's reason already names what it builds or deploys, or the level it reaches. */
  build: "Build",
  deploy: "Deploy",
  levelUp: "Level up",
  nothingNow: "Nothing to build now",
  /** The maker: the player's orders, saved on their account, one of them followed. */
  page: "Build orders",
  yourOrders: "Your build orders",
  /** The panel's choice of the order to follow, and its way to the page where orders are made. */
  follow: "Order to follow",
  makeOrders: "Make build orders",
  theGamesOrder: "The game's order",
  steps: (count: number) => (count === 1 ? "1 step" : `${count} steps`),
  active: "Active",
  use: "Use",
  edit: "Edit",
  copyToEdit: "Copy to edit",
  remove: "Delete",
  newOrder: "New order",
  newOrderName: "My order",
  pasteOrder: "Paste an order",
  pasteHere: "Paste an order's JSON",
  readIt: "Read it",
  name: "Name",
  addTo: (rank: string) => `Add to ${rank}`,
  earlier: "Earlier",
  later: "Later",
  fewer: (goal: string) => `Fewer: ${goal}`,
  more: (goal: string) => `More: ${goal}`,
  removeStep: (goal: string) => `Delete: ${goal}`,
  ranks: "Ranks",
  gone: "This order was deleted.",
  save: "Save",
  copyJson: "Copy JSON",
  askAi: "Get help from an AI",
  copied: "JSON copied",
  promptCopied: "Prompt copied",
  noClipboard: "The clipboard is not available here.",
  signInToSave: "Sign in to save your orders.",
  unreachable: "Your build orders could not be reached.",
  accountChanged: "Account changed. Reload your build orders.",
  /** Another device saved first: the account's orders were read again, and this draft is kept. */
  savedElsewhere: "Reloaded changed orders. Save this draft again.",
  full: (limit: number) => `Limit: ${limit} orders. Delete one first.`,
} as const;
export const EVENTS_WORDS = {
  /** What Events and its Log say while the player's filter holds no story. */
  nothingYet: "Nothing here yet.",
  /** Frontier's one feed in its rail: the world's history, and lenses on it. */
  feed: "Feed",
  /** The lenses' group, for assistive technology: Events, the Log and the Feed alike. */
  lens: "Show",
  lenses: { important: "Important", all: "All" },
  lensTips: {
    important: "Your fights and captures, armies lost, crates you opened and a Hyperstructure taken by anyone",
    all: "Everything players do in the world",
  },
  /**
   * Frontier's Feed: All, its default, then Important, anyone's notable stories, then Mine (owner, 27 October: "All /
   * Important (battles but not just mine), then mine").
   */
  feedLenses: { all: "All", important: "Important", mine: "Mine" },
  feedLensTips: {
    all: "Everything players do in the world",
    important: "Fights, captures, cleared sites and chests, anyone's",
    mine: "Everything you do",
  },
  failed: "Event history could not load.",
} as const;
export const SETTINGS_WORDS = {
  app: "App",
  shortcuts: "Keyboard shortcuts",
  show: "Show",
} as const;
export const EXIT = "Exit";
export const SIGN_IN = "Sign in";

/** An army's two ways across the map, and backing out of an order. */
export const EXPLORE = "Explore";
export const MOVE = "Move";
export const CANCEL = "Cancel";
/** A highlighted tile on its tooltip: ground not yet seen, and troops passed to another of the player's armies. */
export const UNEXPLORED = "Unexplored";
/** A reveal that paid under a unit, in the day log: what was done, with no amount (findGain). */
export const EXPLORED = "Explored";
export const TRANSFER = "Transfer";
/** A good held whose weight the game has not given: its donkeys cannot be counted, so it cannot be sent. */
export const WEIGHT_UNKNOWN = "Weight unknown: cannot be sent";
/** A player whose name identity could not give: shown as a dash, named so for a screen reader, never the stand-in. */
export const NAME_UNAVAILABLE = "Name unavailable";
/** A player whose name identity has not answered yet: an ellipsis, named so for a screen reader, never the stand-in. */
export const NAME_WAITING = "Name on its way";

/** A realm's room for buildings: every building takes some, a Hut gives some. */
export const POPULATION = "population";
/**
 * Why a verb cannot run yet, in one line that names what is counted: against what the realm holds, against what is
 * free, or against a store's own limit, which no wait fills. A shortfall that fills by itself says when.
 */
export const needsHave = (need: string, noun: string, have: string) => `Needs ${need} ${noun}, have ${have}`;
export const needsFree = (need: string, noun: string, free: string) => `Needs ${need} ${noun}, ${free} free`;
export const needsOverLimit = (need: string, noun: string, limit: string) =>
  `Needs ${need} ${noun}, storage holds ${limit}`;
export const inTime = (duration: string) => `in ${duration}`;
/**
 * Every cost the HUD shows, the cost first and then what is held, as a newcomer reads it: "10 Labor (you have 1,574)".
 * Where a painting already names the resource (a cost chip) the noun is left out: "10 (you have 1,574)". The pair is
 * written as one (formatHeldAgainst), so a cost not yet held never reads as held.
 */
export const costLine = (amount: number, held: number | undefined, resource?: ResourcesIds): string => {
  const noun = resource === undefined ? "" : ` ${resourceName(resource)}`;
  const pair = formatHeldAgainst(held, amount);
  const holding = held === undefined ? "" : ` (you have ${pair.held})`;
  return `${pair.need}${noun}${holding}`;
};

/** What is held against what is needed, as a cost chip reads it: "9,640 / 15K", never an equal pair while short. */
export const heldAgainstNeed = (held: number | undefined, need: number): string => {
  const pair = formatHeldAgainst(held, need);
  return `${pair.held} / ${pair.need}`;
};
/**
 * A training building's gate with the purchases bought toward it, on either Barracks side: "1/2". The count shows so a
 * first purchase visibly counts: a realm one purchase short read "2 research" before and after it.
 */
export const purchasesOfGate = (bought: number, gate: number) => `${Math.min(bought, gate)}/${gate}`;
/** What a locked training building still waits for: "Needs 1 more Barracks research purchase (1/2)". */
export const needsResearchPurchases = (building: string, bought: number, gate: number) => {
  const left = gate - bought;
  return `Needs ${left} more ${building} research ${left === 1 ? "purchase" : "purchases"} (${purchasesOfGate(bought, gate)})`;
};
/** A training building already standing: a realm holds one of each. */
export const ONE_A_REALM = "Built. A realm holds one.";
/** The arrow beside a price that has risen (a screen reader's words). */
export const PRICE_UP = "price raised";
/** Why a price is above its first, on the arrow beside it, in one line and no sum: "Costs more with each one standing: 2". */
export const priceRaised = (standing: string) => `Costs more with each one standing: ${standing}`;
/** What a building does, in one line on its card's tooltip: "Wheat +5/min". */
export const makes = (noun: string, rate: string) => `${noun} ${rate}`;
export const takesPopulation = (amount: string) => `takes ${amount} ${POPULATION}`;
/** What a training building gives, by its tier: "new armies start with Battle [II]". */
export const startsNewArmies = (attribute: string, tier: number): RankedWords => [
  `new armies start with ${attribute} `,
  { rank: tier },
];

/**
 * An army's XP on its tooltip, against the skill point it earns next: "XP 8 of 100 · next [II] point". XP is a balance
 * an army spends on its attributes; it has no level.
 */
export const xpTowardTip = (held: string, milestone: string, rank: number): RankedWords => [
  `${XP} ${held} of ${milestone} · next `,
  { rank },
  " point",
];

/** The sites on the map, as their cards title them, and the verbs they take. */
export const RIFT = structureName(StructureType.Rift, undefined, "frontier");
export const RUIN = structureName(StructureType.Ruin, undefined, "frontier");
/** The daily clear closes only the ruin's own depth; cards and forecasts share this rule. */
export const ruinRule = (perDepth: boolean): string =>
  perDepth
    ? `One ${RUIN.toLowerCase()} per depth a day · others here vanish`
    : `One ${RUIN.toLowerCase()} a day · the rest vanish`;
/** A map plate's words: a thing with no guard, the troops on their way to one. */
export const UNDEFENDED = "Undefended";
/**
 * A site as its map hover and its card both name it: its own name, then its kind ("Brimdeep Rift"); the kind alone
 * where it has no name. A kind that is its guard (a camp's Troll) is said once, as the guard, so it is left out here.
 */
export const siteTitle = (place: string | undefined, kind: string, guard: string | undefined): string =>
  [place, kind === guard ? undefined : kind].filter(Boolean).join(" ");
export const ARRIVING = "Arriving";
/** A done site, and the chests the clears paid (screen-reader words; the screen shows Fl and Ch). */
export const CLEARED = "Cleared";
export const CHESTS = "Chests";
export const SHRINE = "Shrine";
export const WELL = "Well";
/**
 * What a Shrine's point does once spent, as the contract grants it: one attribute up a rank, up to the point's own, and
 * a refill never past the army's maximum: "Raises one attribute up to [III] · refills up to 40 stamina".
 */
export const shrinePointUse = (rank: number, refill: string): RankedWords => [
  "Raises one attribute up to ",
  { rank },
  ` · refills up to ${refill} ${STAMINA}`,
];
/**
 * Where an army stands from a Shrine, after its name: beside it (it can take the point now) or so many tiles off, said
 * as the player's nearest where no army is selected: "nearest, 3 tiles away".
 */
export const shrineArmyAt = (tiles: number, nearest: boolean): string =>
  `${nearest ? "nearest, " : ""}${tiles <= 1 ? "beside it" : `${formatExact(tiles)} tiles away`}`;
/** A Well's refill share when no army is selected. */
export const wellRefillShare = (percent: number): string => `${formatPercent(percent / 100)} max`;
export const ATTACK = "Attack";
export const ATTACKING = "Attacking…";
/** On an army's step while the order it was given before is still in flight. */
export const ON_ITS_WAY = "On its way…";
/** The order bar while an army's order is in flight and a tile is tapped for it: that tile is its next order. */
export const NEXT_ORDER = "Next order";
export const AFTER_THIS_ONE = "After this one";
/** How an attack ended, the one word on its result: the guard gone, the army gone, or both still standing. */
/** The day log's line for a fight: "Rift: Army lost, lost 154, guard 1,100 to 1,028". */
export const fightLine = (site: string, verdict: string, lost: string, guardBefore: string, guardAfter: string) =>
  `${site}: ${verdict}, lost ${lost}, guard ${guardAfter} left`;
/** A clear's line with what the attack that won it cost: "Rift cleared, lost 68". */
export const clearCostLine = (line: string, lost: string) => `${line}, lost ${lost}`;
/** Why an attack cannot run, or what it costs, in one line under its button. */
export const tooFarFrom = (site: string) => `Too far from the ${site}`;
/**
 * A site's fight card, read as its result will read (the owner's pick, 20 October 2026: "A for the fight"): what this
 * attack does to each side, what it comes to, and under Details the whole fight's figures.
 */
export const FIGHT_WORDS = {
  armyLost: "Your army is lost",
  /** Under the loss, in the panel's place, before it closes: what to do next. */
  armyLostNext: "Its troops fell in the fight. Deploy a new army from your realm.",
  /** An attack that clears the site, over the reward it earns; a site that pays nothing is only cleared. */
  earns: "This attack earns",
  clears: "This attack clears it",
  holds: "The guard holds",
} as const;
/**
 * What an attack costs a side, under its bar (a player: "# of troops lost, % lost/remaining"; owner, 3 November 2026:
 * "A probably good enough"): "−601 · 76% lost", a range where the dice decide it ("−994–1,100 · 20–22% lost").
 */
export const fightLost = (lost: string, share: string) => `−${lost} · ${share}% lost`;
export const NONE_LOST = "None lost";
export const USE = "Use";
export const USING = "Using…";

/** Making something you own better: the castle a level, a building type a tier, an army an attribute tier. */
export const UPGRADE = "Upgrade";

/** The realm: its castle and levels, its buildings, and the row that counts a full realm's common buildings. */
export const CASTLE = "Castle";
export const BARRACKS = buildingName(BuildingType.ResourceKnightT1, true);
const HUT = buildingName(BuildingType.WorkersHut, true);
export const TRAINING_BUILDINGS = [
  buildingName(BuildingType.WarHall, true),
  buildingName(BuildingType.SupplyYard, true),
  buildingName(BuildingType.ScoutsLodge, true),
  buildingName(BuildingType.Hearth, true),
] as const;
/** The castle rows that unlock the three depths beyond the spire. */
/** The layer a realm's spire is the portal to (owner, 4 November 2026: "its a portal to the ethereal layer bro"). */
export const ETHEREAL = "Ethereal";
export const DEPTH_NUMERALS = ["I", "II", "III"] as const;
/** A depth by its name: "Ethereal II". */
export const depthName = (depth: 1 | 2 | 3): string => `${ETHEREAL} ${DEPTH_NUMERALS[depth - 1]}`;
/** A layer's ruin chest today, as the layer switch's marks say it to assistive technology: "Ethereal II: chest taken". */
export const layerChestLine = (layer: string, chest: RuinChest): string => `${layer}: ${LAYER_CHEST[chest]}`;
const LAYER_CHEST = {
  open: "chest to take today",
  claimed: "chest taken today",
  unknown: "chest not known without an army there",
  locked: "not researched",
} as const satisfies Record<RuinChest, string>;
/** The day's own layer, as a site's card names its depth (the layer switch calls it World). */
const SURFACE = "Surface";
/** A site's depth by its name, 0 the Surface, then Ethereal I to III; loud for a depth the map does not have. */
export const siteDepthName = (depth: number): string => {
  if (depth === 0) return SURFACE;
  if (depth === 1 || depth === 2 || depth === 3) return depthName(depth);
  throw new Error(`No expedition depth ${depth}`);
};

/**
 * A realm's spire, its card's words: whose it is, the army it acts for, each depth's entry or why not, and what entering
 * commits that army to.
 */
export const SPIRE_WORDS = {
  title: "Spire",
  enter: "Enter",
  /** The order on the spire's tile; its card then picks the Ethereal layer to enter. */
  order: "Enter the Spire",
  foreign: "Another realm's spire",
  pickArmy: "Select an army beside the spire",
  away: (army: string) => `${army} must be beside the spire`,
  inDepth: (army: string, depth: string) => `${army} is in ${depth} today`,
  landingTaken: "Its landing is taken",
  locked: "Research it to open it",
  commits: (army: string, left: string) => `${army} stays until the day ends (${left})`,
} as const;
export const RESEARCHING = "Researching…";
export const BUILDING = "Building…";
export const UPGRADING = "Upgrading…";

/** A standing building's figures on its panel, each named on its tooltip (the screen shows icons and numbers). */
export const BUILDING_FIGURES = {
  eachMakes: (noun: string) => `${noun} each makes`,
  castleMakes: (noun: string) => `${noun} the castle makes`,
  /** How many of a type stand on the realm: "1 building", "6 buildings" (owner, 27 October: not "6 standing"). */
  standing: (count: number) => formatCount(count, "building"),
  eachAdds: `${POPULATION} each adds`,
  eachTakes: `${POPULATION} each takes`,
  startsAt: (attribute: string) => `${attribute} new armies start at`,
} as const;

/** A slider's two ends, each a button: the least and the most the player can choose. */
export const MINIMUM = "Minimum";
export const MAXIMUM = "Maximum";

/**
 * The stamina a new army starts on, which its army slot holds (the owner, 20 October 2026: "stamina is slot tied"):
 * full when the slot is fresh today, else the bar the slot's last army left. `bar` is "7/150".
 */
export const startsOn = (army: string, bar: string, fresh: boolean) =>
  fresh ? `${army} starts full: ${bar} ${STAMINA}` : `${army} starts on ${bar} ${STAMINA}`;
/**
 * The word over each kind of news on the map's banner. A game's end is its result in every mode (live-qa-night-2 B-6:
 * a Blitz, which has no ages, read "Age Result").
 */
export const HEADLINE_EYEBROWS = {
  "realm-fall": "War Report",
  "hyper-capture": "World Event",
  elimination: "War Report",
  "game-start": "Game started",
  "game-end": "Game result",
  "five-min-warning": "Timer Warning",
  "t3-building": "Military Milestone",
} as const;
/** Where a crate cannot be opened from yet: what opening it needs, said in place of its Open. */
export const CRATE_NEEDS_AN_ARMY = "Needs an army beside it";
/** A field army about to be raised, before it has a number (the Military window's Deploy). */
export const NEW_ARMY = "The new army";

/** Raise an army from troops at home; with none, the realm's Barracks trains them. */
export const DEPLOY = "Deploy";
export const NO_TROOPS_AT_HOME = "No troops at home";
/** No troops at home while the realm's Barracks make the next: when it is home ("No troops at home · in 6m"). */
export const noTroopsUntil = (wait: string) => `${NO_TROOPS_AT_HOME} · ${inTime(wait)}`;
/** Every tile beside the realm holds something: a deploy has nowhere to step out. */
export const NO_OPEN_TILE = "No open tile beside the realm";
/** The wheat that caps a deploy below the troops at home: "Wheat for only 2,991 of 6,200 troops". */
export const wheatForOnly = (troops: string, of: string) => `${WHEAT} for only ${troops} of ${of} troops`;
/** Where wheat short for a deploy is made: the realm, where Farms are built. */
export const GET_WHEAT = `Get ${WHEAT}`;
export const DEPLOYING = "Deploying…";
export const BUILD = "Build";
/**
 * Build pressed on a building the realm has no free population for (Devcon feedback, 4 November 2026: the sheet
 * swapped the player's pick to a Hut with no word): the ask, with the Hut on the same plot as a choice, never as a swap.
 * When the Hut itself cannot be paid yet, the choice picks it, so its price and wait show.
 */
export const ROOM_ASK = {
  question: "Population full",
  buildHut: `${BUILD} a ${HUT} here`,
  chooseHut: `Choose the ${HUT}`,
  another: "Choose another",
} as const;

/** Default army names: "Army" and its place. */
export const ARMY = "Army";

/** A phone's picked army, in its action row (owner, 22 October 2026: mobile direction A): its token opens its card. */
export const PICKED_ARMY = {
  details: (army: string) => `${army}: details`,
} as const;

/** Troops between two of the realm's armies side by side (Frontier's Transfer troops, desktop and phone). */
export const TRANSFER_TROOPS = {
  title: "Transfer troops",
  waiting: "Waiting for both armies’ progress.",
  stale: "The armies changed: review the merge",
  merge: (army: string) => `Merge into ${army}`,
  totalXp: "Total XP",
  totalXpFor: (army: string) => `${army} total XP`,
  losesProgress: (army: string) => `${army} loses its XP, points and upgrades.`,
  /** The second press of a merge that loses a lot: the leaving army's total XP and the chosen target. */
  confirmMerge: (army: string) => `Confirm merge into ${army}`,
  amount: (from: string, to: string) => `Troops ${from} sends to ${to}`,
  pick: "Pick how many to send",
  move: (count: number, to: string) => `Move ${formatAmount(count)} to ${to}`,
  sending: "Moving…",
  cap: (cap: number) => `An army holds at most ${formatAmount(cap)}.`,
  unalike: (picked: string, tapped: string) => `${picked} and ${tapped} hold different troops`,
  failed: "The troops could not be moved.",
  changed: "The armies' troops changed",
} as const;
/** Troops raised from the realm's stock into its army beside it (the realm selected, the army right-clicked). */
export const REINFORCE = {
  verb: "Reinforce",
  title: (army: string) => `Reinforce ${army}`,
  sending: "Reinforcing…",
  failed: "The army could not be reinforced.",
} as const;
/** A realm's armies, as a list's name. */
export const ARMIES = "Armies";
/** The day-done card's count of the armies that ended with the day. */
export const ARMIES_ENDED = "Armies ended with the day";
/** How many troops an army holds: "1 troop", "5,000 troops". */
export const troopCount = (count: number) => formatCount(count, "troop");
/** The sources of a store's production, each with its combined rate. */
export const MADE_BY = "Made by";
export const STORE_MAKERS = {
  buildings: (count: string, total: string) => `${count} · ${total}`,
  castle: (rate: string) => `${CASTLE} · ${rate}`,
};
/** What an army's Homecoming sends home when the day ends, on its row or token in the day's last hour. */
export const comesHomeAtDayEnd = (troops: string) => `${troops} come home at day end`;

/** The day log's lines for what the player did, in the names the build cards and the dock use. */
export const revealLine = (gain: string, resource: string) => `${gain} ${resource}`;
export const builtLine = (building: string) => `${building} built`;
export const deployedLine = (army: string) => `${army} deployed`;
export const disbandedLine = (army: string) => `${army} disbanded`;
/** A day's count of tiles explored, on its total. */
export const REVEALS = "Reveals";
/** How deep a realm went beyond the spire, I to III. */

/** The player on any list. */
export const YOU = "You";

/** A finished game's Results: its panels and how its points were made, each kind on its row. */
export const RESULT_WORDS = {
  theGame: "The game",
  yourPoints: "Your points",
  tiles: "Tiles explored",
  crates: "Crates opened",
  riftsAndCamps: "Rifts and camps",
  hyperstructuresTaken: "Hyperstructures taken",
  hyperstructuresHeld: "Hyperstructures held",
  sitesCleared: "Sites cleared",
  chests: "Chests",
  deepest: "Deepest",
  /** A finished game's map, opened as a spectator: how it ended, to scout. */
  endMap: "See the end map",
  /** Results read by a signed-in player who had no seat in the game. */
  noSeat: "You had no seat in this game.",
  /** A Blitz's Results whose game no list read holds: named by its number. */
  blitzGame: (gameId: number) => `Blitz · game ${gameId}`,
  /** Your points, for a game the player scored nothing in. */
  noPoints: "No points scored.",
  /** Share, once the result's line and address are on the clipboard. */
  copied: "Link copied",
} as const;
/** A Frontier season's recap (in the game when it ends, and on its Results) and its share card. */
export const RECAP_WORDS = {
  /** After the place on the card: "#3 of 45 realms". */
  ofRealms: (field: string) => `of ${field} realms`,
  /** The LORDS the player's podium place pays, on the card. */
  prize: "Prize",
  podium: "The podium",
  /** The deck's four cards, each named at its top. */
  cardNames: { place: "Your place", podium: "The podium", sites: "Your sites", haul: "Your haul" },
  /** The podium card's title, after the name of who took first place. */
  tookTheSeason: "took the season",
  /** A phone's story through the cards: its strip, and the halves that step it. */
  cards: "Your season's cards",
  next: "Next card",
  previous: "Previous card",
  /** The deck's image, where it is saved rather than copied. */
  fileName: "my-season.png",
} as const;

/**
 * Sharing a card is a post on X with its image (owner, 4 November 2026): copy the image (save it, where the clipboard
 * takes none), then post, and paste it in. The two steps are numbered, and the hint says the order. The season's recap
 * and the Frontier day's card share the same steps.
 */
export const SHARE_WORDS = {
  copy: "Copy image",
  copied: "Image copied",
  save: "Save image",
  saved: "Image saved",
  post: "Post on X",
  copyHint: "Copy the image, then paste it in your post on X.",
  saveHint: "Save the image, then add it to your post on X.",
  /** While the card is made into an image. */
  making: "Making the image",
  failed: "The image could not be made.",
  /** A phone's share sheet, to any app the player picks: the card, its line and its link in one press. */
  share: "Share",
  shareFailed: "Sharing did not open. Copy the image and post it instead.",
} as const;

/** A Frontier day's card, shared from the day-done card: the day, its fights in order, its totals and its rank. */
export const DAY_SHARE_WORDS = {
  share: "Share your day",
  rank: "Season rank",
  /** The image's file, where it is saved rather than copied. */
  fileName: (day: number) => `frontier-day-${day}.png`,
  /** Under the card, for a friend: where it is played, and that it costs nothing. */
  playFree: "Free to play",
  /** The day's best moment, its card's headline: a chest, a clear by its site's name, or the land revealed. */
  best: {
    chest: "Ruin chest opened",
    clear: (site: string) => `${site} cleared`,
    reveals: (count: string) => `${count} tiles revealed`,
  },
  /** Under a clear's headline: the guard the fight that won it beat. */
  guardBeaten: (troops: string) => `Guard of ${troops} beaten`,
  /** What the player's shared days brought so far, once they brought anyone: "Your days brought 12 visits · 3 players". */
  brought: (visits: string, joined: string) => `Your days brought ${visits} visits · ${joined} new players`,
} as const;

/** What the player's shared days brought, on their own page: each step a friend takes, counted. */
export const SHARED_DAYS_WORDS = {
  title: "Your shared days",
  steps: {
    posted: "Days posted",
    visits: "Opened by friends",
    joined: "Friends who joined",
    activated: "Cleared a site",
  },
} as const;

/** A shared link's landing: who shared which day, and the way into Frontier. */
export const SHARED_LINK_WORDS = {
  /** Its title and pitch are the link's unfurl's too (@realms-world/identity's SHARED_MOMENT_WORDS), so both say one thing. */
  sharedDay: SHARED_MOMENT_WORDS.title,
  pitch: SHARED_MOMENT_WORDS.pitch,
  play: "Start your adventure",
  opening: "Opening…",
  unknown: "This link leads to no shared day.",
} as const;
/** A season's end, told one of two ways (story): the mist lifted, or it grew too strong. */
export const SEASON_ENDINGS = { lifted: "The mist lifted", strong: "The mist grew too strong" } as const;

/**
 * Season 0's end, the weekend of Diwali, for a Devcon realm's owner (every other player meets the season's usual end):
 * thanks, the festival, and the Season 1 ticket the owner promised (11-04: a special ticket with a special realm, on the
 * same account; no tier is named). Plain words for players who read English as a second language.
 */
export const FESTIVAL_WORDS = {
  thanks: "Thanks for playing",
  enjoy: "Happy Diwali! Go enjoy it with the people you love.",
  ticketFor: "For Devcon realm owners",
  ticketTitle: "You get a special Season 1 ticket",
  ticketLine: "With a special realm",
  ticketStub: "Season 1 · Devcon",
  ticketHow: "It will be on this account. Nothing to do.",
  seeSeason: "See my season",
} as const;
export const SEASON_ERROR = "Season did not answer.";
export const TODAY_ERROR = "Today did not answer.";
/** A day's totals the player's history cannot give: the read keeps only the newest stories, or did not answer. */
export const DAY_TOTALS_UNKNOWN = "This day's totals are unknown";

/** Looking at another realm, and stopping. */
export const VISIT = "Visit";
export const LEAVE = "Leave";

/** Buying stamina points for LORDS. */
export const REFILL = "Refill";
export const REFILLING = "Refilling…";

/** LORDS leaving the game for the wallet linked to the account. */
export const WITHDRAW = "Withdraw";
export const SENDING = "Sending…";
export const LINK_WALLET = "Link wallet";
/** Where an account with no linked wallet sees LORDS it is owed: the ledger pays a linked wallet only. */
export const LINK_WALLET_FOR_LORDS = "Link a wallet to receive your LORDS";
/** The same once the season is over: unpaid LORDS lapse at the ledger's claim deadline and return to the treasury. */
export const linkWalletBy = (deadline: string) => `Link a wallet by ${deadline} or these LORDS return to the treasury`;
export const TRANSACTION = "Transaction";
export const PAYOUTS_PAUSED = "Payouts paused";
export const paidWhenResumed = (amount: string) => `Payouts paused: ${amount} waiting`;
/** The season's last hour of withdrawals is kept for paying the ones already made. */
export const WITHDRAWALS_CLOSED = "Withdrawals have closed";
export const AUTOMATIC_LORDS_PAYOUT = "LORDS are paid out automatically at season end";
export const PAYOUTS_UNREADABLE = "Payouts cannot be read right now";
/** A withdrawal with no answer from the game: it may still apply, so it is never sent again on its own. */
export const withdrawalUnknown = (amount: string) => `No answer yet for these ${amount}`;

export const REALM_LABOR = "Realm Labor";
export const NO_REALM_LABOR = "No daily Labor claim";
/** What a home's claim gives each game day, after its amounts. */
export const EACH_DAY = "each day";
/** The claim's step: what it gives, its Labor that fits and a golden ticket's Essence, each only when there is some. */
export const claimRealmLaborLabel = (amount: number, essence = 0) =>
  `Claim ${[
    ...(amount > 0 ? [`${formatExact(amount)} Labor`] : []),
    ...(essence > 0 ? [`${formatExact(essence)} Essence`] : []),
  ].join(" · ")}`;
/** A campaign home's mark beside its realm's rank: the event that founded it, golden for a golden ticket's. */
export const DEVCON = "Devcon";
export const CLAIMING_LABOR = "Claiming";
/** Today's Labor against a full store: what of it lands, the rest is lost with the claim. */
export const laborFits = (fits: number, total: number) =>
  `${formatExact(fits)} of ${formatExact(total)} Labor fit · storage full`;
/** Once claimed: when the next game day, and its claim, opens. */
export const dayOpensIn = (day: number, secondsLeft: number | undefined) =>
  `Day ${day} opens in ${dayLength(secondsLeft)}`;
/** Once claimed on the season's last day: no day follows, only the season's end. */
export const seasonEndsIn = (secondsLeft: number | undefined) => `Season ends in ${dayLength(secondsLeft)}`;
/** Each state of a season day on the Realm Labor sheet's strip, as assistive technology names it after the day. */
export const SEASON_DAY_STATES = {
  claimed: "claimed",
  missed: "missed",
  open: "to claim",
  ahead: "ahead",
  before: "before your home",
} as const;
export const seasonDayLabel = (day: number, state: keyof typeof SEASON_DAY_STATES) =>
  `Day ${day} ${SEASON_DAY_STATES[state]}`;
/** The phone's own time zone: the server words a push's times by this clock. */
export const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
/** The claimed sheet's ask for a push when the next game day opens, on this device, and its state once on. */
export const REMIND_ME = "Remind me";
export const REMINDER_ON = "Reminder on";
/** The same ask on an iPhone in its browser, which sends push only to the installed app. */
export const ADD_TO_HOME_SCREEN = "Add to Home Screen";
export const TURNING_ALERTS_ON = "Turning on";
/** The popup that asks for alerts (useAlertsPopup): what this device would get, then the tap. */
export const ALERTS_POPUP = {
  title: "Know when to come back",
  /** The kinds the asked level pushes, as Settings names them (kindsList). */
  brings: (kinds: readonly NotificationKind[]) => `A push for ${kindsList(kinds)}.`,
  install: "On an iPhone, alerts need Realms on your Home Screen first.",
  turnOn: "Turn on alerts",
  notNow: "Not now",
} as const;
export const REALM_NUMBER = "Realm number";
export const YOUR_REALMS = "Your Realms";
/** A held Realm as a pick or a row names it: its number, then its name where it has one ("711 · Ket ek Ëtläl"). */
export const numberedRealm = (realmId: number, name: string | undefined) =>
  name ? `${realmId} · ${name}` : String(realmId);
export const NO_HELD_REALMS = "Your linked wallet holds no Realm";
export const HELD_REALMS_UNREADABLE = "Your Realms cannot be read right now";
export const TICKET_UNREADABLE = "Your ticket cannot be read right now";
export const INVALID_REALM_NUMBER = "Enter a Realm number from 1–8,000.";
/** A campaign's name where its tickets are named: on the Realm step, the ticket a home can be founded with. */
const CAMPAIGN_NAMES: Record<CampaignKey, string> = { "devcon-2026": DEVCON };
export const campaignTicketName = (campaign: CampaignKey, golden: boolean) =>
  `${golden ? "Golden " : ""}${CAMPAIGN_NAMES[campaign]} ticket`;
/** The Realm step: its one job, the home the player founds, and what it offers to found it with. */
export const HOME_STEP_WORDS = {
  title: "Choose your home",
  /** The step's one verb, and what it says while the home is founded. */
  found: "Create your realm",
  founding: "Creating your realm…",
  /** The name a new account was given at sign-up, said where the player first chooses something of their own. */
  playsAs: (name: string) => `You play as ${name}`,
  changeOnYou: "Change it on You",
  /** While the account's Realms and ticket are read: the step offers nothing yet, and says why. */
  loading: "Reading what you hold…",
  freeHome: "A free home",
  freeHomeLine: "Hold a Realm or a Devcon ticket to add a daily claim.",
  taken: "Taken",
  keepFree: "Continue with my free home",
  attachTitle: "Choose a daily claim",
  attach: "Add this daily claim",
  attaching: "Adding daily claim…",
  attachLine: "One source per home. Your home keeps its existing traits.",
  linkWallet: "Link the wallet that holds your Realms",
  registered: "Registered for this game",
  noMatch: "No Realm matches",
  /** A Realm by its number, under its name. */
  realm: (realmId: number) => `Realm ${realmId}`,
  /** The strip's last tile: every choice, in a grid with search. */
  all: (count: number) => `All ${count}`,
  search: (count: number) => `Search ${count} Realms`,
  /** Over the choices: "1 ticket · 3 Realms". */
  count: (tickets: number, realms: number) =>
    [tickets ? formatCount(tickets, "ticket") : null, realms ? formatCount(realms, "Realm") : null]
      .filter(Boolean)
      .join(" · "),
} as const;

/** The Season chip's tip: what a common chest pays today, and the pool the season pays chests from. */
export const commonChestPays = (lords: string) => `A Common chest pays ${lords} LORDS today`;
export const seasonPool = (lords: string, today: string | undefined) =>
  `Season pool ${lords} LORDS${today === undefined ? "" : `, ${today} released today`}`;
export const POOL_NOT_PUBLISHED = "Pool not published yet";
/** The season's top prizes, as a podium names itself to assistive technology. */
export const SEASON_PRIZES = "Season prizes";
/** A prize place no one holds: no player who cleared a site yet, or a winner the ledger fixed and has not paid yet. */
export const PRIZE_UNHELD = { open: "Open", awarding: "Pending" } as const;
// The app's words outside a match (the shell's pages).

/**
 * The app's words outside a match, each spelled once (words.html; the Frontier glossary stays the authority for game
 * words). A screen never types one of these itself: it names the constant.
 */
export const WORDS = {
  play: "Play",
  season: SEASON,
  /** What changed in the game and the Scroll's posts: a place of its own. */
  whatsNew: "What's new",
  /** Realms' marketplace, a site of its own: the bar's one place outside the app. */
  market: "Market",
  /** The player's own place: their card, their finished games, Settings. */
  you: "You",
  /** You while signed out: the bar's way in. */
  connect: "Connect",
  signIn: SIGN_IN,
  dev: "Dev",
  /** Start Frontier on a first visit; entry is free. */
  playFree: "Play free",
  resume: "Resume",
  /** Go into a Blitz game the player is on. */
  enter: "Enter",
  /** Look at a Blitz game the player is not on. */
  watch: "Watch",
  /** Take a Blitz seat. */
  joined: "Joined",
  results: "Results",
  /** A game under way. */
  live: "Live",
  /** Play's lead when no mode has a game live or scheduled. */
  noSeason: "No season running",
} as const;

/** The desktop footer on the pages that scroll: its columns and their links. */
export const FOOTER_WORDS = {
  community: "Community",
  realms: "Realms",
  legal: "Legal",
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  credits: "Credits and licences",
  owner: "© 2026 BibliothecaDAO",
} as const;

/** Play: what is under way now, and each mode's next and finished games behind its switch. */
export const PLAY_WORDS = {
  ended: "Ended",
  /** A season's players, counted by the one plural rule (formatCount): "1 player", "14 players". */
  player: "player",
} as const;

/** The lore's line, on the first visit's painting and on sign-in (approved 25 September). */
export const LORE_LINE = "The mist forgets. Your realm remembers.";
/** Frontier's pitch on the first visit's card. */
export const PITCH = "A new land every day";

/** The sign-in providers, as their own brand names them: the sheet's buttons, its handoff step and You's sign-in row. */
export const SIGN_IN_PROVIDER_NAMES = {
  google: "Google",
  apple: "Apple",
  discord: "Discord",
  twitter: "X",
} as const satisfies Record<SocialProvider, string>;

/** The sign-in flow's words: its titles, its ways in and the steps on its buttons. */
export const SIGN_IN_WORDS = {
  /** A provider's button, in the wording Google's and Apple's brand rules allow. */
  continueWith: (provider: SocialProvider) => `Continue with ${SIGN_IN_PROVIDER_NAMES[provider]}`,
  /** On a provider's button while its sign-in address is on its way (a phone's Discord app opens only from a tap that has it). */
  preparing: "Preparing…",
  /** On a phone's Discord button once its tap handed the sign-in to the app, while the app comes up. */
  opening: (provider: SocialProvider) => `Opening ${SIGN_IN_PROVIDER_NAMES[provider]}…`,
  or: "or",
  email: "Email",
  sendCode: "Send code",
  sending: "Sending…",
  codeSent: "Code sent",
  code: "Sign-in code",
  checking: "Checking…",
  newCode: "New code",
  yourName: "Your name",
  /** Under an empty name field: an email sign-up is suggested nothing, and the name is what every board shows. */
  pickName: "Pick the name other players see on the leaderboards.",
  claimName: "Claim name",
  saving: "Saving…",
  portrait: "Portrait",
  /** Under the ways in: most visitors from a flyer are new, and their first sign-in is their sign-up. */
  firstSignIn: "New here? Your first sign-in creates your Realms account.",
  /**
   * Back from a provider, which may have finished in another browser (a phone's Safari view, the browser the provider's
   * app opens): that page shows a code to bring here.
   */
  handoff: (provider: SocialProvider) =>
    `Finished with ${SIGN_IN_PROVIDER_NAMES[provider]}? Enter the code its page showed you.`,
  handoffCode: (provider: SocialProvider) => `${SIGN_IN_PROVIDER_NAMES[provider]} code`,
  tryAgain: (provider: SocialProvider) => `Try ${SIGN_IN_PROVIDER_NAMES[provider]} again`,
  /** On a phone, whose tap opened the Discord app: the same sign-in on Discord's website instead. */
  continueInBrowser: "Continue in browser",
} as const;

/** Devcon's landing and its ticket: the realm it promises, the ticket opened, and what each tier gives each day. */
export const JOIN_WORDS = {
  realm: "A Devcon realm is yours",
  yourTicket: "Your ticket",
  /** A second flyer on an account that already holds its ticket: the held one, never the flyer's. */
  alreadyHeld: "You already hold your Devcon ticket",
  open: "Open your ticket",
  opening: "Opening…",
  sealed: "A realm waits for you",
  stub: "Devcon · Mumbai",
  golden: "Golden ticket",
  goldenLine: "A golden realm waits",
  goldenStub: "Golden · Devcon · Mumbai",
  laborEachDay: (amount: number) => `${formatExact(amount)} Labor ${EACH_DAY}`,
  essenceEachDay: (amount: number) => `${formatExact(amount)} Essence ${EACH_DAY}`,
  /** The reveal's way on, into the Devcon game's Realm step. */
  startAdventure: "Start your adventure",
  continue: "Continue",
  closed: "Devcon tickets have closed.",
  taken: "Another player already opened this ticket.",
  founded: "Your realm already has a daily claim. Give this flyer to a friend.",
  noTicket: "This link holds no ticket. Scan the QR on your Devcon flyer.",
  failed: "Your ticket could not be opened.",
  /** Over a friend's referral link: who sent it, by their chosen name. */
  sentYou: (name: string | null) => `${name ?? "A friend"} sent you a Devcon realm`,
  /** Under the sealed ticket: the season's end, in the event's clock. */
  openUntil: (moment: string) => `Open it until ${moment}.`,
  selfReferral: "This is your own invite link. Share it with a friend.",
  referralUnknown: "This invite link holds no ticket.",
} as const;

/** Invite friends, on You: the referral link, its friends' progress, and what they earn the inviter. */
export const REFERRAL_WORDS = {
  title: "Invite friends",
  /** What the inviter's friends get and can still earn them, by their home. */
  promise: {
    free: (oneIn: number) =>
      `Each friend who signs up through your link gets a Devcon realm, 1 in ${oneIn} of them golden. When a friend founds a realm and clears a site, you get a Devcon realm too.`,
    ticket: "Your friends earned you a Devcon ticket. Add it to your home from its daily claim.",
    devcon: (oneIn: number) =>
      `Each friend who signs up through your link gets a Devcon realm, 1 in ${oneIn} of them golden. A golden friend who founds a realm and clears a site turns your realm golden.`,
    golden: "Your realm is golden. Each friend who signs up through your link still gets a Devcon realm.",
    held: "Each friend who signs up through your link gets a Devcon realm. Your home already has its daily claim, so it earns nothing more.",
  },
  /** Golden earned on a Devcon home the game has not confirmed yet: nothing is promised for a claim before it is. */
  pending: "Golden earned. Your realm turns golden once the game confirms it; until then it claims as it does now.",
  copy: "Copy",
  copied: "Copied",
  share: "Share",
  shareText: "A Devcon realm for you in Realms: Frontier",
  /** The link's way to golden, counted friends of the number that turns it. */
  toGoldenLink: (counted: number, of: number) => `${counted} of ${of} friends`,
  goldenLinkChip: "Golden link",
  forEachFriend: "A Devcon realm",
  forEachFriendDetail: "for each friend",
  yourRealm: "Your Devcon realm",
  yourRealmDetail: "when a friend founds and clears a site",
  goldenFriend: "A golden friend",
  goldenFriendDetail: (oneIn: number) => `1 in ${oneIn} tickets, once that friend counts`,
  goldenLink: "A golden link",
  goldenLinkDetail: (of: number) => `at ${of} friends: you and every friend`,
  friend: {
    signed: "Signed up, not founded yet",
    founded: "Founded, clearing a first site",
    counted: "Founded and cleared a site",
    excluded: "Same email or device as another player, so not counted",
  },
  /** A friend whose name is not chosen yet. */
  unnamed: "A friend",
  counted: "Counted",
  waiting: "Waiting",
  notCounted: "Not counted",
  golden: "Golden",
  unreadable: "Your invite link could not be loaded.",
  ticketTitle: (name: string | null) => `${name ?? "A friend"} counted: your Devcon realm`,
  ticketBody: "Your friend founded a realm and cleared a site. Add this ticket to your home from its daily claim.",
  ticketAction: "Add it to my home",
  /** Golden said once the realm is golden on the board, or the golden ticket waits to be added to a home. */
  goldenTitle: (linkGolden: boolean) => (linkGolden ? "Your link went golden" : "A golden friend counted"),
  goldenBody: {
    ticket: "Your Devcon ticket is golden. Add it to your home from its daily claim.",
    golden: "Your Devcon realm is golden from your next daily claim. Days you already claimed stay as they were.",
  },
  goldenAction: { ticket: "Add it to my home", golden: "Open my realm" },
  /** A phone's compact panel: the same facts in a line each. */
  compact: {
    promise: {
      free: (oneIn: number) =>
        `Each friend gets a Devcon realm, 1 in ${oneIn} golden. Your first counted friend gets you one.`,
      ticket: "Friends earned you a Devcon ticket: add it from your daily claim.",
      devcon: (oneIn: number) =>
        `Each friend gets a Devcon realm, 1 in ${oneIn} golden. A golden friend who counts makes yours golden.`,
      golden: "Your realm is golden. Each friend still gets a Devcon realm.",
      held: "Each friend gets a Devcon realm. Your home earns nothing more.",
    },
    pending: "Golden earned: waiting for the game to confirm it.",
    /** What counts a friend, said where the slots count them: the rule the statuses below name the next step of. */
    linkRule: (at: number) =>
      `Friends count once they found a realm and clear a site. At ${at}, your link turns golden.`,
    linkGolden: "Your link is golden: every friend on it too.",
    /** Each friend's next step to count, or why they never will. */
    status: { signed: "Not founded yet", founded: "No site cleared yet", excluded: "Not counted" },
    excluded: "Same email or device as another player",
  },
} as const;

/** Blitz's rows and lobby: the steps on Join, the seat's cost, and what stands where an action cannot. */
export const BLITZ_WORDS = {
  /**
   * Blitz's column with no Blitz at all and none left in the season's Blitz calendar (live-qa-night-1 P3-12: it vanished
   * once an ended one's results were seen).
   */
  noneScheduled: "No Blitz scheduled this season.",
  /** Blitz's column before the calendar's next game opens for entry: "Starts 12:00 · Entry opens 10:25 · in 17m". */
  nextRanked: "Next ranked Blitz",
  /** The next game's entry, due to open at the schedule's next tick. */
  entryOpening: "Entry opens in a moment",
  preparing: "Preparing…",
  /** Shown only to assistive technology; the seats are drawn. */
  seats: "Seats",
  registered: "Registered",
  registeredUnit: "registered",
  /** Under a slot's registered count: why it has no seats yet. */
  drawnAtClose: (seats: number) => `Games of ${seats}, drawn at close`,
  /** A slot taking players: its lobby holds the paid entry. */
  join: "Join",
  /** A seated game still being prepared: its lobby shows the roster and Preparing until it opens. */
  lobby: "Lobby",
  /** The lobby's players: a slot's registrations, a game's seats. */
  whoIsIn: "Who is in",
  /** Before the lobby's countdown. */
  closesIn: "Entry closes in",
  startsIn: "Starts in",
  endsIn: "Ends in",
} as const;

/** A Blitz lobby's chat: its panel, its field and the lines that stand where a message cannot go. */
export const CHAT_WORDS = {
  chat: "Chat",
  message: "Message",
  /** Under the chat of a reader the room does not let write. */
  registeredWrite: "Players registered in this Blitz write here.",
  rateLimited: "Too fast. Wait a moment.",
  refused: "That message was not sent.",
  /** Over a chat scrolled up to read, once a newer message arrived: it jumps to the latest. */
  newMessages: "New messages",
  /** The private conversations' tab, beside the rooms. */
  messages: "Messages",
  /** A room, a conversation or Messages with nothing written yet. */
  noMessages: "No messages yet",
  /** What a conversation's count says. */
  unread: "unread",
  /** A message's action: answer it, its quote over the answer. */
  reply: "Reply",
  /** Over the field while a reply is written: put it away. */
  cancelReply: "Cancel the reply",
  /** Asked before a link off Realms' own sites opens: its whole address, then Cancel or Open. */
  leavingRealms: "Leaving Realms",
  open: "Open",
  /** Beside the field: the place selected on the map goes with the message. */
  sharePlace: "Share the selected place",
  /** Over the field while a place goes with the message: take it off. */
  removePlace: "Take the place off",
  /** In a place shared in another game, after its name: that game ("in Frontier 3"); it opens nothing here. */
  inGame: "in",
  /** In a place the map has no more (gone, or from a closed Frontier day), after its name: why it opens nothing. */
  placeGone: "gone",
  /** On a player's card: hide everything they write, here and in private (the server drops their messages to you). */
  mute: "Mute",
  unmute: "Unmute",
  /** When the server did not take a Mute or an Unmute: nothing changed. */
  muteFailed: "Mute did not go through. Try again.",
  unmuteFailed: "Unmute did not go through. Try again.",
  /** Where a muted player's messages stood in a room, under their name: pressed, their card offers Unmute. */
  muted: "muted",
  /** Messages' last group: every player the player muted, each with Unmute. */
  mutedPlayers: "Muted",
  /** When the muted players could not be read: rooms wait for them, and chat reads them again by itself. */
  mutesUnavailable: "Chat could not read who you muted. It tries again.",
  /** A room while who is muted is not known yet. */
  loading: "Loading…",
  /** Beside the chat's tabs: how many players are in it now ("4 online"). */
  online: "online",
  /** Where chat stands for a player not signed in: the chat strip's line, the app's Chat page and pane. */
  signInToChat: "Sign in to chat",
  /** The app's pane over a page: what closes it. */
  closeChat: "Close chat",
} as const;

/** The doorway into a match: its four steps and what holds it until the player acts. */
export const DOORWAY_WORDS = {
  /** What each step of the track does while it runs, over the bar. */
  account: "Signing in",
  realm: "Preparing your realm",
  map: "Loading the map",
  play: "Entering the world",
  stepOf: (step: number, of: number) => `Step ${step} of ${of}`,
  secondsLeft: (seconds: number) => `About ${seconds} s left`,
  /** What the first minutes hold, said while a player's map loads. */
  claimTitle: "Claim Labor every day",
  claimDetail: "Your realm's daily claim, free each Frontier day",
  firstTitle: "First: build a Barracks",
  firstDetail: "Then send your first army to explore",
  /** The bar, named for assistive technology. */
  entering: "Entering the game",
  signInToPlay: "Sign in to play.",
  notOnThisGame: "Not on this game.",
  ended: "This game has ended.",
  deviceLimit: "Signed in on 8 devices already.",
  removeDevice: "Remove a device",
  /** A scene that could not be set up, named for what the player does not see; the cause is in the console. */
  mapNotDrawn: "The map could not be drawn.",
  realmNotDrawn: "The realm could not be drawn.",
  /** The way on when the map cannot be drawn: the realm view opens without it. */
  openRealm: "Open realm",
} as const;

/** Season and a game's Results. */
export const SEASON_WORDS = {
  /** The view switch's name, for assistive technology. */
  views: "Season views",
  /** What a board row's explore count is, read after it. */
  sitesCleared: "sites cleared",
  share: "Share",
  /** Between a place and the field: "3rd of 24". */
  of: "of",
  /** Blitz's own unit, one word wherever a player reads it. */
  vp: "points",
  /** Under the LORDS the player's realm has earned this season. */
  lordsEarned: "LORDS earned",
  /** Frontier's board before any realm is on it, and how to get on it. */
  boardEmpty: "No realm yet. Create one from Play.",
  /** A player with no realm on Frontier's board this season. */
  notOnBoard: "Not on Frontier's board yet",
  /** Frontier's seasons that have ended, under its board. */
  pastSeasons: "Past seasons",
  /** Prod's October season, kept after its shard was torn down: its name, in place of a number. */
  playtest: "Playtest",
} as const;

/** The Blitz rating (MMR): its panel's words. The rating is automatic at settlement; nothing here asks for it. */
export const RATING_WORDS = {
  rating: "Rating",
  blitzRating: "Blitz rating",
  /** A Realms account with no linked wallet carries no rating (not 0, not 1000). */
  unlinked: "Link a wallet to carry a rating",
  /** Blitz's board before anyone has a rating. */
  noneRated: "No ratings yet",
} as const;

/** You and Settings: their rows and groups, Settings' sheets and confirms. */
export const PROFILE_WORDS = {
  settings: "Settings",
  /** The docs site, opened in a new tab. */
  howToPlay: "How to play",
  account: "Account",
  notifications: "Notifications",
  devices: "Devices",
  /** Music outside a match, on this device. */
  music: "Music",
  recentGames: "Recent games",
  /** The counts at the foot of the player's own card, each opening its sheet. */
  holdings: "Holdings",
  realms: "Realms",
  ticket: "Ticket",
  /** Under a count the holdings could not read: it says why in its sheet. */
  unknownCount: "—",
  /** Recent games with none finished yet: the player's own, and another player's. */
  noGamesOwn: "Your finished games will show here.",
  noGames: "No finished games yet.",
  name: "Name",
  portrait: "Portrait",
  signInMethods: "Sign-in",
  email: "email",
  linkWallet: "Link wallet",
  /** The You card's holding with no wallet linked: what a wallet holds and receives (owner, 31 October 2026). */
  linkWalletHoldings: "Link a wallet for your Realms and LORDS",
  signOut: "Sign out",
  signOutAsk: "Sign out?",
  signOutCost: "This device forgets your account",
  remove: "Remove",
  removing: "Removing…",
  removeAsk: (device: string) => `Remove ${device}?`,
  removeCost: "It signs out there",
  thisDevice: "This device",
  /** A device the account knows but that has no name yet. */
  device: (lastFour: string) => `Device ${lastFour}`,
  deviceRemoved: "This device was removed",
  blocked: "Blocked",
  blockedLine: "Alerts are blocked in this browser",
  install: "Install",
} as const;

/**
 * Deleting a Realms account (apps/realms/server/account-deletion.ts): what goes and what stays, read by Settings'
 * Delete account and by the public page that explains it, so both say the same.
 */
export const ACCOUNT_DELETION_WORDS = {
  title: "Delete account",
  page: "Delete your account",
  intro: "Deleting your Realms account is permanent and happens at once. It cannot be undone.",
  goesTitle: "What is deleted",
  goes: [
    "Your sign-in: your email, every linked login and every signed-in device",
    "Your name, portrait and payout wallet link",
    "Your notification settings and push alerts on every device",
    "Your direct messages and block list",
    "Your build orders, referral link and news emails",
  ],
  staysTitle: "What stays",
  stays: [
    "Your Realms wallet stays on Starknet with everything in it: Realms cannot take or move it. Only your passkey controls it now. This app can no longer send from it, and email recovery ends, a recovery under way included. Move what you want to keep first.",
    "Your game accounts stay on chain with their progress. No one can sign in to them or add a device to them again; a device already added keeps its key on chain.",
    "Ratings stay on chain under the wallets that played.",
    "Messages you sent stay with the players who got them and in chat rooms until they are 30 days old, then they are deleted.",
    "Campaign tickets, past wallet links and payout records stay under an anonymous id, so past games and payouts still add up.",
  ],
  confirm: "We email you a code. Enter it to delete your account.",
  sendCode: "Email me a code",
  stepsTitle: "How to delete it",
  steps: [
    `Sign in at ${APP_HOST} and open Settings.`,
    "Choose Delete account, at the end of Settings, and read what is deleted and what stays.",
    "Enter the code we email you. Your account is deleted at once.",
  ],
  openSettings: "Open Settings",
  cannotSignIn: "Cannot sign in to your account? Ask us on Discord to delete it.",
} as const;

/**
 * The payout wallet: where withdrawals are paid and what pays a Blitz entry; a Blitz prize goes to the wallet a seat was
 * drawn with. Also the wallets an account links, and Ready for a player with none.
 */
export const WALLET_WORDS = {
  payoutWallet: "Payout wallet",
  prizesGoHere: "Prizes go here",
  stepWallet: "Wallet",
  stepCode: "Email code",
  haveOne: "I have a wallet",
  haveOneLine: "Ready · Braavos · Controller",
  ready: "Ready",
  braavos: "Braavos",
  controller: "Controller",
  extension: "extension",
  byEmail: "by email",
  yourWallet: "Your wallet",
  realmsWallet: "Realms wallet",
  createWallet: "Create my wallet",
  createLine: "One tap with your face, fingerprint or screen lock. No seed phrase.",
  confirmPasskey: "Confirm with your passkey",
  send: "Send",
  sendTo: "To",
  sendToHint: "An exchange deposit address, or your own wallet",
  sendAmount: "Amount",
  inWallet: (lords: string) => `${lords} LORDS in your wallet`,
  review: "Review",
  sendLine: (lords: string, to: string) => `Send ${lords} LORDS to ${to}`,
  sent: "Sent",
  notAnAddress: "Not a Starknet address",
  notAnAmount: "Enter an amount up to what your wallet holds, less the fee",
  sendMax: "Max",
  /** A default wallet's network fee, paid in LORDS: about what it takes, and the most it may (the rest comes back). */
  networkFee: (about: string, most: string) => `Network fee about ${about} LORDS, at most ${most}`,
  /** The wallet holds less LORDS than its fee may take. */
  feeShort: (most: string, held: string) => `The network fee needs up to ${most} LORDS. Your wallet holds ${held}.`,
  /** The wallet holds no LORDS to price its fee with. */
  noFeeLords: "Sending pays a network fee in LORDS, and your wallet holds none.",
  pricing: "Working out the fee",
  feeRose: "The network fee went up. Check it and confirm again.",
  /** What a send asks for and its fee's max are more than the wallet holds. */
  leaveForFee: (most: string) => `Leave ${most} LORDS in your wallet for the network fee.`,
  /** The same send for what the wallet holds less its fee's max. */
  sendInstead: (lords: string) => `Send ${lords} LORDS instead`,
  walletUnread: "Your Realms wallet could not be read.",
  lostPasskey: "Lost your passkey?",
  recoverTitle: "Recover your wallet",
  recoverLine:
    "Make a new passkey on this device. In 7 days it takes over your Realms wallet; until then, the passkey you have now can cancel. We email you when it starts.",
  makeNewPasskey: "Make a new passkey",
  recoveryUnderWay: (date: string) => `Recovery under way: a new passkey takes over this wallet on ${date}.`,
  cancelRecovery: "Not you? Cancel it",
  codeSentTo: "Code sent to",
  sending: "Sending…",
  newCode: "New code",
  confirmInWallet: "Confirm in your wallet",
  canReceive: "Ready",
  /** The co-signer holds a replaced wallet's first payout (packages/value-ledger/src/payout-wallet.ts). */
  newWalletWaits: (hours: number) => `Replace or relink: the new wallet's first Frontier payout waits ${hours} hours`,
  replace: "Replace",
  unlink: "Unlink",
  unlinkTitle: "Unlink wallet",
  nothingPaysOut: "Nothing pays out without a wallet",
  opening: "Opening…",
  nothingOpened: "Nothing opened? Choose again.",
  noneHere: "No wallet found in this browser",
  wrongWallet: (owner: string) => `Only ${owner} can sign this`,
  paymentFailed: "The wallet did not confirm it",
  tryAgain: "Try again",
  whichHolds: (owner: string) => `Which wallet holds ${owner}?`,
} as const;

/** What every value screen shares: a fee the payout wallet cannot pay yet. */
export const VALUE_WORDS = {
  confirming: "Confirming…",
  /** A send whose answer was lost: it may still land, and nothing new is sent until the chain says. */
  onItsWay: "Your last send is on its way: the network has not confirmed it yet.",
  checkAgain: "Check again",
  sendAgain: "Send it again",
  lastSendFailed: "Your last send did not go through.",
  refused: "The ledger refused it.",
  noStrk: "No STRK for the fee",
  swapOnAvnu: "Swap on AVNU",
  /** The purse's deposit, paid over the game from the payout wallet. */
  depositTitle: (amount: string) => `Deposit ${amount} LORDS`,
} as const;

/** A paid Blitz's entry, in its lobby. */
export const ENTRY_WORDS = {
  entry: "Entry",
  seat: "Seat",
  seatEffect: "Entry",
  sword: "Sword",
  swordEffect: "Win ×2",
  shield: "Shield",
  shieldEffect: "Loss ½",
  total: "Total",
  payAndJoin: "Pay & join",
  needMore: (amount: string) => `Need ${amount} more LORDS`,
  paidFromWallet: "Entry is paid from your payout wallet",
  registered: "Registered",
  /** The slot is listed and the ledger does not hold it yet: a moment, not a failure. */
  openingLine: "Entry opens in a moment",
  registeredLine: "Your seat is drawn when entry closes.",
  /** Past the close, until a game's roster names the wallet. */
  drawingLine: "Entry closed. Drawing seats.",
  seated: "Seated",
  yourGame: "Your game",
  notSeated: "Not seated",
  paid: "Paid",
  credit: "Credit",
  credits: (count: number) => `Credit ×${count}`,
  cancelled: "Cancelled",
  takeRefund: "Take refund",
  lords: "LORDS",
  swordCredit: "Sword credit",
  shieldCredit: "Shield credit",
  back: "Back",
  refunded: "Refunded",
  closed: "Entry closed",
  closedLine: "This slot takes no more players",
  refundedLine: "Back in your wallet",
  unreadable: "This game's entry could not be read",
  whereItGoes: "Season pool, chests and treasury",
} as const;

/** A ledger's test token, minted to the wallet that pays. */
export const mintTestTokenWord = (amount: string) => `Mint ${amount} test tokens`;

/** After a paid Blitz: the rating's change and the chest the result minted. */
export const REWARD_WORDS = {
  unreadable: "This game's reward could not be read.",
  rating: "Blitz rating",
  chest: "Chest",
  arrives: "Arrives with the results",
  open: "Open",
  inCollection: "In your collection",
  traded: "In another collection",
  cosmetic: "Cosmetic",
  lords: "LORDS",
  lordsSent: "Sent to the wallet that opened it",
  swordCredit: "Sword credit",
  shieldCredit: "Shield credit",
  nextEntry: "Used at your next entry",
  /**
   * A chest's rank band (0 best .. 4), the one fact it shows sealed: the ledger's five equal fifths of the game's
   * finishing order (contracts/l2/ledger/src/chests.cairo `rank_band`).
   */
  band: ["Top 20%", "Top 40%", "Top 60%", "Top 80%", "Bottom 20%"],
  opening: "Opening…",
  /** A requested chest's draw, waiting for new Starknet blocks before it can be finished. */
  draw: "Draw",
  blocksLeft: (blocks: number) => (blocks === 1 ? "1 block to go" : `${blocks} blocks to go`),
  /** A sealed chest's token reward, as a multiple of its slot's entry: what it can pay, and until when. */
  entryUntil: (shares: number, date: string) => `${shares}× entry until ${date}`,
  /** Under an opened chest's multiple: "4×" of the entry. */
  theEntry: "the entry",
  noLords: "No LORDS now",
} as const;

/** The Blitz season's prize, on Blitz's rating board. */
export const SEASON_PRIZE_WORDS = {
  unreadable: "The season's prize could not be read.",
  pool: "Prize pool",
  ends: (date: string) => `Ends ${date}`,
  final: "Final",
  paysToday: "If the season ended now",
  placesPaid: (count: number) => `${formatCount(count, "place")} paid`,
  noPlaces: "No place is paid before ranking.",
  yourShare: "Your share",
  review: "Claims open in",
  held: "The list is being checked",
  claimed: "Claimed to your seat's wallet",
  /** The ledger takes no claim while its payouts are paused. */
  paused: "Payouts are paused",
  notPaid: "Outside the paid places this season",
  claim: "Claim",
} as const;

/** The three alert levels (ruled). */
export const LEVEL_WORDS = { off: "Off", important: "Important", all: "All" } as const;

/** Each kind of alert as Settings names it in a level's line. */
export const NOTIFICATION_KIND_WORDS = {
  "day-open": "each day's opening",
  "army-rested": "rested armies",
  fights: "fights",
  results: "results",
  messages: "messages",
  deliveries: "deliveries",
  bitcoin: "Bitcoin payouts",
  points: "Hyperstructure points",
} as const satisfies Record<NotificationKind, string>;

/** Kinds of alert as one list, in the table's order ("fights, results and messages"). */
const kindsList = (kinds: readonly NotificationKind[]): string => {
  const named = kinds.map((kind) => NOTIFICATION_KIND_WORDS[kind]);
  return named.length === 1 ? named[0]! : `${named.slice(0, -1).join(", ")} and ${named.at(-1)}`;
};

/**
 * What a level brings, in one line under the levels: the kinds it carries beyond the level below it, as the kinds table
 * gives them ("Important, plus deliveries, …").
 */
export const levelLine = (kinds: readonly NotificationKind[], below: NotificationLevel | null): string => {
  if (kinds.length === 0) return "No alerts";
  const list = kindsList(kinds);
  return below === null || below === "off"
    ? `${list.charAt(0).toUpperCase()}${list.slice(1)}`
    : `${LEVEL_WORDS[below]}, plus ${list}`;
};

/** What's new: its patch notes, and the legal pages' date. */
export const NEWS_WORDS = {
  updated: "Updated",
  /** A release's notes for players, one section per mode. */
  patchNotes: "Patch notes",
  /** A release's first section: what changed in every mode. */
  allModes: "All modes",
  /** The kinds of change a mode's section groups. */
  kinds: { new: "New", balance: "Balance", fix: "Fixes" },
  /** Every release's notes, newest first. */
  releases: "Releases",
  /** The link from the patch notes to the game's full rules, on the docs site. */
  fullRules: "Full rules",
} as const;

/** The app's own states: install, update, offline, a page that does not exist. */
export const APP_STATE_WORDS = {
  install: "Install",
  /** The install notice's name for assistive technology: where the app will live (its icon and Install say it on screen). */
  onHomeScreen: "Realms on your home screen",
  updateReady: "Update ready",
  update: "Update",
  updating: "Updating…",
  nothingHere: "Nothing here",
  /** The browser's own words, quoted on the install steps. */
  share: "Share",
  addToHomeScreen: "Add to Home Screen",
  add: "Add",
  file: "File",
  addToDock: "Add to Dock",
} as const;

// An army's readiness: what it lacks to move, and its warnings.

export const getArmyFoodRequirementLabel = (resolvedWorldMode: ResolvedGameMode): "food" | "wheat" =>
  resolvedWorldMode === "blitz" ? "wheat" : "food";

export const formatArmyFoodRequirement = ({
  missingWheat,
  missingFish,
  wheatLabel,
}: {
  missingWheat: number;
  missingFish: number;
  wheatLabel: string;
}): string => {
  const missingParts = [
    missingWheat > 0 ? `${formatCharge(missingWheat)} ${wheatLabel}` : null,
    missingFish > 0 ? `${formatCharge(missingFish)} fish` : null,
  ].filter(Boolean);

  if (missingParts.length === 0) return "";
  if (missingParts.length === 1) return missingParts[0] ?? "";

  return `${missingParts.slice(0, -1).join(", ")} and ${missingParts[missingParts.length - 1]}`;
};

interface ArmyFoodRequirement {
  wheatPayAmount: number;
  fishPayAmount: number;
}

interface ArmyFoodBalance {
  wheat: number;
  fish: number;
}

interface ArmyFoodRequirementWarning {
  missingWheat: number;
  missingFish: number;
  hasWarning: boolean;
}

const getArmyFoodRequirementWarning = ({
  costs,
  food,
}: {
  costs: ArmyFoodRequirement;
  food: ArmyFoodBalance;
}): ArmyFoodRequirementWarning => {
  const missingWheat = Math.max(0, costs.wheatPayAmount - food.wheat);
  const missingFish = Math.max(0, costs.fishPayAmount - food.fish);

  return {
    missingWheat,
    missingFish,
    hasWarning: missingWheat > 0 || missingFish > 0,
  };
};

export const getArmyMovementFoodRequirementWarnings = ({
  travelFoodCosts,
  exploreFoodCosts,
  food,
}: {
  travelFoodCosts: ArmyFoodRequirement;
  exploreFoodCosts: ArmyFoodRequirement;
  food: ArmyFoodBalance;
}) => {
  const travel = getArmyFoodRequirementWarning({ costs: travelFoodCosts, food });
  const explore = getArmyFoodRequirementWarning({ costs: exploreFoodCosts, food });

  return {
    travel,
    explore,
    combined: {
      missingWheat: Math.max(travel.missingWheat, explore.missingWheat),
      missingFish: Math.max(travel.missingFish, explore.missingFish),
      hasWarning: travel.hasWarning || explore.hasWarning,
    },
  };
};

export const getArmyStaminaRequirementWarnings = ({
  currentStamina,
  minTravelStamina,
  minExploreStamina,
}: {
  currentStamina: number;
  minTravelStamina: number;
  minExploreStamina: number;
}): { hasTravelStaminaWarning: boolean; hasExploreStaminaWarning: boolean } => ({
  hasTravelStaminaWarning: currentStamina < minTravelStamina,
  hasExploreStaminaWarning: currentStamina < minExploreStamina,
});

export const getArmyReadinessTitle = ({
  hasTravelStaminaWarning,
  hasExploreStaminaWarning,
  hasTravelFoodWarning,
  hasExploreFoodWarning,
}: {
  hasTravelStaminaWarning: boolean;
  hasExploreStaminaWarning: boolean;
  hasTravelFoodWarning: boolean;
  hasExploreFoodWarning: boolean;
}): string => {
  const travelBlocked = hasTravelStaminaWarning || hasTravelFoodWarning;
  const exploreBlocked = hasExploreStaminaWarning || hasExploreFoodWarning;

  if (travelBlocked && exploreBlocked) return "Travel and explore blocked";
  if (travelBlocked) return "Travel blocked";
  if (exploreBlocked) return "Explore blocked";

  return "Ready to travel or explore";
};

/** Tooltip for a movement-blocked stamina bar; null when travel is possible. */
export const formatTravelBlockedSummary = ({
  staminaBlocked,
  minTravelStamina,
  missingWheat,
  missingFish,
  wheatLabel,
}: {
  staminaBlocked: boolean;
  minTravelStamina: number;
  missingWheat: number;
  missingFish: number;
  wheatLabel: string;
}): string | null => {
  const requirements = [
    staminaBlocked ? `${formatCharge(minTravelStamina)}+ stamina` : null,
    formatArmyFoodRequirement({ missingWheat, missingFish, wheatLabel }) || null,
  ].filter(Boolean);

  if (requirements.length === 0) return null;

  return `Cannot travel — needs ${requirements.join(" and ")}`;
};

/** The visible reason food keeps an army still: what one step costs it (a charge) and what its realm holds. */
export const formatFoodBlock = (block: {
  action: "travel" | "explore";
  perStep: ArmyFoodRequirement;
  food: ArmyFoodBalance;
}): string => {
  const part = (amount: number, label: string, write: (amount: number) => string) =>
    amount > 0 ? `${write(amount)} ${label}` : null;
  const cost = [
    part(block.perStep.wheatPayAmount, "wheat", formatCharge),
    part(block.perStep.fishPayAmount, "fish", formatCharge),
  ]
    .filter(Boolean)
    .join(" and ");
  const held = [
    part(Math.max(0, block.food.wheat), "wheat", formatAmount) ??
      (block.perStep.wheatPayAmount > 0 ? "no wheat" : null),
    block.perStep.fishPayAmount > 0 ? (part(Math.max(0, block.food.fish), "fish", formatAmount) ?? "no fish") : null,
  ]
    .filter(Boolean)
    .join(" and ");
  const verb = block.action === "travel" ? "Can't march" : "Can't explore";
  const step = block.action === "travel" ? "each step" : "each explore";
  return `${verb}: ${step} costs ${cost}, has ${held}`;
};

// Relics.

/** "Damage Relic I" reads "Damage I": the word "Relic" is the chip's shape already. */
export const relicShortName = (relicId: ResourcesIds): string => {
  const relic = getRelicInfo(relicId);
  if (!relic) throw new Error(`Resource ${relicId} is not a relic`);
  return relic.name.replace(" Relic", "");
};

/** The title of a window that activates a relic: "Activate Stamina I". */
export const activateRelic = (relicId: ResourcesIds): string => `Activate ${relicShortName(relicId)}`;

/** Who would activate a relic: an army, named by the realm it came from ("Army of Egonal"), or a structure. */
export const relicHolderLine = (isArmy: boolean, home: string | null): string =>
  isArmy ? (home ? `${ARMY} of ${home}` : ARMY) : "Structure";

/** A stamina relic on an army already at full stamina: it speeds a refill the army has not started. */
export const STAMINA_FULL = "Stamina is full";

/** A relic's activation as the game's relic rules set it: what it costs, and how long it works. */
interface RelicActivation {
  essenceCost: number;
  durationSeconds: number;
}

/** What a relic does and for how long: "Increases damage by 20% for 30m". */
export const relicEffectLine = (
  relicId: ResourcesIds,
  { durationSeconds }: Pick<RelicActivation, "durationSeconds">,
) => (durationSeconds > 0 ? `${relicEffect(relicId)} for ${formatDuration(durationSeconds)}` : relicEffect(relicId));

/**
 * The one line every relic's hover says: its name, what it does, for how long, and what activating it costs ("Damage
 * I: Increases damage by 20% for 30m. Costs 500 Essence to activate."); given the Essence its holder can pay with, what
 * it lacks ("Costs 500 Essence to activate; you have 200.").
 */
export const relicLine = (relicId: ResourcesIds, activation: RelicActivation, essenceHeld?: number): string => {
  const short = essenceHeld !== undefined && essenceHeld < activation.essenceCost;
  const pair = formatHeldAgainst(essenceHeld, activation.essenceCost);
  const cost = `Costs ${short ? pair.need : formatCharge(activation.essenceCost)} ${ESSENCE} to activate`;
  const held = short ? `; you have ${pair.held}` : "";
  return `${relicShortName(relicId)}: ${relicEffectLine(relicId, activation)}. ${cost}${held}.`;
};

// A realm's automation.

/** An automation preset's line on hover: "Smart: Production runs itself, spread across the realm's buildings." */
export const presetLine = ({ label, description }: { label: string; description: string }): string =>
  `${label}: ${description}`;

/**
 * Automation with nothing to run: a realm whose only producers are farms and workers' huts holds no row, since Wheat and
 * Labor produce on their own, so the line says that rather than that the realm produces nothing.
 */
export const NOTHING_TO_AUTOMATE = "Nothing to automate yet";

/** Why the realm's automation cannot be changed now; null when it can. */
export const automationRefusal = (ordersAllowed: boolean, hydrated: boolean): string | null => {
  if (!ordersAllowed) return "Only the realm's player can change this";
  if (!hydrated) return "Loading the realm's automation";
  return null;
};

/** A figure's step to the next: "+10% → +25% damage"; with a rank in either, "[I] · +10% → [II] · +25%". */
function figureStep(from: string, to: string): string;
function figureStep(from: RankedWords | string, to: RankedWords | string): RankedWords | string;
function figureStep(from: RankedWords | string, to: RankedWords | string): RankedWords | string {
  if (typeof from === "string" && typeof to === "string") return `${from} → ${to}`;
  return [...asRanked(from), " → ", ...asRanked(to)];
}

/**
 * The castle's tree, read as a tree (the owner's pick, 20 October: "Branches"): its branches, how each node stands,
 * what each side and node gives, and each thing a node's next tier needs, in the order a player meets them.
 */
export const RESEARCH_TREE = {
  /** Said while the realm's knowledge, balances, prices or board rules have not all arrived. */
  onItsWay: "The research tree is on its way",
  branches: { economy: "Economy", army: ARMY, castle: CASTLE },
  states: { ready: "Can research", short: "Saving up", done: "Researched", locked: "Locked" },
  sides: {
    fields: ["Fields", "Farm wheat"],
    granary: ["Granary", "Wheat storage"],
    tools: ["Tools", "Workshop labor"],
    storeroom: ["Storeroom", "Labor storage"],
    drill: ["Drill", "Barracks troops"],
    rations: ["Rations", "Wheat per troop"],
  },
  /** The kinds a Scouting level finds more of; Frontier's camp is its Troll (the shared structure naming rule). */
  kinds: {
    camp: structurePlural(StructureType.Camp, undefined, "frontier"),
    rift: structurePlural(StructureType.Rift, undefined, "frontier"),
    sanctuaries: "Sanctuaries",
  },
  /** A Scouts' lodge kind's side: new armies find more of it. */
  foundMore: "Found more",
  sidesLine: (made: string) => `Improve ${made} output and storage separately`,
  hutLine: "Hut population",
  population: "Population",
  gateLine: "Opens the 4 training buildings",
  gateOpen: "Training buildings open",
  gate: (barracks: string) => `${barracks} opens`,
  newArmiesStart: (attribute: string) => `New armies start with ${attribute}`,
  /** A training building's figure, under the attribute's name on its card: what that level is given to. */
  everyNewArmy: "Every new army",
  /** A level and what it gives: "[II] · +10% damage". */
  at: (tier: number, effect: string): RankedWords => [{ rank: tier }, ` · ${effect}`],
  /**
   * What an attribute gives, said as the figure and what it is a figure of, the one wording Research and an army's
   * panel share (the owner, 22 October: by attribute, Homecoming compact): "+10% damage", "3% come home".
   */
  effects: {
    battle: (value: string) => `${value} damage`,
    logistics: (value: string) => `${value} max stamina`,
    scouting: (value: string) => `${value} discovery`,
    homecoming: (value: string) => `${value} come home`,
  },
  nouns: { essence: ESSENCE, labor: LABOR },
  armiesFind: (site: string) => `Armies find ${site}s`,
  each: (gain: string) => `${gain} each`,
  enters: (depth: string) => `Armies enter ${depth} at the spire`,
  opens: "Open",
  build: (building: string) => `Build a ${building}`,
  stands: (building: string) => `${building} stands`,
  first: (what: string) => `${what} first`,
  store: (limit: string, need: string, level: string) => `Labor storage ${limit} / ${need} · ${level}`,
  held: (noun: string, have: string, need: string) => `${noun} ${have} / ${need}`,
  research: (what: RankedWords | string): RankedWords => ["Research ", ...asRanked(what)],
  levelUpCastle: "Level up the castle",
  complete: "Complete",
  step: figureStep,
  price: (essence: string) => `${essence} ${ESSENCE}`,
} as const;

/**
 * An army's detail: status, attributes, the next skill point and level-up choices.
 */
export const ARMY_DETAIL = {
  /** A Scouting effect on the kind its levels went to: "+10% discovery on Rifts". */
  onKind: (effect: string, kind: string) => `${effect} on ${kind}`,
  scoutingNext: (now: string, step: string) => `${now} · ${step} on the kind you pick`,
  /**
   * What each tile the army explores sends home, on its stamina row: Essence or Labor, one of the two each reveal, as
   * the contract draws it (exploration_rewards.cairo's reveal_reward). The chip's name reads the label then the amount.
   */
  revealPays: (amount: string) => `+${amount} a tile`,
  revealPaysLabel: `${ESSENCE} or ${LABOR},`,
  levelUp: "Level up",
  levelUps: "Level-ups",
  /** An attribute tile's hover: what its next tier gives and costs, "Rare: +10% → +20% damage · 200 XP". */
  legendary: (attribute: string) => `${attribute} is legendary`,
} as const;

/** Deleting the picked army, for good. */
export const ARMY_MANAGEMENT = {
  remove: "Delete",
  confirmDelete: "Delete this army?",
  loss: "Its troops, skills, XP and carried resources are lost. Its slot keeps its stamina.",
  deleteFailed: "The army could not be deleted.",
} as const;
