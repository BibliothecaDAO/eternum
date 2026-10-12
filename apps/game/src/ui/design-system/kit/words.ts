/**
 * The glossary's words the kit draws (frontier-narrative-2026-10/glossary.html, ruled final 7 October 2026), each spelled
 * once. A screen that needs one of these words imports it from here; nothing else spells it.
 */

/** One scale for chests, building types and attributes. */
export const TIER_WORDS = ["Common", "Uncommon", "Rare", "Epic", "Legendary"] as const;

/** The clock line: "Day ends 21:40 · 7h 14m left · Tomorrow lasts 12h". */
export const DAY_ENDS = "Day ends";
export const LEFT = "left";
export const TOMORROW_LASTS = "Tomorrow lasts";
export const DAY = "Day";
/** The day-done card: "Day 12 done · Realm kept · Day 13 is open", and its one verb. */
export const DAY_DONE = "done";
export const REALM_KEPT = "Realm kept";
export const DAY_OPEN = "is open";
export const CONTINUE = "Continue";
export const FULL_IN = "Full in";
/** A store's line on its tooltip: "Wheat 1,771 of 6,000 · +302 an hour · Full in 14h". */
export const OF = "of";
export const AN_HOUR = "an hour";

export const OFFLINE = "Offline";
export const TRY_AGAIN = "Try again";
export const LATER = "Later";
export const CLOSE = "Close";

export const XP = "XP";
export const LORDS = "LORDS";
export const ESSENCE = "Essence";
export const LABOR = "labor";
export const WHEAT = "wheat";
export const TROOPS = "troops";
export const STAMINA = "stamina";

/** The places: the nav's five words. */
export const MAP = "Map";
export const REALM = "Realm";
export const RESEARCH = "Research";
export const CHAT = "Chat";
export const MENU = "Menu";

/** The Menu's rows and its two buttons. */
export const TODAY = "Today";
export const PRODUCTION = "Production";
/** A store at its limit. */
export const FULL = "Full";
export const SEASON = "Season";
export const GUIDE = "Guide";
export const SETTINGS = "Settings";
export const EXIT = "Exit";
export const RESUME = "Resume";
export const SIGN_IN = "Sign in";

/** An army's two ways across the map, and backing out of an order. */
export const EXPLORE = "Explore";
export const MOVE = "Move";
export const CANCEL = "Cancel";

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
/** A store on its tooltip: what is free of it, "Population 2 free of 6". */
export const freeOf = (noun: string, free: string, total: string) => `${noun} ${free} free of ${total}`;
/** The fix for a short store that the map can fill: "Explore for labor". */
export const exploreFor = (noun: string) => `${EXPLORE} for ${noun}`;

/** The four attributes, each wearing its Aspect's mark. */
export const ATTRIBUTES = ["Battle", "Logistics", "Scouting", "Homecoming"] as const;
/** Scouting's choice at each tier: the kind it lifts (the screen shows icons; these are their names). */
export const FIND_KINDS = ["Find camps", "Find rifts", "Find stragglers"] as const;

/** The sites on the map, as their cards title them, and the verbs they take. */
export const CAMP = "Camp";
export const RIFT = "Rift";
export const RUIN = "Ruin";
/** A done site, and the chests the clears paid (screen-reader words; the screen shows Fl and Ch). */
export const CLEARED = "Cleared";
export const CHESTS = "Chests";
export const STRAGGLERS = "Stragglers";
export const SHRINE = "Shrine";
export const WELL = "Well";
export const ATTACK = "Attack";
export const ATTACKING = "Attacking…";
/** Why an attack cannot run, or what it costs, in one line under its button. */
export const needsStamina = (need: string, held: string) => `Needs ${need} stamina, has ${held}`;
export const tooFarFrom = (site: string) => `Too far from the ${site}`;
export const ARMY_WILL_BE_LOST = "Army will be lost";
export const USE = "Use";
export const USING = "Using…";

/** Making something you own better: the castle a level, a building type a tier, an army an attribute tier. */
export const UPGRADE = "Upgrade";

/** The realm: its castle and levels, its buildings, and the row that counts a full realm's common buildings. */
export const CASTLE = "Castle";
export const REALM_LEVELS = ["Settlement", "City", "Kingdom", "Empire"] as const;
export const FARM = "Farm";
export const WORKSHOP = "Workshop";
export const BARRACKS = "Barracks";
export const HUT = "Hut";
export const TRAINING_BUILDINGS = ["War hall", "Supply yard", "Scouts' lodge", "Hearth"] as const;
export const BUILDINGS = "Buildings";
/** The castle rows that unlock the three reaches beyond the spire. */
export const ETHEREAL = "Ethereal";
export const REACH_NUMERALS = ["I", "II", "III"] as const;
export const RESEARCHING = "Researching…";
export const BUILDING = "Building…";
export const UPGRADING = "Upgrading…";

/** Raise an army from troops at home. */
export const DEPLOY = "Deploy";
export const DEPLOYING = "Deploying…";
export const BUILD = "Build";

/** What an army's Homecoming sends home when its day ends (a screen reader's word; the screen shows Su and Tr). */
export const RETURNED = "troops returned";

/** Default army names: "Army" and its place. */
export const ARMY = "Army";

/** The player on any list. */
export const YOU = "You";

/** The season list and its end, told one of two ways (story): the mist lifted, or it grew too strong. */
export const SEASON_OVER = "Season over";
export const YOU_PLACED = "You placed";
export const SEASON_ENDINGS = { lifted: "The mist lifted", strong: "The mist grew too strong" } as const;
export const SEASON_ERROR = "Season did not answer.";
export const TODAY_ERROR = "Today did not answer.";
export const BACK = "Back";

/** Looking at another realm, and stopping. */
export const VISIT = "Visit";
export const LEAVE = "Leave";

/** The guide card's two verbs: go to what the line names, and on to the next line. */
export const SHOW_ME = "Show me";
export const NEXT = "Next";

/** Filling an army's stamina for LORDS, a full refill only. */
export const REFILL = "Refill";
export const REFILLING = "Refilling…";

/** LORDS leaving the game for the wallet linked to the account. */
export const WITHDRAW = "Withdraw";
export const SENDING = "Sending…";
export const ALL = "All";
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

/** The labor a player's Realms give once a game day. */
export const REALMS = "Realms";
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
