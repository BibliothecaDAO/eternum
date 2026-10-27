/**
 * The client's phrases (the glossary, frontier-narrative-2026-10/glossary.html, ruled final 7 October 2026, and every
 * screen's words), each spelled once. A screen that needs one imports it from here; nothing else spells it. The rules
 * every client and core's story text share (nouns, numbers, times, names, the voice) are @bibliothecadao/types' words.
 */
import type { ResolvedGameMode } from "@/config/game-modes/resolved-mode";
import {
  BuildingType,
  buildingName,
  formatAmount,
  formatCount,
  formatClockTime,
  formatDuration,
  getRelicInfo,
  relicEffect,
  type ResourcesIds,
  formatCharge,
  resourceName,
  formatHeldAgainst,
  structureName,
  structurePlural,
  StructureType,
} from "@bibliothecadao/types";

/** One scale for chests, building types and attributes. */
export const TIER_WORDS = ["Common", "Uncommon", "Rare", "Epic", "Legendary"] as const;
/** A step on that scale, common (1) to legendary (5). */
export type Tier = 1 | 2 | 3 | 4 | 5;
/** A tier by its numeral, Common I to Legendary V. */
const TIER_NUMERALS = ["I", "II", "III", "IV", "V"] as const;
export const tierNumeral = (tier: Tier): string => TIER_NUMERALS[tier - 1]!;

/** Species names shared by Frontier's models, plates and selected-site cards. */
export { BEAST_NAMES } from "@bibliothecadao/types";
export const BEAST = "Beast";

export const LEFT = "left";
export const DAY = "Day";

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

export const XP = "XP";
export const ESSENCE = "Essence";
export const LABOR = "labor";
export const WHEAT = "wheat";
export const TROOPS = "troops";
export const STAMINA = "stamina";

/** The HUD's tab for everything the player holds. */
export const EMPIRE = "Empire";
/** The places: the nav's words. */
const MAP = "Map";
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
export const REST_DID_NOT_FIT = "Storage full: the rest did not fit";
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
  yourOrders: "Your build orders",
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
  count: (goal: string) => `How many: ${goal}`,
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
  /** Each goal as its card and palette name it. */
  goals: {
    farm: "Farm",
    wood: "Wood camp",
    coal: "Coal mine",
    copper: "Copper mine",
    hut: "Worker hut",
    barracks: "Barracks",
    army: "Deploy army",
    levelUp: "Level up",
  },
} as const;
export const EVENTS_WORDS = {
  /** What Events and its Log say while the player's filter holds no story. */
  nothingYet: "Nothing here yet.",
  /** Frontier's one feed in its rail: the world's history, and lenses on it. */
  feed: "Feed",
  /** Its ×: the Feed goes and leaves its place empty; its place opens it again. */
  closeFeed: "Close the feed",
  /** The lenses' group, for assistive technology: Events, the Log and the Feed alike. */
  lens: "Show",
  lenses: { important: "Important", all: "All" },
  lensTips: {
    important: "Your fights and captures, armies lost, crates you opened and a Hyperstructure taken by anyone",
    all: "Everything players do in the world",
  },
  /**
   * Frontier's Feed: its default first, and Important called Mine, since a Frontier game has no Hyperstructure and the
   * lens holds only the player's own (owner, 27 October: "important (which is mine, not important tbh)").
   */
  feedLenses: { all: "All", important: "Mine" },
  feedLensTips: {
    all: "Everything players do in the world",
    important: "Your fights, captures and chests",
  },
  failed: "Event history could not load.",
} as const;
export const SETTINGS_WORDS = {
  app: "App",
  shortcuts: "Keyboard shortcuts",
  show: "Show",
} as const;
export const EXIT = "Exit";
export const RESUME = "Resume";
export const SIGN_IN = "Sign in";

