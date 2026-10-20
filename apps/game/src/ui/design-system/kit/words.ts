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
  formatExact,
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
  /** Before the time left to a beginning: "Starts 16:30 · in 2h 4m". */
  in: "in",
} as const;
/** The day-done card: "Day 12 done · Realm kept · Day 13 is open", and its one verb. */
export const DAY_DONE = "done";
export const REALM_KEPT = "Realm kept";
export const DAY_OPEN = "is open";
export const CONTINUE = "Continue";
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
export const MAP = "Map";
export const REALM = "Realm";
export const RESEARCH = "Research";
/** Every event and battle: the Events' history, a phone's place for Events. */
export const LOG = "Log";
export const CHAT = "Chat";
export const MENU = "Menu";

/** The Menu's rows and its two buttons. */
export const TODAY = "Today";
export const PRODUCTION = "Production";
/** A store at its limit. */
export const FULL = "Full";
export const STORE = "Store";
/** On a payout's Full mark: the store took what it had room for. */
export const REST_DID_NOT_FIT = "The store is full: the rest did not fit";
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
  /** A step's verb: the row's reason already names what it builds, or the level it reaches. */
  build: "Build",
  levelUp: "Level up",
  nothingNow: "Nothing to build now",
} as const;
export const EVENTS_WORDS = {
  /** What Events and its Log say while the player's filter holds no story. */
  nothingYet: "Nothing here yet.",
} as const;
export const SETTINGS_WORDS = {
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
export const TRANSFER = "Transfer";
/** A good held whose weight the game has not given: its donkeys cannot be counted, so it cannot be sent. */
export const WEIGHT_UNKNOWN = "Weight unknown: cannot be sent";
/** A player whose name identity could not give: shown as a dash, named so for a screen reader, never the stand-in. */
export const NAME_UNAVAILABLE = "Name unavailable";

/** A realm's room for buildings: every building takes some, a Hut gives some. */
export const POPULATION = "population";
/**
 * Why a verb cannot run yet, in one line that names what is counted: against what the realm holds, against what is
 * free, or against a store's own limit, which no wait fills. A shortfall that fills by itself says when.
 */
export const needsHave = (need: string, noun: string, have: string) => `Needs ${need} ${noun}, have ${have}`;
export const needsFree = (need: string, noun: string, free: string) => `Needs ${need} ${noun}, ${free} free`;
export const needsOverLimit = (need: string, noun: string, limit: string) =>
  `Needs ${need} ${noun}, the store holds ${limit}`;
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
export const needsAt = (building: string, tier: string) => `Needs ${building} at ${tier}`;
/** A training building already standing: a realm holds one of each. */
export const ONE_A_REALM = "Built. A realm holds one.";
/** The arrow beside a price that has risen (a screen reader's words). */
export const PRICE_UP = "price raised";
/** Why a price is above its base, on the arrow beside it: "Base 400 labor, ×5 with 2 standing". */
export const priceRaised = (base: string, noun: string, times: string, standing: string) =>
  `Base ${base} ${noun}, ×${times} with ${standing} standing`;
/** What a building does, in one line on its card's tooltip: "Wheat +5/min". */
export const makes = (noun: string, rate: string) => `${noun} ${rate}`;
export const takesPopulation = (amount: string) => `takes ${amount} ${POPULATION}`;
export const startsNewArmies = (attribute: string, tier: string) => `new armies start with ${attribute} at ${tier}`;
/** The fix for a short store that the map can fill: "Explore for labor". */
export const exploreFor = (noun: string) => `${EXPLORE} for ${noun}`;

/**
 * An army's XP on its tooltip, against the attribute tier it buys next: "XP 8 of 100 · buys an Uncommon attribute
 * tier". XP is a balance an army spends on its attributes; it has no level.
 */
export const xpToward = (held: string, price: string, tier: string) =>
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
  `${site}: ${verdict}, lost ${lost}, guard ${guardBefore} to ${guardAfter}`;
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
  youLose: (troops: string) => `you lose ${troops}`,
  youKill: (troops: string) => `you kill ${troops}`,
  armyLost: "Your army is lost",
  clears: "This attack clears it",
  holds: "The guard holds",
  clearedIn: (attacks: number) =>
    attacks === 1 ? "Cleared in this attack" : `Cleared in ${formatCount(attacks, "attack")}`,
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
export const BUILDINGS = "Buildings";
/** The castle rows that unlock the three reaches beyond the spire. */
export const ETHEREAL = "Ethereal";
export const REACH_NUMERALS = ["I", "II", "III"] as const;
export const RESEARCHING = "Researching…";
export const BUILDING = "Building…";
export const UPGRADING = "Upgrading…";

/** A standing building's figures on its panel, each named on its tooltip (the screen shows icons and numbers). */
export const BUILDING_FIGURES = {
  eachMakes: (noun: string) => `${noun} each makes`,
  castleMakes: (noun: string) => `${noun} the castle makes`,
  standing: "standing",
  held: (noun: string) => `${noun} held of its store's limit`,
  eachAdds: `${POPULATION} each adds`,
  eachTakes: `${POPULATION} each takes`,
  startsAt: (attribute: string) => `${attribute} new armies start at`,
} as const;

/** A slider's two ends, each a button: the least and the most the player can choose. */
export const MINIMUM = "Minimum";
export const MAXIMUM = "Maximum";

/**
 * How far the wheat left at home after a deploy lets the new army march (each troop eats wheat a tile), short: a scout
 * eats so little that its reach runs to thousands.
 */
export const marchLine = (tiles: number) =>
  tiles === 0
    ? `Leaves no ${WHEAT} to march`
    : `Leaves wheat to march ${tiles === 1 ? "1 tile" : `${formatAmount(tiles)} tiles`}`;

/**
 * The stamina a new army starts on, which its army slot holds (the owner, 20 October 2026: "stamina is slot tied"):
 * full when the slot is fresh today, else the bar the slot's last army left. `bar` is "7/150".
 */
export const startsOn = (army: string, bar: string, fresh: boolean) =>
  fresh ? `${army} starts full: ${bar} ${STAMINA}` : `${army} starts on ${bar} ${STAMINA}`;
export const slotBarWhy = (fresh: boolean) => (fresh ? "Its slot is fresh today" : "The bar its slot's last army left");

/** Raise an army from troops at home; with none, the realm's Barracks trains them. */
export const DEPLOY = "Deploy";
export const NO_TROOPS_AT_HOME = "No troops at home";
export const DEPLOYING = "Deploying…";
export const BUILD = "Build";

/** Default army names: "Army" and its place. */
export const ARMY = "Army";
/** A realm's armies, as a list's name. */
export const ARMIES = "Armies";
/** How many troops an army holds: "1 troop", "5,000 troops". */
export const troopCount = (count: number) => formatCount(count, "troop", TROOPS);

/** The day log's lines for what the player did, in the names the build cards and the dock use. */
export const revealLine = (amount: string, resource: string) => `+${amount} ${resource}`;
export const builtLine = (building: string) => `${building} built`;
export const deployedLine = (army: string) => `${army} deployed`;
export const disbandedLine = (army: string) => `${army} disbanded`;
/** A day's count of tiles explored, on its total. */
export const REVEALS = "Reveals";
/** How deep a season went, on its total. */
export const REACH = "Reach";

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
export const BACK = "Back";

/** Looking at another realm, and stopping. */
export const VISIT = "Visit";
export const LEAVE = "Leave";

/** Filling an army's stamina for LORDS, a full refill only. */
export const REFILL = "Refill";
export const REFILLING = "Refilling…";

/** LORDS leaving the game for the wallet linked to the account. */
export const WITHDRAW = "Withdraw";
export const SENDING = "Sending…";
export const LINK_WALLET = "Link wallet";
export const NO_WALLET = "No wallet linked";
export const TRANSACTION = "Transaction";
export const PAYOUTS_PAUSED = "Payouts paused. Your LORDS stay here.";
export const paidWhenResumed = (amount: string) => `Payouts paused. These ${amount} pay when they resume.`;
/** The season's last hour of withdrawals is kept for paying the ones already made. */
export const WITHDRAWALS_CLOSED = "Withdrawals have closed for this season.";
/** After the season, on its last card: the moment its withdrawals close. */
export const withdrawUntil = (moment: string) => `Withdraw until ${moment}`;
export const PAYOUTS_UNREADABLE = "Payouts cannot be read right now. Your LORDS stay here.";
/** A withdrawal with no answer from the game: it may still apply, so it is never sent again on its own. */
export const withdrawalUnknown = (amount: string) =>
  `No answer yet for these ${amount}: the withdrawal may still apply. Your LORDS show it once it does.`;

/** The labor a player's Realms give once a game day. */
export const REALMS = "Realms";
/**
 * What the Realms sheet is for, at its head whatever it holds (live-qa-night-1 P3-3: with no wallet linked it said only
 * "No wallet linked"): each Realm the linked wallet holds gives labor once a game day, up to the day's cap (0: none).
 */
export const realmsGiveLabor = (perRealm: number, cap: number) =>
  `Each Realm in your Starknet wallet gives ${formatExact(perRealm)} ${LABOR} a day${cap > 0 ? `, up to ${formatCount(cap, "Realm")}` : ""}.`;
export const CLAIM = "Claim";
export const CLAIM_ALL = "Claim all";
export const CLAIMED_TODAY = "Claimed today";
/** The Season page's pool: the LORDS deposited for the season; what today releases of them stands under Today. */
export const SEASON_POOL = "Pool";
export const POOL_NOT_PUBLISHED = "Pool not published yet";
/** What one share of a chest pays today, and the most any day can set that price to. */
export const PER_SHARE = "Per share";
export const SHARE_CEILING = "Max";
export const fitOf = (fits: string, of: string) => `${fits} of ${of} fit`;
export const REALMS_ELSEWHERE = "Only Realms in this Starknet wallet count. Not on Ethereum, not in another wallet.";
/** A Realm joins the list by its number, the first time it gives its labor. */
export const ADD_REALM = "Add a Realm";
export const REALM_NUMBER = "Realm number";
/** A Realm the account claimed labor with before, which the linked wallet no longer holds. */
export const REALM_NOT_IN_WALLET = "Not in this wallet";
export const REALM_NOT_CLAIMED = "That Realm is not in your wallet, or it gave its labor today.";
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
export const PITCH = "A new land every day. Your realm keeps what it earns.";

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
} as const;

