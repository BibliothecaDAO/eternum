import type { IconMeaning } from "@/ui/design-system/icon";
import type { Painting } from "@/ui/design-system/kit/paintings";

/**
 * The app sheet lab's fiction, the app lab's own (shell/lab/app-lab-fixtures.ts): Day 12 of a Frontier season with 7h 14m
 * left today; Maelis ranks 12th of 1,240; a Blitz slot takes entries until 16:30 with 31 registered; another Blitz is
 * live; Eternum opens in a week. Static words only: the directions are layouts, not pages wired to a game.
 */

export type LabAge = "blitz" | "frontier" | "eternum";

export const AGE_OF: Record<LabAge, { name: string; numeral: string; painting: Painting }> = {
  blitz: { name: "Blitz", numeral: "I", painting: "blitz-spires" },
  frontier: { name: "Frontier", numeral: "II", painting: "frontier-mist" },
  eternum: { name: "Eternum", numeral: "III", painting: "eternum-restoration" },
};

export const PLAYER = { name: "Maelis", portrait: "/images/avatars/07.png", lords: "2,140" };

/** A game Play lists: its age, its name, what stands, and its one verb. */
export type LabGame = {
  age: LabAge;
  title: string;
  line: string;
  verb: string;
  /** The verb's icon. */
  icon: IconMeaning;
  state?: { word: string; tone?: "good" | "warn" | "bad" | "gold"; live?: boolean };
  /** The page's one gold verb. */
  lead?: boolean;
};

export const GAMES: readonly LabGame[] = [
  {
    age: "frontier",
    title: "Frontier",
    line: "Day 12 · Day ends 21:12 · 7h 14m left",
    verb: "Resume",
    icon: "play",
    state: { word: "Your realm", tone: "gold" },
    lead: true,
  },
  {
    age: "blitz",
    title: "Blitz 13:18",
    line: "Ends 15:22 · 1h 24m left · 24/24",
    verb: "Watch",
    icon: "eye",
    state: { word: "Live", tone: "good", live: true },
  },
  {
    age: "blitz",
    title: "Blitz 16:30",
    line: "Entry closes 16:30 · 2h 4m left · 31 registered",
    verb: "Join",
    icon: "plus",
    state: { word: "Entry open", tone: "warn" },
  },
  {
    age: "blitz",
    title: "Blitz 11:00",
    line: "Ended today · you placed 3rd",
    verb: "Results",
    icon: "leaderboard",
    state: { word: "Ended" },
  },
  {
    age: "eternum",
    title: "Eternum",
    line: "Opens in 6 days · 18 Oct",
    verb: "Remind me",
    icon: "clock",
    state: { word: "Soon" },
  },
];

export const FRONTIER_BOARD = [
  { rank: 1, name: "Ysabeau", sites: 148, lords: "2,900" },
  { rank: 2, name: "Aldric", sites: 132, lords: "2,780" },
  { rank: 3, name: "Corwin", sites: 127, lords: "2,660" },
  { rank: 4, name: "Tybalt", sites: 121, lords: "2,540" },
  { rank: 5, name: "Isolde", sites: 116, lords: "2,420" },
  { rank: 6, name: "Brannoc", sites: 112, lords: "2,300" },
  { rank: 7, name: "Lord b006", sites: 108, lords: "2,180" },
  { rank: 8, name: "Gwenllian", sites: 103, lords: "2,060" },
  { rank: 9, name: "Osric", sites: 99, lords: "1,940" },
  { rank: 10, name: "Rhoswen", sites: 96, lords: "1,820" },
  { rank: 12, name: "Maelis", sites: 88, lords: "1,500", own: true },
] as const;

export const BLITZ_BOARD = [
  { rank: 1, name: "Ysabeau", rating: "2,480", prize: "35,209" },
  { rank: 2, name: "Aldric", rating: "2,210", prize: "33,800" },
  { rank: 3, name: "Corwin", rating: "2,050", prize: "32,448" },
  { rank: 4, name: "0x0e90…9d43", rating: "1,960", prize: "31,150" },
  { rank: 5, name: "Isolde", rating: "1,880", prize: "29,904" },
  { rank: 6, name: "0x0e90…9f65", rating: "1,820", prize: "28,708" },
  { rank: 41, name: "Maelis", rating: "1,744", prize: "6,878", own: true },
] as const;

export const RESULT_BOARD = [
  { rank: 1, name: "Aldric", points: 412 },
  { rank: 2, name: "Ysabeau", points: 382 },
  { rank: 3, name: "Maelis", points: 352, own: true },
  { rank: 4, name: "Corwin", points: 322 },
  { rank: 5, name: "Tybalt", points: 292 },
] as const;

export const RESULT_BREAKDOWN: readonly { what: string; icon: IconMeaning; count: string; points: string }[] = [
  { what: "Tiles explored", icon: "explore", count: "36", points: "72" },
  { what: "Crates opened", icon: "chest", count: "3", points: "30" },
  { what: "Rifts and camps", icon: "rift", count: "2", points: "40" },
  { what: "Hyperstructures taken", icon: "hyperstructure", count: "1", points: "100" },
  { what: "Hyperstructures held", icon: "crown", count: "", points: "110" },
];

/** The player's chest from Blitz 11:00: their rank band (3rd of 24 is the top 25%), what it can pay, what it paid. */
export const CHEST = { band: 1, shares: 4, until: "9 Dec", paid: "2,000" } as const;

export const CHAT = [
  { who: "Aldric", line: "gl hf" },
  { who: "Tybalt", line: "who takes the north ridge?" },
  { who: "Brannoc", line: "storm lords keep together" },
  { who: "Osric", line: "see you at the spires" },
  { who: "Ysabeau", line: "two minutes" },
] as const;

/** Twenty-four seats: who holds each so far in a launched game; the rest wait. */
export const SEATS = Array.from({ length: 24 }, (_, index) =>
  index < 17
    ? {
        name: FRONTIER_BOARD[index % 10].name,
        portrait: `/images/avatars/${String((index % 12) + 1).padStart(2, "0")}.png`,
        own: index === 6,
      }
    : null,
);
