/**
 * How every string a player reads is worded (the owner's rulings, briefs/hud-warroom.md, briefs/sheet-words.md and
 * briefs/stylesheet.md, 16–19 October 2026). A rule a single word can break carries the pattern that finds that word in
 * a visible string: the words inventory (scripts/words-inventory.mjs) counts them, and the lab shows each rule beside
 * its example.
 */
interface VoiceRule {
  rule: string;
  /** What a player reads instead. */
  instead: string;
  bad: string;
  good: string;
  /** A word that breaks the rule wherever a player reads it; absent when the rule is judged, not matched. */
  forbidden?: RegExp;
}

export const VOICE_RULES: readonly VoiceRule[] = [
  {
    rule: "Points are points",
    instead: "points, never VP or pts",
    bad: "+250 VP",
    good: "+250 points",
    forbidden: /\b(?:VP|[Pp]ts)\b/,
  },
  {
    rule: "No internal names",
    instead: "the thing's own name: a guard slot by its wall, a troop by its name and tier",
    bad: "Assignment: Gamma · Spawn: East",
    good: "Castle Wall",
    forbidden: /\b(?:Courier|Payload|Delta|Gamma|Spawn)\b|\b(?:Progression|Assignment|Strength): /,
  },
  {
    rule: "Never the queue",
    instead: "what happens to the order: sending, sent, done",
    bad: "Queued",
    good: "Sending…",
    forbidden: /\b(?:[Qq]ueued?|[Qq]ueue)\b/,
  },
  {
    rule: "Rates per minute",
    instead: "always a minute's (formatRate), never a second's or an hour's",
    bad: "+1.1/s · 2 points/s · FP/sec · then per second",
    good: "+66/min · points +120/min · FP rate · then per minute",
    forbidden: /\/\s?hr?\b|\/\s?s(?:ec)?\b|\bper (?:hour|second)\b|\d an hour\b/,
  },
  {
    rule: "A rank by its name",
    instead: "Settlement, City, Kingdom or Empire, never a level number",
    bad: "Level 2",
    good: "City",
    forbidden: /\b(?:Level|Lvl|Lv\.?) ?\d/,
  },
  {
    rule: "No keys on screen",
    instead: "nothing: keys work, the screen never shows them",
    bad: "Explore (E)",
    good: "Explore",
    forbidden: /\((?:[A-Z]|Esc|Tab|Space|Shift|Enter)\)|\bPress [A-Z]\b/,
  },
  {
    rule: "Undefended, in words",
    instead: "Undefended, for a thing with no guard",
    bad: "0 guards",
    good: "Undefended",
    forbidden: /\b(?:0 guards?|no guards?|[Dd]efenseless)\b/,
  },
  {
    rule: "No ids, no number signs",
    instead: "a thing's name, a nameless one by its kind or its place name; a place in a ranking as an ordinal",
    bad: "Army #4097 · Rank #3",
    good: "Grimwatch · 3rd",
    forbidden: /\b[A-Z][a-z]+ #\d+/,
  },
  {
    rule: "A number, never a formula",
    instead: "the one number a player gets, with the research behind it as its gem, never the sum behind it",
    bad: "+25/min · 4 × +6.3/min (5 + 25% Fields)",
    good: "+25/min",
    // Two figures joined by ×, + or = between spaces (a template's ${…} reads as a figure), or a price's base: "4 × 6.3",
    // "5 + 25%", "1 Wheat = 0.03 LORDS", "Base 400". A count ("Wheat ×900", "Win ×2", "4× entry"), a signed gain ("+25%"),
    // a log's field (key=value) and CSS's calc() stay.
    forbidden: /\d ?[×✕] [+−-]?\d|(?<!calc\([^)]*)\d \+ [+−]?\d|\d = [+−]?\d|\bBase \d/,
  },
  {
    rule: "Unknown is a dash",
    instead: "—, never 0 or blank, when a figure cannot be read",
    bad: "0 wheat (still loading)",
    good: "— wheat",
  },
  {
    rule: "A find says what it gave",
    instead:
      "what was done and what it gave; not where (the map shows it) nor a grant that never changes (the top bar counts points)",
    bad: "Explored · (0, -4): +5 points, +100 Labor",
    good: "Explored: +100 Labor",
  },
  {
    rule: "Short and precise",
    instead: "one line that names what is counted, no filler",
    bad: "You currently do not have enough wheat to deploy this army",
    good: "Needs 300 wheat, have 120",
  },
  {
    rule: "No subtext",
    instead: "the control, the number and the action; no line under them to explain them",
    bad: "Steps out on the bright tile. Tap another lit tile beside the realm to move it there.",
    good: "Deploy",
  },
  {
    rule: "Contextualized picks (from X to Y)",
    instead:
      "every Oath, relic and research pick shows its effect against the player's current value ('from X to Y' or 'Y instead of X'), read from the game's rule rows, never a bare number",
    bad: "Loses 100 troops a tick in the Deep.",
    good: "Deep troop loss: 200 → 100 per tick (less)",
  },
];