/** Blitz's rows and lobby: the steps on Join, the seat's cost, and what stands where an action cannot. */
export const BLITZ_WORDS = {
  /**
   * Blitz's column with no Blitz at all (live-qa-night-1 P3-12: it vanished once an ended one's results were seen). An
   * operator opens each slot; none is set ahead, so the next one shows here when it opens.
   */
  noneScheduled: "No Blitz scheduled. The next one shows here when it opens.",
  preparing: "Preparing…",
  /** Shown only to assistive technology; the seats are drawn. */
  seats: "Seats",
  registered: "Registered",
  registeredUnit: "registered",
  /** Under a slot's registered count: why it has no seats yet. */
  drawnAtClose: (seats: number) => `No cap. Games of up to ${seats} are drawn when entry closes.`,
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
  rateLimited: "A few messages a second at most. Wait a moment.",
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
  deviceLimit: "This account is signed in on 8 devices.",
  deviceLimitRecovery: "On an already signed-in device, open Settings → Devices and remove one. Then try again here.",
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
  boardEmpty: "No realm on the board yet. Found one from Play.",
  /** A player with no realm on Frontier's board this season. */
  notOnBoard: "Not on Frontier's board yet",
} as const;

/** The Blitz rating (MMR): its panel's words. The rating is automatic at settlement; nothing here asks for it. */
export const RATING_WORDS = {
  rating: "Rating",
  blitzRating: "Blitz rating",
  /** A Realms account with no linked wallet carries no rating (not 0, not 1000). */
  unlinked: "Link a wallet in Settings to carry a rating.",
  /** Blitz's board before anyone has a rating. */
  noneRated: "No one has a rating yet. A paid Blitz gives one.",
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
  signOutCost: "This device forgets your account until you sign in again.",
  remove: "Remove",
  removing: "Removing…",
  removeAsk: (device: string) => `Remove ${device}?`,
  removeCost: "It signs out there and cannot enter a game until it signs in again.",
  thisDevice: "This device",
  /** A device the account knows but that has no name yet. */
  device: (lastFour: string) => `Device ${lastFour}`,
  deviceRemoved: "This device was removed",
  blocked: "Blocked",
  blockedLine: "The browser blocks alerts for Realms. Allow them in its site settings.",
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
  keysStay: "Ready's own page; your keys stay with Ready",
  emailStep: "Email and password, on Ready's page",
  approveStep: "Approve Realms",
  codeStep: "Signature, then our code",
  backFromReady: "Added Ready? Reload this page, then link it.",
  anotherWallet: "Another wallet",
  codeSentTo: "Code sent to",
  sending: "Sending…",
  newCode: "New code",
  confirmInWallet: "Confirm in your wallet",
  canReceive: "Ready",
  replace: "Replace",
  unlink: "Unlink",
  unlinkTitle: "Unlink wallet",
  nothingPaysOut: "Nothing pays out until a wallet is linked",
  opening: "Opening…",
  noneHere: "No wallet this browser can open. Ready by email needs none.",
  wrongWallet: (owner: string) => `Open ${owner}: only that wallet can sign this.`,
  paymentFailed: "The wallet did not confirm it. Check it, then try again.",
  tryAgain: "Try again",
  whichHolds: (owner: string) => `Which wallet holds ${owner}?`,
} as const;

