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
