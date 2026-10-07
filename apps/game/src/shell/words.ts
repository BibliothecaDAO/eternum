import { RESUME, SEASON, SIGN_IN } from "@/ui/design-system/kit/words";

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
  /** The back arrow is wordless; this names it for assistive technology. */
  back: "Back",
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
  seasonOver: "Season over",
  /** Before an age's numeral: "Age II". */
  age: "Age",
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
} as const;

/** The doorway into a match: its four steps and what holds it until the player acts. */
export const DOORWAY_WORDS = {
  account: "Account",
  realm: "Realm",
  map: "Map",
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
  continue: "Continue",
  share: "Share",
  youPlaced: "You placed",
  /** Between a place and the field: "3rd of 24". */
  of: "of",
  /** Blitz's own unit. */
  vp: "VP",
  /** The season's two endings (story): the mist lifted, or it grew too strong. */
  mistLifted: "The mist lifted",
  mistWon: "The mist grew too strong",
} as const;

/** Profile and its pages: Account, Devices and Notifications, their rows, sheets and confirms. */
export const PROFILE_WORDS = {
  account: "Account",
  notifications: "Notifications",
  devices: "Devices",
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
  cancel: "Cancel",
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
