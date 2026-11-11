import { siteKindOf, type SiteKind } from "@bibliothecadao/eternum";
import { fightVerdict, formatShort, scaledToUnits } from "@bibliothecadao/types";

import { DAY } from "@/ui/design-system/kit/words";

import type { DayTotals } from "../log/day-totals";
import { paidResource, someReward } from "../log/today-totals";
import { battleRecordOf } from "../sites/fight-record";

/**
 * One mark of a day's trail: a site cleared (by its kind), a chest opened, or a fight that did not clear its site.
 * A won fight is its site's clear, so it has no mark of its own.
 */
export type DayMark = SiteKind | "chest" | "army-lost" | "guard-holds";

/**
 * Each mark as the post writes it, the emoji a post on X carries (Wordle's grid, owner's brief: the day's shape,
 * spoiling nothing, since every realm's map is its own).
 */
export const DAY_MARKS = {
  Camp: "👹",
  Rift: "🌀",
  Ruin: "🏛️",
  Beasts: "🐺",
  chest: "🎁",
  "army-lost": "💀",
  "guard-holds": "🛡️",
} as const satisfies Record<DayMark, string>;

/** The totals a post leads with, each with its emoji, in the card's order. */
const POST_TOTALS = [
  { total: "reveals", emoji: "🧭" },
  { total: "cleared", emoji: "🚩" },
  { total: "chests", emoji: "🎁" },
] as const satisfies readonly { total: keyof DayTotals; emoji: string }[];

/** How many marks a post's line shows before it counts the rest, so it stays one line. */
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

/** The trail as a post shows it: its first marks, and how many more there were. */
const shownTrail = (trail: readonly DayMark[]) => ({
  marks: trail.slice(0, TRAIL_LENGTH),
  more: Math.max(0, trail.length - TRAIL_LENGTH),
});

/** A rank's move over the day, as the post and the card write it: "▲2", "▼1", or nothing for none. */
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
  rank: { from: number; to: number } | null | undefined;
  trail: readonly DayMark[];
}) => {
  const standing = rank ? ` · #${rank.to}${rankMove(rank) ? ` ${rankMove(rank)}` : ""}` : "";
  const counts = POST_TOTALS.map(({ total, emoji }) => `${emoji} ${formatShort(totals[total])}`).join(" · ");
  const { marks, more } = shownTrail(trail);
  const line = marks.map((mark) => DAY_MARKS[mark]).join("") + (more > 0 ? ` +${more}` : "");
  return [`${game} · ${DAY} ${day}${standing}`, counts, line].filter(Boolean).join("\n");
};

/**
 * The day's best moment, the one its card is built round: a ruin chest's LORDS, else the clear of the strongest guard
 * (its site, the guard it beat and what it paid), else the land revealed. A day enters no depth in its stories, so a
 * depth is never its best.
 */
export type DayBest =
  | { kind: "chest"; lords: number }
  | {
      kind: "clear";
      site: SiteKind;
      guard: number | undefined;
      paid: { resource: "essence" | "labor" | "lords"; amount: number } | null;
    }
  | { kind: "reveals"; count: number };

/** Which clear leads when two beat the same guard: the rarer site. */
const SITE_RANK: Record<SiteKind, number> = { Ruin: 3, Rift: 2, Camp: 1, Beasts: 0 };

/** The day's best moment from the player's own stories of the day (usePlayerDay), and its reveals as the fallback. */
export const dayBest = (stories: readonly DayStory[], reveals: number): DayBest => {
  const lords = Math.max(0, ...stories.filter(isChest).map(({ storyPayload }) => Number(storyPayload.amount)));
  if (lords > 0) return { kind: "chest", lords };
  const clears = stories
    .filter(({ story }) => story === "SitePayout")
    .map(({ storyPayload }) => clearOf(storyPayload, stories));
  const best = clears.sort((a, b) => (b.guard ?? 0) - (a.guard ?? 0) || SITE_RANK[b.site] - SITE_RANK[a.site])[0];
  return best ?? { kind: "reveals", count: reveals };
};

const isChest = ({ story }: DayStory) => story === "RewardChestOpened";

/** A clear: its site, the guard the fight that won it beat, and what it paid. */
const clearOf = (payout: Record<string, unknown>, stories: readonly DayStory[]) => {
  const won = stories
    .filter(
      ({ story, storyPayload }) =>
        story === "BattleEvent" && String(storyPayload.defender_id) === String(payout.site_id),
    )
    .map(({ storyPayload }) => battleRecordOf(storyPayload))
    .find((record) => record?.guard.after === 0);
  const reward = someReward(payout.reward);
  return {
    kind: "clear" as const,
    site: siteKindOf(Number(payout.category)),
    guard: won?.guard.before,
    paid: reward ? paidOf(reward.resource_type, reward.amount) : null,
  };
};

const paidOf = (resourceType: unknown, amount: unknown) => {
  const resource = paidResource(resourceType);
  return resource ? { resource, amount: scaledToUnits(BigInt(String(amount))) } : null;
};
