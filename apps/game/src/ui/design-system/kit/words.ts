/**
 * The client's phrases (the glossary, frontier-narrative-2026-10/glossary.html, ruled final 7 October 2026, and every
 * screen's words), each spelled once. A screen that needs one imports it from here; nothing else spells it. The rules
 * every client and core's story text share (nouns, numbers, times, names, the voice) are @bibliothecadao/types' words.
 */
import type { ResolvedGameMode } from "@/config/game-modes/resolved-mode";
import {
  formatAmount,
  formatCount,
  formatDuration,
  getRelicInfo,
  relicEffect,
  type ResourcesIds,
  formatCharge,
  formatExact,
  resourceName,
} from "@bibliothecadao/types";

/** One scale for chests, building types and attributes. */
export const TIER_WORDS = ["Common", "Uncommon", "Rare", "Epic", "Legendary"] as const;

/** The clock line: "Day ends 21:40 · 7h 14m left · Tomorrow lasts 12h". */
export const DAY_ENDS = "Day ends";
export const LEFT = "left";
export const TOMORROW_LASTS = "Tomorrow lasts";
export const DAY = "Day";

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
export const STORE = "Store";
/** On a payout's Full mark: the store took what it had room for. */
export const REST_DID_NOT_FIT = "The store is full: the rest did not fit";
export const SEASON = "Season";
/** The season board's two number columns, named on their icons' tooltip. */
export const SITES_CLEARED = "Sites cleared";
export const LORDS_EARNED = "LORDS earned";
export const GUIDE = "Guide";
export const SETTINGS = "Settings";
/** Settings' row for the keys, and the list it opens in Settings' place. */
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
export const CANCEL = "Cancel";
/** A highlighted tile on its tooltip: ground not yet seen, and troops passed to another of the player's armies. */
export const UNEXPLORED = "Unexplored";
export const TRANSFER = "Transfer";

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
 * Where a painting already names the resource (a cost chip) the noun is left out: "10 (you have 1,574)".
 */
export const costLine = (amount: number, held: number | undefined, resource?: ResourcesIds): string => {
  const noun = resource === undefined ? "" : ` ${resourceName(resource)}`;
  const holding = held === undefined ? "" : ` (you have ${formatExact(Math.floor(held))})`;
  return `${formatCharge(amount)}${noun}${holding}`;
};
/** A tier that is a choice of two sides waits for one: "Choose Drill or Rations". */
export const chooseOne = (first: string, second: string) => `Choose ${first} or ${second}`;
/** A castle row waits for the one before it: "Needs Ethereal I". */
export const needsFirst = (what: string) => `Needs ${what}`;
/** What a castle row opens, on its tooltip: "Shrine: your armies find Shrines, +200 XP each". */
export const armiesFind = (site: string, gain: string) => `${site}: your armies find ${site}s, ${gain} each`;
export const armiesEnter = (reach: string) => `${reach}: your armies may enter it at the spire`;
/** A training building's tier on its row's tooltip: "Battle +0% → +10% for every new army". */
export const forNewArmies = (attribute: string, effect: string) => `${attribute} ${effect} for every new army`;
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
/** A store on its tooltip: what is free of it, "Population 2 free of 6". */
export const freeOf = (noun: string, free: string, total: string) => `${noun} ${free} free of ${total}`;
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
/** Scouting's choice at each tier: the kind it lifts (the screen shows icons; these are their names). */
export const FIND_KINDS = ["Find camps", "Find rifts", "Find stragglers"] as const;

/** The sites on the map, as their cards title them, and the verbs they take. */
export const CAMP = "Camp";
export const RIFT = "Rift";
export const RUIN = "Ruin";
/** A map plate's words: a thing with no guard, the troops on their way to one, what a guard's total counts. */
export const UNDEFENDED = "Undefended";
export const ARRIVING = "Arriving";
export const GUARD = "guard";
/** A done site, and the chests the clears paid (screen-reader words; the screen shows Fl and Ch). */
export const CLEARED = "Cleared";
export const CHESTS = "Chests";
export const STRAGGLERS = "Stragglers";
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
export const VICTORY = "Victory";
export const ARMY_LOST = "Army lost";
export const GUARD_HOLDS = "Guard holds";
/** The day log's line for a fight: "Rift: Army lost, lost 154, guard 1,100 to 1,028". */
export const fightLine = (site: string, verdict: string, lost: string, guardBefore: string, guardAfter: string) =>
  `${site}: ${verdict}, lost ${lost}, guard ${guardBefore} to ${guardAfter}`;
/** Why an attack cannot run, or what it costs, in one line under its button. */
export const needsStamina = (need: string, held: string) => `Needs ${need} stamina, has ${held}`;
export const tooFarFrom = (site: string) => `Too far from the ${site}`;
export const ARMY_WILL_BE_LOST = "Army will be lost";
/** The skull beside an army on a site's card, on its tooltip. */
export const WOULD_BE_LOST = "Would be lost";
export const USE = "Use";
export const USING = "Using…";