interface PlainWord {
  concept: string;
  word: string;
}

export const PLAIN_WORDS: readonly PlainWord[] = [
  { concept: "Create a Realm or Tribe", word: "Create" },
  { concept: "Your base", word: "Realm" },
  { concept: "Join an Aspect or Tribe", word: "Join" },
  { concept: "Use an invite or gift code", word: "Use code" },
  { concept: "Train troops at a building", word: "Train" },
  { concept: "Send an army onto the map", word: "Deploy" },
  { concept: "Move an army", word: "Move" },
  { concept: "Delete an army, building, or tribe", word: "Delete" },
  { concept: "Remove a guard", word: "Remove" },
  { concept: "Upgrade Castle or Realm", word: "Upgrade" },
  { concept: "Use a relic", word: "Use" },
  { concept: "Reroll an Oath card", word: "Reroll" },
  { concept: "Skip an Oath pick", word: "Skip" },
  { concept: "Collect rewards or arrivals", word: "Collect" },
  { concept: "Take a site or structure", word: "Take" },
  { concept: "Resource storage", word: "Storage / Resources" },
  { concept: "Site or castle defenders", word: "Guard" },
  { concept: "Players in your Aspect", word: "Teammates" },
  { concept: "Battle or quest payouts", word: "Gives / Earns" },
  { concept: "Battle and site rewards", word: "Rewards" },
  { concept: "Scouting details", word: "Info" },
  { concept: "Saved build plan", word: "Build plan" },
  { concept: "Shareable build plan text", word: "Code" },
  { concept: "Wallet destination", word: "Wallet" },
  { concept: "Numbers and multipliers", word: "Digits and % (150%, 4)" },
  { concept: "Loading or network failure", word: "Could not load / Failed" },
  { concept: "In-progress state", word: "Loading / Sending / In progress" },
  { concept: "Oath, relic, or research pick effect", word: "From X to Y / Y instead of X" },
];

interface BannedWord {
  banned: string;
  use: string;
  pattern: RegExp;
  bad: string;
  good: string;
  zeroTolerance?: boolean;
}

