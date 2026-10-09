import { MAP, REALM, RESUME, SEASON, SIGN_IN } from "@/ui/design-system/kit/words";

/**
 * The app's words outside a match, each spelled once (words.html; the Frontier glossary stays the authority for game
 * words). A screen never types one of these itself: it names the constant.
 */
export const WORDS = {
  play: "Play",
  season: SEASON,
  learn: "Learn",
  profile: "Profile",
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
  join: "Join",
  joined: "Joined",
  results: "Results",
  /** A game under way. */
  live: "Live",
  /** The home card when no age has a game live or scheduled; awaiting the owner's wording (a gap in spec 03's table). */
  noSeason: "No season running",
  /** Before an age's numeral: "Age II". */
  age: "Age",
} as const;

/** The desktop footer on the pages that scroll: its columns and their links. */
export const FOOTER_WORDS = {
  community: "Community",
  realms: "Realms",
  legal: "Legal",
  guides: "Guides",
  gameDocs: "Game docs",
  marketplace: "Marketplace",
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  credits: "Credits and licences",
  owner: "© 2026 BibliothecaDAO",
  places: "places",
  back: "back",
} as const;

/** Play on the desktop: its panels and the bands below its first screen. */
export const PLAY_WORDS = {
  blitzGames: "Blitz games",
  nextBlitz: "Next Blitz",
  fourAges: "The four ages",
  joinTheRealm: "Join the realm",
} as const;

/** The lore's line, on the first visit's painting and on sign-in (approved 25 September). */
export const LORE_LINE = "The mist forgets. Your realm remembers.";
/** Frontier's pitch on the first visit's card. */
export const PITCH = "A new land every day. Your realm keeps what it earns.";

/** ClockChip's prefix words: a moment that begins something, or one that ends it. */
export const CLOCK_WORDS = {
  starts: "Starts",
  opens: "Opens",
  ends: "Ends",
  expires: "Expires",
  /** Before the time left to a beginning: "Starts 16:30 · in 2h 4m". */
  in: "in",
} as const;

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

/** Blitz's list and lobby: the steps on Join, the seat's cost, and what stands where an action cannot. */
export const BLITZ_WORDS = {
  joining: "Joining…",
  preparing: "Preparing…",
  /** The one line above Join (ruled: a seat is kept). */
  seatKept: "A seat cannot be given up.",
  /** Shown only to assistive technology; the seats are drawn. */
  seats: "Seats",
  full: (nextStart: string) => `Full. The ${nextStart} game has seats.`,
  /** Above the lobby's countdown. */
  startsIn: "Starts in",
  endsIn: "Ends in",
} as const;

/** A Blitz lobby's chat: its panel, its field and the lines that stand where a message cannot go. */
export const CHAT_WORDS = {
  chat: "Chat",
  message: "Message",
  /** The field's placeholder for a reader without a seat: the Worker lets only seated players write. */
  takeASeat: "Take a seat to write",
  signInToRead: "Sign in to read the lobby's chat.",
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
  deviceLimit: "Device limit reached.",
  devices: "Devices",
} as const;

/** The Season tab and a game's Results. */
export const SEASON_WORDS = {
  /** The view switch's name, for assistive technology. */
  views: "Season views",
  share: "Share",
  /** Between a place and the field: "3rd of 24". */
  of: "of",
  /** Blitz's own unit. */
  vp: "VP",
} as const;

/** The Blitz rating (MMR): its panel's words. The rating is automatic at settlement; nothing here asks for it. */
export const RATING_WORDS = {
  rating: "Rating",
  blitzRating: "Blitz rating",
  yourGames: "Your games",
  /** A Realms account with no linked wallet carries no rating (not 0, not 1000). */
  unlinked: "Link a wallet in Account to carry a rating.",
} as const;