/** Making something you own better: the castle a level, a building type a tier, an army an attribute tier. */
export const UPGRADE = "Upgrade";

/** The realm: its castle and levels, its buildings, and the row that counts a full realm's common buildings. */
export const CASTLE = "Castle";
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

/** A standing building's figures on its panel, each named on its tooltip (the screen shows icons and numbers). */
export const BUILDING_FIGURES = {
  eachMakes: (noun: string) => `${noun} each makes`,
  castleMakes: (noun: string) => `${noun} the castle makes`,
  standing: "standing",
  held: (noun: string) => `${noun} held of its store's limit`,
  eachAdds: `${POPULATION} each adds`,
  eachTakes: `${POPULATION} each takes`,
  free: `${POPULATION} free of all`,
  startsAt: (attribute: string) => `${attribute} new armies start at`,
} as const;

/** A slider's two ends, each a button: the least and the most the player can choose. */
export const MINIMUM = "Minimum";
export const MAXIMUM = "Maximum";

/** The Deploy sheet's figures, each named on its tooltip (the screen shows icons and numbers). */
export const DEPLOY_FIGURES = {
  slots: "army slots",
  wheatToDeploy: "wheat to deploy",
  wheatLeft: "wheat left at home",
  tilesPaid: "tiles the wheat left pays for",
  revealSends: "Essence or labor each reveal sends home",
  scout: "scout: its reveals send nothing home",
  startingStamina: "stamina it starts with",
} as const;

/** Raise an army from troops at home. */
export const DEPLOY = "Deploy";
export const DEPLOYING = "Deploying…";
export const BUILD = "Build";

/** What an army's Homecoming sends home when its day ends (a screen reader's word; the screen shows Su and Tr). */
export const RETURNED = "troops returned";

/** Default army names: "Army" and its place. */
export const ARMY = "Army";

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
} as const;
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
  marketplace: "Marketplace",
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  credits: "Credits and licences",
  owner: "© 2026 BibliothecaDAO",
} as const;

/** Play: what is under way now, and each mode's next and finished games behind its switch. */
export const PLAY_WORDS = {
  ended: "Ended",
  players: "Players",
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
  /** A chest's rank band (0 best .. 4), the one fact it shows sealed. */
  band: ["Top 10%", "Top 25%", "Top half", "Top 75%", "Bottom 25%"],
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

/** What's new: its two lists, a post's stepper and reading time, and the legal pages' date. */
export const NEWS_WORDS = {
  /** The game's latest changes, the first of What's new's lists. */
  changes: "Latest changes",
  newer: "Newer",
  older: "Older",
  updated: "Updated",
  /** A post's reading time: "4min". */
  minutes: (count: number) => `${count}min`,
  /** The Scroll, the posts read inside What's new. */
  scroll: "The Scroll",
  thoughtPiece: "Thought piece",
  update: "Update",
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
  formatAmount,
}: {
  missingWheat: number;
  missingFish: number;
  wheatLabel: string;
  formatAmount: (amount: number) => string;
}): string => {
  const missingParts = [
    missingWheat > 0 ? `${formatAmount(missingWheat)} ${wheatLabel}` : null,
    missingFish > 0 ? `${formatAmount(missingFish)} fish` : null,
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
  formatAmount,
}: {
  staminaBlocked: boolean;
  minTravelStamina: number;
  missingWheat: number;
  missingFish: number;
  wheatLabel: string;
  formatAmount: (amount: number) => string;
}): string | null => {
  const requirements = [
    staminaBlocked ? `${minTravelStamina}+ stamina` : null,
    formatArmyFoodRequirement({ missingWheat, missingFish, wheatLabel, formatAmount }) || null,
  ].filter(Boolean);

  if (requirements.length === 0) return null;

  return `Cannot travel — needs ${requirements.join(" and ")}`;
};

/** The visible reason food keeps an army still: what one step costs it and what its realm holds. */
export const formatFoodBlock = (
  block: {
    action: "travel" | "explore";
    perStep: ArmyFoodRequirement;
    food: ArmyFoodBalance;
  },
  formatAmount: (amount: number) => string,
): string => {
  const part = (amount: number, label: string) => (amount > 0 ? `${formatAmount(amount)} ${label}` : null);
  const cost = [part(block.perStep.wheatPayAmount, "wheat"), part(block.perStep.fishPayAmount, "fish")]
    .filter(Boolean)
    .join(" and ");
  const held = [
    part(Math.max(0, block.food.wheat), "wheat") ?? (block.perStep.wheatPayAmount > 0 ? "no wheat" : null),
    block.perStep.fishPayAmount > 0 ? (part(Math.max(0, block.food.fish), "fish") ?? "no fish") : null,
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
  const cost = `Costs ${formatCharge(activation.essenceCost)} ${ESSENCE} to activate`;
  const held = short ? `; you have ${formatAmount(Math.floor(essenceHeld))}` : "";
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