/** What every value screen shares: a fee the payout wallet cannot pay yet. */
export const VALUE_WORDS = {
  confirming: "Confirming…",
  unconfirmed: "The network did not confirm it. Check again in a moment.",
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
  openingLine: "Entry is opening. It will be ready in a moment.",
  registeredLine: "Your seat is drawn when entry closes.",
  /** Past the close, until a game's roster names the wallet. */
  drawingLine: "Entry has closed. Your seat is being drawn.",
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
  closedLine: "Entry has closed; this slot takes no more players.",
  refundedLine: "Your LORDS and credits are back in your wallet.",
  unreadable: "This game's paid entry could not be read, so it cannot be joined yet.",
  whereItGoes: "Where this entry goes: the season pool, the season's chests, the treasury",
} as const;

/**
 * A dev build only: the test token its ledger is paid in, minted to the wallet that pays. A word of its own, outside
 * the entry's table, so a production build drops it with the button.
 */
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
  noPlaces: "No place is paid until players are ranked.",
  yourShare: "Your share",
  review: "Claims open in",
  held: "The list is being checked",
  claimed: "Claimed to your seat's wallet",
  /** The ledger takes no claim while its payouts are paused. */
  paused: "Payouts are paused. Your share can be claimed when they resume.",
  notPaid: "Outside the paid places this season",
  claim: "Claim",
} as const;

