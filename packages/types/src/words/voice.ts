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
    instead: "what happens to the order: on its way, sent, done",
    bad: "Queued",
    good: "On its way…",
    forbidden: /\b(?:[Qq]ueued?|[Qq]ueue)\b/,
  },
  {
    rule: "Rates per second or minute",
    instead: "a second from one a second, a minute below (formatRate), never an hour",
    bad: "+302 an hour · 44.6K/h",
    good: "+5/min · +12/s",
    forbidden: /\/\s?hr?\b|\bper hour\b|\d an hour\b/,
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
];
