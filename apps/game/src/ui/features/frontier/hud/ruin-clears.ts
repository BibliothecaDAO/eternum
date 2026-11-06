import { entityHomeNamespace, type ExpeditionRules, type RuinHistory } from "@bibliothecadao/eternum";
import { StructureType } from "@bibliothecadao/types";

import type { DayHistory } from "../log/player-day";

/** One story of the player's day as their history read gives it: its kind, its payload and its transaction. */
type DayStory = { story: string; storyPayload: Record<string, unknown>; tx_hash: string };

/**
 * Today's ruin clears of a home in the player's own history of the day (Herald's immutable sink, read by usePlayerDay,
 * with what the stream delivered since): each ruin payout naming the home, placed by the winning battle of its
 * transaction, as a payout names no tile. Complete only when the read holds the whole day through the snapshot the
 * store holds (`coversSnapshot`) and places every payout, so a story the read lacks never reads as a chest still there.
 */
export const historyRuinClears = (
  day: { stories: readonly DayStory[]; history: DayHistory },
  coversSnapshot: boolean,
  home: number | bigint,
  rules: ExpeditionRules,
  today: number,
): RuinHistory => {
  const cleared = new Set<number>();
  let placed = true;
  for (const payout of day.stories) {
    if (!isHomeRuinPayout(payout, home)) continue;
    const band = battleBand(day.stories, payout, rules.spacing);
    if (band === null) placed = false;
    else if (Math.floor(band / 4) === today) cleared.add(band % 4);
  }
  return { cleared, complete: day.history === "whole" && coversSnapshot && placed };
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