/** The three alert levels (ruled) and what each carries, in one line. */
export const LEVEL_WORDS = {
  off: { word: "Off", line: "Nothing" },
  important: { word: "Important", line: "Your day ends in an hour, your Blitz starts, a message to you" },
  all: { word: "All", line: "Plus every clear, fight and build" },
} as const;

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
  return `${verb}: ${step} costs ${cost}; the realm has ${held}.`;
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
export const STAMINA_FULL = {
  line: "Stamina is full",
  why: "This relic speeds the refill: it helps only if the army spends stamina while it works",
} as const;

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
export const NOTHING_TO_AUTOMATE =
  "Nothing to automate here yet: Wheat and Labor produce on their own. Build a resource building to automate what it makes.";

/** Why the realm's automation cannot be changed now; null when it can. */
export const automationRefusal = (ordersAllowed: boolean, hydrated: boolean): string | null => {
  if (!ordersAllowed) return "Only the realm's player can change its automation";
  if (!hydrated) return "Loading the realm's automation";
  return null;
};

/**
 * The castle's tree, read as a tree (the owner's pick, 20 October: "Branches"): its branches, how each node stands,
 * what each side and node gives, and each thing a node's next tier needs, in the order a player meets them.
 */
export const RESEARCH_TREE = {
  branches: { economy: "Economy", army: ARMY, castle: CASTLE },
  states: { ready: "Can research", short: "Saving up", done: "Researched", locked: "Locked" },
  sides: {
    fields: ["Fields", "Wheat from every Farm"],
    granary: ["Granary", "The castle's wheat store"],
    tools: ["Tools", "Labor from every Workshop"],
    storeroom: ["Storeroom", "The castle's labor store"],
    drill: ["Drill", "Troops from every Barracks"],
    rations: ["Rations", "Wheat a deployed troop costs"],
  },
  /** The kinds a Scouting level finds more of; Frontier's camp is its Troll (the shared structure naming rule). */
  kinds: { camp: structurePlural(StructureType.Camp, undefined, "frontier"), rift: "Rifts", beasts: "Beasts" },
  foundByNewArmies: (kind: string) => `${kind} found by new armies`,
  sidesLine: (made: string) => `Each tier picks a side for the season: more ${made}, or store more`,
  sideKept: "The side is kept for the season.",
  hutLine: "Population from every Hut",
  gateLine: (tier: string) => `${tier} opens the four training buildings`,
  gateOpen: "The four training buildings are open",
  gate: (tier: string) => `${tier} opens`,
  newArmiesStart: (attribute: string) => `New armies start with ${attribute}`,
  /** A level and what it gives: "Uncommon · +10% damage". */
  at: (tier: string, effect: string) => `${tier} · ${effect}`,
  effects: {
    battle: (value: string) => `${value} damage`,
    logistics: (value: string) => `${value} max stamina`,
    scouting: (value: string) => `${value} sites found`,
    homecoming: (value: string) => `${value} of troops back home`,
  },
  nouns: { essence: ESSENCE, labor: "Labor" },
  armiesFind: (site: string) => `Armies find ${site}s`,
  each: (gain: string) => `${gain} each`,
  enters: (reach: string) => `Armies enter ${reach} at the spire`,
  reach: (numeral: string) => `${ETHEREAL} ${numeral}`,
  opens: "Open",
  build: (building: string) => `Build a ${building}`,
  stands: (building: string) => `${building} stands`,
  first: (what: string) => `${what} first`,
  store: (limit: string, need: string, level: string) => `Labor store ${limit} / ${need} · a ${level} holds it`,
  held: (noun: string, have: string, need: string) => `${noun} ${have} / ${need}`,
  research: (what: string) => `Research ${what}`,
  levelUpCastle: "Level up the castle",
  complete: "Legendary · complete",
  step: (from: string, to: string) => `${from} → ${to}`,
  price: (essence: string) => `${essence} ${ESSENCE}`,
} as const;