/** An army's two ways across the map, and backing out of an order. */
export const EXPLORE = "Explore";
export const MOVE = "Move";
/** What a desktop order's preview says under its verb: the right-click sends an order with no preview. */
export const RIGHT_CLICK_SENDS = "A right-click sends it at once.";
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
/** A training building waits for the Barracks' tier: "Needs Barracks at Rare". */
/** A building that waits on another's tier, by its numeral: "Needs Barracks III". */
export const needsTier = (building: string, numeral: string) => `Needs ${building} ${numeral}`;
/** A training building already standing: a realm holds one of each. */
export const ONE_A_REALM = "Built. A realm holds one.";
/** The arrow beside a price that has risen (a screen reader's words). */
export const PRICE_UP = "price raised";
/** Why a price is above its first, on the arrow beside it, in one line and no sum: "Costs more with each one standing: 2". */
export const priceRaised = (standing: string) => `Costs more with each one standing: ${standing}`;
/** A market's price for one unit, as a shop says it, never as an equation: "0.03 LORDS each". */
export const priceEach = (price: string, currency: string) => `${price} ${currency} each`;
/** What a building does, in one line on its card's tooltip: "Wheat +5/min". */
export const makes = (noun: string, rate: string) => `${noun} ${rate}`;
export const takesPopulation = (amount: string) => `takes ${amount} ${POPULATION}`;
/** What a training building gives, by its tier's numeral: "new armies start with Battle II". */
export const startsNewArmies = (attribute: string, numeral: string) => `new armies start with ${attribute} ${numeral}`;

/**
 * An army's XP on its tooltip, against the attribute tier it buys next: "XP 8 of 100 · buys an Uncommon attribute
 * tier". XP is a balance an army spends on its attributes; it has no level.
 */
export const xpTowardTip = (held: string, price: string, tier: string) =>
  `${XP} ${held} ${OF} ${price} · buys ${/^[AEIOU]/.test(tier) ? "an" : "a"} ${tier} attribute tier`;
/** The four attributes, each wearing its Aspect's mark. */
export const ATTRIBUTES = ["Battle", "Logistics", "Scouting", "Homecoming"] as const;

/** The sites on the map, as their cards title them, and the verbs they take. */
export const RIFT = "Rift";
export const RUIN = "Ruin";
/** A map plate's words: a thing with no guard, the troops on their way to one. */
export const UNDEFENDED = "Undefended";
export const ARRIVING = "Arriving";
/** A done site, and the chests the clears paid (screen-reader words; the screen shows Fl and Ch). */
export const CLEARED = "Cleared";
export const CHESTS = "Chests";
export const BEASTS = "Beasts";
export const SHRINE = "Shrine";
export const WELL = "Well";
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
/** Why an attack cannot run, or what it costs, in one line under its button. */
export const needsStamina = (need: string, held: string) => `Needs ${need} stamina, has ${held}`;
export const tooFarFrom = (site: string) => `Too far from the ${site}`;
export const ARMY_WILL_BE_LOST = "Army will be lost";
/** The skull beside an army on a site's card, on its tooltip. */
export const WOULD_BE_LOST = "Would be lost";
/**
 * A site's fight card, read as its result will read (the owner's pick, 20 October 2026: "A for the fight"): what this
 * attack does to each side, what it comes to, and under Details the whole fight's figures.
 */
export const FIGHT_WORDS = {
  armyLost: "Your army is lost",
  /** An attack that clears the site, over the reward it earns; a site that pays nothing is only cleared. */
  earns: "This attack earns",
  clears: "This attack clears it",
  holds: "The guard holds",
  details: "Details",
  wholeFight: "The whole fight",
  attacks: "Attacks",
  lose: "You lose",
  kill: "You kill",
  stamina: "Stamina",
  ends: { wins: "The guard falls", loses: "The army falls", stalls: "Neither side falls" },
} as const;
export const USE = "Use";
export const USING = "Using…";

/** Making something you own better: the castle a level, a building type a tier, an army an attribute tier. */
export const UPGRADE = "Upgrade";

