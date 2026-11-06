import { entityHomeNamespace, type ExpeditionRules } from "@bibliothecadao/eternum";
import { StructureType } from "@bibliothecadao/types";

import type { DayHistory } from "../log/player-day";

/** One story of the player's day as their history read gives it: its kind, its payload and its transaction. */
type DayStory = { story: string; storyPayload: Record<string, unknown>; tx_hash: string };

/**
 * The depths a home cleared its ruin at today, from the player's own history of the day (Herald's immutable sink, read
 * once by usePlayerDay): each ruin payout naming the home, placed by the winning battle of its transaction, as a
 * payout names no tile. None unless the history holds the whole day and every such payout has its battle there, so a
 * story the read lacks never reads as a chest still to take.
 */
export const historyRuinDepths = (
  day: { stories: readonly DayStory[]; history: DayHistory },
  home: number | bigint,
  rules: ExpeditionRules,
  today: number,
): ReadonlySet<number> | null => {
  if (day.history !== "whole") return null;
  const depths = new Set<number>();
  for (const payout of day.stories) {
    if (!isHomeRuinPayout(payout, home)) continue;
    const band = battleBand(day.stories, payout, rules.spacing);
    if (band === null) return null;
    if (Math.floor(band / 4) === today) depths.add(band % 4);
  }
  return depths;
};

/** A ruin's payout to this home (its realm's namespace, as the contract's entitlement keys it). */
const isHomeRuinPayout = ({ story, storyPayload }: DayStory, home: number | bigint) =>
  story === "SitePayout" &&
  Number(storyPayload.category) === StructureType.Ruin &&
  entityHomeNamespace(String(storyPayload.structure_id)) === entityHomeNamespace(home);

/** The map band of the battle that won a payout's site, in the same transaction; none when the read lacks it. */
const battleBand = (stories: readonly DayStory[], payout: DayStory, spacing: number): number | null => {
  const battle = stories.find(
    ({ story, storyPayload, tx_hash }) =>
      story === "BattleEvent" &&
      tx_hash === payout.tx_hash &&
      String(storyPayload.defender_id) === String(payout.storyPayload.site_id),
  );
  const coord = battle?.storyPayload.coord as { y?: unknown } | undefined;
  return coord?.y === undefined ? null : Math.floor(Number(coord.y) / spacing);
};