/**
 * An army's detail (the owner's pick, 20 October: "For the army C is best"): its figures, its XP and how it is earned,
 * then its level-ups, one step on.
 */
export const ARMY_DETAIL = {
  stats: {
    battle: "Damage dealt",
    logistics: "Max stamina",
    scouting: "Sites found",
    homecoming: "Troops back at the day's end",
  },
  onKind: (value: string, kind: string) => `${value} ${kind}`,
  scoutingNext: (now: string, step: string) => `${now} · ${step} on the kind you pick`,
  earn: {
    explore: "Explore a tile",
    shrine: "Visit a Shrine",
    clear: `Clear a ${structureName(StructureType.Camp, undefined, "frontier")}: more for a stronger guard`,
  },
  /** What each tile the army explores sends home, on its stamina row. */
  revealPays: (amount: string) => `+${amount} a tile`,
  revealPaysLabel: `${ESSENCE} and ${LABOR} each tile explored sends home`,
  ready: (count: number) => `${formatCount(count, "level-up")} ready`,
  toNext: (xp: string) => `${xp} ${XP} to the next level-up`,
  allLegendary: "Every attribute is legendary",
  levelUp: "Level up",
  levelUps: "Level-ups",
  levelUpReady: (count: number) => `Level up · ${count} ready`,
  price: (xp: string) => `${xp} ${XP}`,
  short: (xp: string, short: string) => `${xp} ${XP} · ${short} ${XP} short`,
  refills: (xp: string, stamina: string) => `${xp} ${XP} · refills ${stamina} ${STAMINA}`,
  legendary: (attribute: string) => `${attribute} is legendary`,
  from: (attribute: string, from: string, to: string) => `${attribute} ${from} → ${to}`,
} as const;