/** Profile and its pages: Account, Devices and Notifications, their rows, sheets and confirms. */
export const PROFILE_WORDS = {
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
  wallet: "Wallet",
  linkWallet: "Link wallet",
  unlink: "Unlink",
  unlinking: "Unlinking…",
  signOut: "Sign out",
  signOutAsk: "Sign out?",
  signOutCost: "This device forgets your account until you sign in again.",
  unlinkAsk: "Unlink this wallet?",
  unlinkCost: "Your account keeps no wallet until you link one again.",
  /** The safe choice on a confirm: the primary. */
  keep: "Keep",
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

/** The payout wallet: where prizes are paid, the wallets an account links, and Ready for a player with none. */
export const WALLET_WORDS = {
  payoutWallet: "Payout wallet",
  prizesGoHere: "Prizes go here",
  stepWallet: "Wallet",
  stepCode: "Email code",
  stepHold: "24h hold",
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
  openReady: "Open Ready",
  keysStay: "Ready's own page; your keys stay with Ready",
  emailStep: "Email and password, on Ready's page",
  approveStep: "Approve Realms",
  codeStep: "Signature, then our code",
  backFromReady: "Added Ready? Reload this page, then link it.",
  linkReady: "Link Ready",
  anotherWallet: "Another wallet",
  codeSentTo: "Code sent to",
  sending: "Sending…",
  newCode: "New code",
  confirmInWallet: "Confirm in your wallet",
  onHold: "On hold",
  canReceive: "Ready",
  left: "left",
  receivesFrom: "Receives from",
  noticeSentTo: "Notice sent to",
  replace: "Replace",
  unlink: "Unlink",
  unlinkTitle: "Unlink wallet",
  nothingPaysOut: "Nothing pays out until a wallet is linked",
  opening: "Opening…",
  noneHere: "No wallet this browser can open. Ready by email needs none.",
  notPayoutWallet: "This is not your payout wallet. Open the one linked in Account.",
  paymentFailed: "The wallet did not send it. Try again in a moment.",
} as const;

/** What every value screen shares: a fee the payout wallet cannot pay yet. */
export const VALUE_WORDS = {
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
  confirming: "Confirming…",
  needMore: (amount: string) => `Need ${amount} more LORDS`,
  paidFromWallet: "Entry is paid from your payout wallet",
  seated: "Seated",
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
  refundedLine: "Your LORDS and credits are back in your wallet.",
  whereItGoes: "Where this entry goes: the season pool, the season's chests, the treasury",
} as const;

/** After a paid Blitz: the rating's change and the chest the result minted. */
export const REWARD_WORDS = {
  rating: "Blitz rating",
  chest: "Chest",
  arrives: "Arrives with the results",
  open: "Open",
  keep: "Keep",
  inCollection: "In your collection",
  tradeable: "Tradeable",
  traded: "In another collection",
  cosmetic: "Cosmetic",
  lords: "LORDS",
  lordsSent: "Sent to your payout wallet",
  swordCredit: "Sword credit",
  shieldCredit: "Shield credit",
  nextEntry: "Used at your next entry",
  /** A chest's rank band (0 best .. 4), the one fact it shows sealed. */
  band: ["Top 10%", "Top 25%", "Top half", "Top 75%", "Bottom 25%"],
  opening: "Opening…",
  lordsUntil: (date: string) => `LORDS until ${date}`,
  noLords: "No LORDS now",
} as const;

/** The Blitz season's prize on Season. */
export const SEASON_PRIZE_WORDS = {
  title: "Blitz season",
  pool: "Prize pool",
  ends: (date: string) => `Ends ${date}`,
  final: "Final",
  paysToday: "If the season ended now",
  placesPaid: (count: number) => `${count} places paid`,
  place: (place: number) => `#${place}`,
  noPlaces: "No place is paid until players are ranked.",
  yourShare: "Your share",
  review: "Claims open in",
  held: "The list is being checked",
  claimed: "Claimed to your payout wallet",
  notPaid: "Outside the paid places this season",
  claim: "Claim",
} as const;

/** The three alert levels (ruled) and what each carries, in one line. */
export const LEVEL_WORDS = {
  off: { word: "Off", line: "Nothing" },
  important: { word: "Important", line: "Your day ends in an hour, your Blitz starts, a message to you" },
  all: { word: "All", line: "Plus every clear, fight and build" },
} as const;

/** Learn: its two views, the guides, a post's stepper and the legal links. */
export const LEARN_WORDS = {
  guides: "Guides",
  news: "News",
  howFrontier: "How Frontier plays",
  howBlitz: "How Blitz plays",
  howEternum: "How Eternum plays",
  byPlayers: "Guides by players",
  newer: "Newer",
  older: "Older",
  terms: "Terms",
  privacy: "Privacy",
  updated: "Updated",
  /** A post's reading time: "4min". */
  minutes: (count: number) => `${count}min`,
  /** The Scroll, the posts read inside Play. */
  scroll: "The Scroll",
  thoughtPiece: "Thought piece",
  update: "Update",
  change: "Change",
  /** Below the Scroll's newest posts: everything else in News, on Learn. */
  allNews: "All news",
  /** The four ages as the lore site tells them, on Learn. */
  chronicle: "The chronicle",
  lostAges: "The Lost Ages",
  /** Under Guides by players: "6 guides". */
  guidesCount: (count: number) => `${count} guides`,
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
  /** The operators' page. */
  factory: "Factory",
  /** The browser's own words, quoted on the install steps. */
  share: "Share",
  addToHomeScreen: "Add to Home Screen",
  add: "Add",
  file: "File",
  addToDock: "Add to Dock",
} as const;