/** The realm: its castle and levels, its buildings, and the row that counts a full realm's common buildings. */
export const CASTLE = "Castle";
export const FARM = buildingName(BuildingType.ResourceWheat, true);
export const WORKSHOP = buildingName(BuildingType.ResourceLabor, true);
export const BARRACKS = buildingName(BuildingType.ResourceKnightT1, true);
export const HUT = buildingName(BuildingType.WorkersHut, true);
export const TRAINING_BUILDINGS = [
  buildingName(BuildingType.WarHall, true),
  buildingName(BuildingType.SupplyYard, true),
  buildingName(BuildingType.ScoutsLodge, true),
  buildingName(BuildingType.Hearth, true),
] as const;
/** The castle rows that unlock the three depths beyond the spire. */
const ETHEREAL = "Ethereal";
export const DEPTH_NUMERALS = ["I", "II", "III"] as const;
/** A depth by its name: "Ethereal II". */
export const depthName = (depth: 1 | 2 | 3): string => `${ETHEREAL} ${DEPTH_NUMERALS[depth - 1]}`;

/**
 * A realm's spire, its card's words: whose it is, the army it acts for, each depth's entry or why not, and what entering
 * commits that army to.
 */
export const SPIRE_WORDS = {
  title: "Spire",
  enter: "Enter",
  foreign: "Another realm's spire",
  pickArmy: "Select an army beside the spire",
  away: (army: string) => `${army} must be beside the spire`,
  inDepth: (army: string, depth: string) => `${army} is in ${depth} today`,
  cost: (stamina: string) => `${stamina} ${STAMINA}`,
  needs: (need: string, have: string) => `Needs ${need} ${STAMINA}, has ${have}`,
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
  standing: "standing",
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
/** Every tile beside the realm holds something: a deploy has nowhere to step out. */
export const NO_OPEN_TILE = "No open tile beside the realm";
/** A site's card with no army selected: what an army does there, or, with none out, where one comes from. */
export const PICK_AN_ARMY = { attack: "Pick an army to attack it", use: "Pick an army to use it" } as const;
export const NO_ARMY_OUT = "No army out: deploy one";
export const DEPLOYING = "Deploying…";
/** A free slot after the lowest: the game fills the lowest free slot first. */
export const DEPLOY_FILLS_FIRST = (number: number) => `Deploy fills slot ${number} first.`;
export const BUILD = "Build";

/** Default army names: "Army" and its place. */
export const ARMY = "Army";

/** A phone's picked army, in its action row (owner, 22 October 2026: mobile direction A): its details' button. */
export const PICKED_ARMY = {
  details: (army: string) => `${army}: details`,
  letGo: (army: string) => `Let go of ${army}`,
} as const;

/** Troops between two of the realm's armies side by side (Frontier's Transfer troops, desktop and phone). */
export const TRANSFER_TROOPS = {
  title: "Transfer troops",
  waiting: "Waiting for both armies’ progress.",
  stale: "The armies changed: review the merge",
  merge: (army: string) => `Merge into ${army}`,
  /** The second press of a merge that loses a lot: the XP lost, as the leaving army's card strikes it, and the merge. */
  confirmMerge: (lost: number, army: string) => `Lose ${formatAmount(lost)} XP, merge into ${army}`,
  amount: (from: string, to: string) => `Troops ${from} sends to ${to}`,
  pick: "Pick how many to send",
  move: (count: number, to: string) => `Move ${formatAmount(count)} to ${to}`,
  sending: "Moving…",
  cap: (cap: number) => `An army holds at most ${formatAmount(cap)}.`,
  unalike: (picked: string, tapped: string) => `${picked} and ${tapped} hold different troops`,
  failed: "The troops could not be moved.",
  changed: "The armies' troops changed",
  /** A phone's action row, a tap on another of the realm's armies beside the picked one. */
  beside: (tapped: string, picked: string) => `${tapped} stands beside ${picked}.`,
  pickArmy: (army: string) => `Pick ${army}`,
} as const;
/** A realm's armies, as a list's name. */
export const ARMIES = "Armies";
/** The day-done card's count of the armies that ended with the day. */
export const ARMIES_ENDED = "Armies ended with the day";
/** How many troops an army holds: "1 troop", "5,000 troops". */
export const troopCount = (count: number) => formatCount(count, "troop", TROOPS);
/** Why research raises a building's output, without the calculation behind it. */
export const fromResearch = (share: string, side: string) => `${share} from ${side}`;
/** The sources of a store's production, each with its combined rate. */
export const MADE_BY = "Made by";
export const STORE_MAKERS = {
  buildings: (count: string, total: string) => `${count} · ${total}`,
  castle: (rate: string) => `${CASTLE} · ${rate}`,
};
/** What an army's Homecoming sends home when the day ends, on its row or token in the day's last hour. */
export const comesHomeAtDayEnd = (troops: string) => `${troops} come home when the day ends`;

/** The day log's lines for what the player did, in the names the build cards and the dock use. */
export const revealLine = (gain: string, resource: string) => `${gain} ${resource}`;
export const builtLine = (building: string) => `${building} built`;
export const deployedLine = (army: string) => `${army} deployed`;
export const disbandedLine = (army: string) => `${army} disbanded`;
/** A day log line with the XP its story gave or spent: "+98 labor, +2 XP", "Battle Uncommon, −100 XP". */
export const xpGainedLine = (line: string, amount: string) => `${line}, +${amount} ${XP}`;
export const xpSpentLine = (line: string, amount: string) => `${line}, −${amount} ${XP}`;
/** A day's count of tiles explored, on its total. */
export const REVEALS = "Reveals";
/** How deep a realm went beyond the spire, I to III. */
export const DEPTH = "Depth";

/** The player on any list. */
export const YOU = "You";

/** The season list and its end, told one of two ways (story): the mist lifted, or it grew too strong. */
export const SEASON_OVER = "Season over";

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
export const YOU_PLACED = "You placed";
export const SEASON_ENDINGS = { lifted: "The mist lifted", strong: "The mist grew too strong" } as const;
export const SEASON_ERROR = "Season did not answer.";
export const TODAY_ERROR = "Today did not answer.";
/** A day's totals the player's history cannot give: the read keeps only the newest stories, or did not answer. */
export const DAY_TOTALS_UNKNOWN = "This day's totals are unknown";
export const BACK = "Back";

/** Looking at another realm, and stopping. */
export const VISIT = "Visit";
export const LEAVE = "Leave";

/** Filling an army's stamina for LORDS, a full refill only. */
export const REFILL = "Refill";
/**
 * A refill the realm cannot pay yet, as its chip's name says it: what the LORDS held count against, and why that is the
 * price ("Refill to full: 20 LORDS, one a missing stamina point. The realm holds 0.").
 */
export const refillShort = (held: string, price: string) => `Refill needs ${price} LORDS, has ${held}`;
export const REFILLING = "Refilling…";

/** LORDS leaving the game for the wallet linked to the account. */
export const WITHDRAW = "Withdraw";
export const SENDING = "Sending…";
export const LINK_WALLET = "Link wallet";
export const NO_WALLET = "No wallet linked";
export const TRANSACTION = "Transaction";
export const PAYOUTS_PAUSED = "Payouts paused";
export const paidWhenResumed = (amount: string) => `Payouts paused: ${amount} waiting`;
/** The season's last hour of withdrawals is kept for paying the ones already made. */
export const WITHDRAWALS_CLOSED = "Withdrawals have closed";
/** After the season, on its last card: the moment its withdrawals close. */
export const withdrawUntil = (moment: string) => `Withdraw until ${moment}`;
export const PAYOUTS_UNREADABLE = "Payouts cannot be read right now";
/** A withdrawal with no answer from the game: it may still apply, so it is never sent again on its own. */
export const withdrawalUnknown = (amount: string) => `No answer yet for these ${amount}`;

/** The labor a player's Realms give once a game day. */
export const REALMS = "Realms";
export const CLAIM = "Claim";
export const CLAIM_ALL = "Claim all";
export const CLAIMED_TODAY = "Claimed today";
/** The Season chip's tip: what a common chest pays today, and the pool the season pays chests from. */
export const commonChestPays = (lords: string) => `A Common chest pays ${lords} LORDS today`;
export const seasonPool = (lords: string, today: string | undefined) =>
  `Season pool ${lords} LORDS${today === undefined ? "" : `, ${today} released today`}`;
export const POOL_NOT_PUBLISHED = "Pool not published yet";
export const fitOf = (fits: string, of: string) => `${fits} of ${of} fit`;
export const REALMS_ELSEWHERE = "No Realms in this wallet";
/** A Realm joins the list by its number, the first time it gives its labor. */
export const ADD_REALM = "Add a Realm";
export const REALM_NUMBER = "Realm number";
/** A Realm the account claimed labor with before, which the linked wallet no longer holds. */
export const REALM_NOT_IN_WALLET = "Not in this wallet";
export const REALM_NOT_CLAIMED = "Not in your wallet, or claimed today";
export const realmsADay = (cap: number) => `${cap} a day`;

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
  resume: RESUME,
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

/** The sign-in flow's words: its titles, its two ways in and the steps on its buttons. */
export const SIGN_IN_WORDS = {
  discord: "Discord",
  or: "or",
  email: "Email",
  sendCode: "Send code",
  sending: "Sending…",
  codeSent: "Code sent",
  code: "Sign-in code",
  checking: "Checking…",
  newCode: "New code",
  yourName: "Your name",
  claimName: "Claim name",
  saving: "Saving…",
  portrait: "Portrait",
  /** After Discord, when it finished in another browser (a phone's Safari view, the Discord app's browser). */
  handoff: "Discord finished elsewhere? Enter its code.",
  handoffCode: "Discord code",
  discordAgain: "Try Discord again",
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
  signInToRead: "Sign in to read the lobby's chat.",
  /** A lobby's chat with no message yet. */
  empty: "Nobody has written yet.",
  /** Under the chat of a reader the room does not let write. */
  registeredWrite: "Players registered in this Blitz write here.",
  rateLimited: "Too fast. Wait a moment.",
  refused: "That message was not sent.",
} as const;

/** The doorway into a match: its four steps and what holds it until the player acts. */
export const DOORWAY_WORDS = {
  account: "Account",
  realm: REALM,
  map: MAP,
  play: "Play",
  /** The track, named for assistive technology. */
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
  boardEmpty: "No realm yet. Found one from Play.",
  /** A player with no realm on Frontier's board this season. */
  notOnBoard: "Not on Frontier's board yet",
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
  /** Recent games with none finished yet: the player's own, and another player's. */
  noGamesOwn: "Your finished games will show here.",
  noGames: "No finished games yet.",
  name: "Name",
  portrait: "Portrait",
  signInMethods: "Sign-in",
  discord: "Discord",
  email: "email",
  linkWallet: "Link wallet",
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
  needOne: "I need one",
  needOneLine: "Ready: browser or email",
  needOneLinePhone: "Ready, by email",
  ready: "Ready",
  braavos: "Braavos",
  controller: "Controller",
  extension: "extension",
  byEmail: "by email",
  formerlyArgent: "formerly Argent",
  noInstall: "by email · no install",
  inThisBrowser: "In this browser",
  addExtension: "Add Ready's extension",
  byEmailTitle: "By email",
  noInstallShort: "No install",
  keysStay: "Ready's page; your keys stay there",
  emailStep: "Email and password, on Ready's page",
  approveStep: "Approve Realms",
  codeStep: "Signature, then our code",
  backFromReady: "Added Ready? Reload, then link it.",
  anotherWallet: "Another wallet",
  codeSentTo: "Code sent to",
  sending: "Sending…",
  newCode: "New code",
  confirmInWallet: "Confirm in your wallet",
  canReceive: "Ready",
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
  unconfirmed: "The network has not confirmed it yet",
  refused: "The ledger refused it.",
  noStrk: "No STRK for the fee",
  swapOnAvnu: "Swap on AVNU",
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

/** The test token every environment's ledger is paid in, minted to the wallet that pays. */
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

/** The three alert levels (ruled) and what each carries, in one line. */
export const LEVEL_WORDS = { off: "Off", important: "Important", all: "All" } as const;

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
  /** The install notice's one line: where the app will live. */
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
    fields: ["Fields", "Wheat from every Farm"],
    granary: ["Granary", "The castle's wheat storage"],
    tools: ["Tools", "Labor from every Workshop"],
    storeroom: ["Storeroom", "The castle's labor storage"],
    drill: ["Drill", "Troops from every Barracks"],
    rations: ["Rations", "Wheat a deployed troop costs"],
  },
  /** The kinds a Scouting level finds more of; Frontier's camp is its Troll (the shared structure naming rule). */
  kinds: { camp: structurePlural(StructureType.Camp, undefined, "frontier"), rift: "Rifts", beasts: "Beasts" },
  foundByNewArmies: (kind: string) => `${kind} found by new armies`,
  hutLine: "Population from every Hut",
  population: "Population",
  gateLine: (barracks: string) => `${barracks} opens the four training buildings`,
  gateOpen: "The four training buildings are open",
  gate: (barracks: string) => `${barracks} opens`,
  newArmiesStart: (attribute: string) => `New armies start with ${attribute}`,
  /** A level and what it gives: "Uncommon · +10% damage". */
  at: (tier: string, effect: string) => `${tier} · ${effect}`,
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
  nouns: { essence: ESSENCE, labor: "Labor" },
  armiesFind: (site: string) => `Armies find ${site}s`,
  each: (gain: string) => `${gain} each`,
  enters: (depth: string) => `Armies enter ${depth} at the spire`,
  opens: "Open",
  build: (building: string) => `Build a ${building}`,
  stands: (building: string) => `${building} stands`,
  first: (what: string) => `${what} first`,
  store: (limit: string, need: string, level: string) => `Labor storage ${limit} / ${need} · ${level}`,
  held: (noun: string, have: string, need: string) => `${noun} ${have} / ${need}`,
  research: (what: string) => `Research ${what}`,
  levelUpCastle: "Level up the castle",
  complete: "Complete",
  step: (from: string, to: string) => `${from} → ${to}`,
  price: (essence: string) => `${essence} ${ESSENCE}`,
} as const;

