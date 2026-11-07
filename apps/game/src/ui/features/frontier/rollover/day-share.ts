import { siteKindOf, type SiteKind } from "@bibliothecadao/eternum";
import { fightVerdict, formatShort, VERDICT_WORDS } from "@bibliothecadao/types";

import type { IconMeaning } from "@/ui/design-system/icon";
import { CHESTS, DAY } from "@/ui/design-system/kit/words";

import type { DayTotals } from "../log/day-totals";
import { TARGET_MARKS } from "../sites/site-marks";
import { battleRecordOf } from "../sites/fight-record";

/**
 * One mark of a day's trail: a site cleared (by its kind), a chest opened, or a fight that did not clear its site.
 * A won fight is its site's clear, so it has no mark of its own.
 */
export type DayMark = SiteKind | "chest" | "army-lost" | "guard-holds";

/**
 * Each mark as the card paints it and the post writes it: its icon, its name for a screen reader, and the emoji a post
 * on X carries (Wordle's grid, owner's brief: the day's shape, spoiling nothing, since every realm's map is its own).
 */
export const DAY_MARKS = {
  Camp: { ...TARGET_MARKS.Camp, emoji: "👹" },
  Rift: { ...TARGET_MARKS.Rift, emoji: "🌀" },
  Ruin: { ...TARGET_MARKS.Ruin, emoji: "🏛️" },
  Beasts: { ...TARGET_MARKS.Beasts, emoji: "🐺" },
  chest: { word: CHESTS, icon: "chest", emoji: "🎁" },
  "army-lost": { word: VERDICT_WORDS["army-lost"], icon: "skull", emoji: "💀" },
  "guard-holds": { word: VERDICT_WORDS["guard-holds"], icon: "defend", emoji: "🛡️" },
} as const satisfies Record<DayMark, { word: string; icon: IconMeaning; emoji: string }>;

/** The totals a post leads with, each with its emoji, in the card's order. */
const POST_TOTALS = [
  { total: "reveals", emoji: "🧭" },
  { total: "cleared", emoji: "🚩" },
  { total: "chests", emoji: "🎁" },
] as const satisfies readonly { total: keyof DayTotals; emoji: string }[];

/** How many marks a trail shows before it counts the rest: a post's line, and the card's row, stay one line. */
export const TRAIL_LENGTH = 18;

interface DayStory {
  story: string;
  storyPayload: Record<string, unknown>;
  timestampMs: number;
}

/** The day's marks in the order they happened, from the player's own stories of the day (usePlayerDay). */
export const dayTrail = (stories: readonly DayStory[]): DayMark[] =>
  stories
    .map((story, index) => ({ story, index }))
    .sort((a, b) => a.story.timestampMs - b.story.timestampMs || a.index - b.index)
    .flatMap(({ story }) => markOf(story) ?? []);

const markOf = ({ story, storyPayload }: DayStory): DayMark | null => {
  if (story === "SitePayout") return siteKindOf(Number(storyPayload.category));
  if (story === "RewardChestOpened") return "chest";
  if (story !== "BattleEvent") return null;
  const record = battleRecordOf(storyPayload);
  if (!record) return null;
  const verdict = fightVerdict({ army: record.army.after, guard: record.guard.after });
  return verdict === "victory" ? null : verdict;
};

/** The trail as a card or a post shows it: its first marks, and how many more there were. */
export const shownTrail = (trail: readonly DayMark[]) => ({
  marks: trail.slice(0, TRAIL_LENGTH),
  more: Math.max(0, trail.length - TRAIL_LENGTH),
});

/** A rank's move over the day, as a post and the card write it: "▲2", "▼1", or nothing for none. */
export const rankMove = (rank: { from: number; to: number }) =>
  rank.to < rank.from ? `▲${rank.from - rank.to}` : rank.to > rank.from ? `▼${rank.to - rank.from}` : "";

/**
 * The post's text, the link after it: the game, the day and its closing rank; the day's totals; then its trail, the
 * whole day in a line of emoji.
 *
 *   Frontier · Day 12 · #7 ▲2
 *   🧭 31 · 🚩 4 · 🎁 1
 *   🏛️🌀🌀💀🐺👹
 */
export const dayPostText = ({
  game,
  day,
  totals,
  rank,
  trail,
}: {
  game: string;
  day: number;
  totals: DayTotals;
  rank: { from: number; to: number } | undefined;
  trail: readonly DayMark[];
}) => {
  const standing = rank ? ` · #${rank.to}${rankMove(rank) ? ` ${rankMove(rank)}` : ""}` : "";
  const counts = POST_TOTALS.map(({ total, emoji }) => `${emoji} ${formatShort(totals[total])}`).join(" · ");
  const { marks, more } = shownTrail(trail);
  const line = marks.map((mark) => DAY_MARKS[mark].emoji).join("") + (more > 0 ? ` +${more}` : "");
  return [`${game} · ${DAY} ${day}${standing}`, counts, line].filter(Boolean).join("\n");
};