export const BANNED_WORDS: readonly BannedWord[] = [
  {
    banned: "found (a Realm)",
    use: "create",
    pattern: /\b(?:founding|founded)\b|\bfound (?:your|a|an|the|this) (?:home|realm|tribe)\b/i,
    bad: "Found your home",
    good: "Create your Realm",
    zeroTolerance: true,
  },
  {
    banned: "Far-Eye",
    use: "(removed — never name it)",
    pattern: /\bfar[- ]?eye\b/i,
    bad: "Use Far-Eye",
    good: "Explore nearby tiles",
    zeroTolerance: true,
  },
  {
    banned: "establish",
    use: "create",
    pattern: /\bestablish(?:ed|ing)?\b/i,
    bad: "Establish your Realm",
    good: "Create your Realm",
  },
  {
    banned: "settle (a Realm)",
    use: "create",
    pattern: /\b(?:settle (?:another|a|your|the) realm|realm settled|settled by)\b/i,
    bad: "Settle another realm",
    good: "Create another Realm",
  },
  {
    banned: "provision",
    use: "create / set up",
    pattern: /\b(?:Provision|provision(?:ed|ing))\b|\bto provision\b/,
    bad: "Realm provisioned",
    good: "Realm created",
  },
  {
    banned: "pledge",
    use: "join",
    pattern: /\bpledg(?:e|ed|ing)\b/i,
    bad: "Pledge to Luminary",
    good: "Join Luminary",
  },
  {
    banned: "redeem",
    use: "use code",
    pattern: /\bredeem(?:ed|ing)?\b/i,
    bad: "Redeem",
    good: "Use code",
  },
  {
    banned: "disband",
    use: "delete",
    pattern: /\bdisband(?:ed|ing)?\b/i,
    bad: "Army disbanded",
    good: "Army deleted",
  },
  {
    banned: "demolish",
    use: "delete",
    pattern: /\bdemolish(?:ed|ing)?\b/i,
    bad: "Building demolished",
    good: "Building deleted",
  },
  {
    banned: "dismiss",
    use: "remove / close",
    pattern: /\bdismiss(?:ed|ing)?\b/i,
    bad: "Guard dismissed",
    good: "Guard removed",
  },
  {
    banned: "travel / march",
    use: "move",
    pattern: /\b(?:travel(?:ed|ing|led|ling)?|march(?:ed|ing)?)\b/i,
    bad: "Travel blocked",
    good: "Cannot move",
  },
  {
    banned: "claim",
    use: "collect / take / save",
    pattern: /\bclaim(?:ed|ing|s)?\b/i,
    bad: "Claim name",
    good: "Save name",
  },
  {
    banned: "build order",
    use: "build plan",
    pattern: /\bbuild[- ]orders?\b/i,
    bad: "Build order",
    good: "Build plan",
  },
  {
    banned: "switch on",
    use: "use",
    pattern: /\bswitch(?:ed|ing)? on\b/i,
    bad: "Switch on",
    good: "Use",
  },
  {
    banned: "redraw",
    use: "reroll",
    pattern: /\bredraw(?:n|ing)?\b/i,
    bad: "Oath card redrawn",
    good: "Oath card rerolled",
  },
  {
    banned: "level up",
    use: "upgrade",
    pattern: /\blevel(?:led|ed|ing|ling)? up\b/i,
    bad: "Level up the castle",
    good: "Upgrade the Castle",
  },
  {
    banned: "did not answer",
    use: "could not load",
    pattern: /\bdid not answer\b/i,
    bad: "Season did not answer.",
    good: "Could not load Season.",
  },
  {
    banned: "could not be read",
    use: "could not load",
    pattern: /\b(?:could not|cannot) be read\b/i,
    bad: "Payouts cannot be read right now",
    good: "Could not load payouts right now",
  },
  {
    banned: "did not go through",
    use: "failed",
    pattern: /\bdid not go through\b/i,
    bad: "Your last send did not go through.",
    good: "Your last transfer failed.",
  },
  {
    banned: "on its way",
    use: "loading / sending",
    pattern: /\bon (?:its|their) way\b/i,
    bad: "On its way…",
    good: "Sending…",
  },
  {
    banned: "under way",
    use: "in progress",
    pattern: /\bunder way\b/i,
    bad: "Recovery under way",
    good: "Recovery in progress",
  },
  {
    banned: "saving up",
    use: "not enough",
    pattern: /\bsaving up\b/i,
    bad: "Saving up",
    good: "Not enough",
  },
  {
    banned: "on hand",
    use: "available",
    pattern: /\bon hand\b/i,
    bad: "No troops on hand",
    good: "No troops available",
  },
  {
    banned: "wiped out",
    use: "defeated",
    pattern: /\bwiped (?:each other )?out\b/i,
    bad: "Aspect wiped out",
    good: "Aspect defeated",
  },
  {
    banned: "fought to a stand",
    use: "tied",
    pattern: /\bfought to a stand\b/i,
    bad: "Both armies fought to a stand",
    good: "Both armies tied",
  },
  {
    banned: "fell in the fight",
    use: "died in battle",
    pattern: /\bfell in the fight\b/i,
    bad: "Its troops fell in the fight.",
    good: "Your troops died in battle.",
  },
  {
    banned: "your haul / spoils",
    use: "rewards",
    pattern: /\byour haul\b|\bspoils\b/i,
    bad: "Your haul",
    good: "Your rewards",
  },
  {
    banned: "took the season",
    use: "won the season",
    pattern: /\btook the season\b/i,
    bad: "took the season",
    good: "won the season",
  },
  {
    banned: "garrison",
    use: "guard",
    pattern: /\bgarrison(?:ed|s)?\b/i,
    bad: "Garrison troops",
    good: "Guard troops",
  },
  {
    banned: "intel",
    use: "info",
    pattern: /\bintel\b/i,
    bad: "Village Intel",
    good: "Village Info",
  },
  {
    banned: "mates",
    use: "teammates",
    pattern: /\bmates?\b/i,
    bad: "Take one site with mates",
    good: "Take 1 site with teammates",
  },
  {
    banned: "half again / twice as",
    use: "150% / 200%",
    pattern: /\b(?:half again|twice as)\b/i,
    bad: "Pays half again as much",
    good: "Gives 150% rewards",
  },
  {
    banned: "JSON",
    use: "code",
    pattern: /\bJSON\b/,
    bad: "Copy JSON",
    good: "Copy code",
  },
  {
    banned: "L2",
    use: "wallet",
    pattern: /\bL2\b/,
    bad: "100 LORDS to L2",
    good: "100 LORDS to wallet",
  },
];