/**
 * An army's detail (the owner's picks, 20 and 22 October): its status, its four attributes as tiles, its XP with how it
 * is earned on its hover, then its level-ups, one step on.
 */
export const ARMY_DETAIL = {
  /** A Scouting effect on the kind its levels went to: "+10% discovery on Rifts". */
  onKind: (effect: string, kind: string) => `${effect} on ${kind}`,
  scoutingNext: (now: string, step: string) => `${now} · ${step} on the kind you pick`,
  earn: {
    explore: "Explore a tile",
    shrine: "Visit a Shrine",
    clear: `Clear a ${structureName(StructureType.Camp, undefined, "frontier")}`,
  },
  /** What each tile the army explores sends home, on its stamina row. */
  revealPays: (amount: string) => `+${amount} a tile`,
  revealPaysLabel: `${ESSENCE} and ${LABOR} a tile`,
  toNext: (xp: string) => `${xp} ${XP} to the next level-up`,
  allLegendary: "Every attribute is legendary",
  levelUp: "Level up",
  levelUps: "Level-ups",
  /** An attribute tile's hover: what its next tier gives and costs, "Rare: +10% → +20% damage · 200 XP". */
  nextTier: (tier: string, change: string, xp: string) => `${tier}: ${change} · ${xp} ${XP}`,
  price: (xp: string) => `${xp} ${XP}`,
  short: (xp: string, short: string) => `${xp} ${XP} · ${short} ${XP} short`,
  refills: (xp: string, stamina: string) => `${xp} ${XP} · refills ${stamina} ${STAMINA}`,
  legendary: (attribute: string) => `${attribute} is legendary`,
} as const;
