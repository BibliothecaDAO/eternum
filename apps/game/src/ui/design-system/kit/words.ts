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

/** The four attributes, each wearing its Aspect's mark. */
export const ATTRIBUTES = ["Battle", "Logistics", "Scouting", "Homecoming"] as const;
/** Scouting's choice at each tier: the kind it lifts (the screen shows icons; these are their names). */
export const FIND_KINDS = ["Find camps", "Find rifts", "Find stragglers"] as const;

/** The sites on the map, as their cards title them, and the verbs they take. */
export const CAMP = "Camp";
export const RIFT = "Rift";
export const RUIN = "Ruin";
export const STRAGGLERS = "Stragglers";
export const SHRINE = "Shrine";
export const WELL = "Well";
export const ATTACK = "Attack";
export const ATTACKING = "Attacking…";
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

/** Default army names: "Army" and its place. */
export const ARMY = "Army";

/** The player on any list. */
export const YOU = "You";
