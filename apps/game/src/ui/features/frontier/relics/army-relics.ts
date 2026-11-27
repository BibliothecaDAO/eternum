import { armyRelicRank, type ArmyRelicLoadout } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";

import { RELIC_KINDS, type RelicKind } from "@/ui/design-system/domain-icon-meaning";

export const ARMY_RELIC_MODELS = ["ArmyRelics", "ArmyRelicEffect", "SliceRules"] as const;

export type ArmyRelicSlot = {
  kind: RelicKind;
  carriedRank: number;
  active: { rank: number; secondsLeft: number } | null;
};

type ArmyRelics = {
  loadout: ArmyRelicLoadout;
  byKind: readonly ArmyRelicSlot[];
  running: readonly { kind: RelicKind; rank: number; secondsLeft: number }[];
  carriedCount: number;
};

export const readArmyRelics = (
  store: Pick<NativeFactStore, "requireOrAbsent">,
  gameId: number,
  explorerId: number | bigint,
  now: number,
): ArmyRelics | null => {
  const carried = store.requireOrAbsent("ArmyRelics", { game_id: gameId, explorer_id: explorerId }).known;
  if (!carried) return null;
  const running: ArmyRelics["running"][number][] = [];
  const byKind: ArmyRelicSlot[] = [];
  let carriedCount = 0;
  for (const kind of RELIC_KINDS) {
    const effect = store.requireOrAbsent("ArmyRelicEffect", { game_id: gameId, explorer_id: explorerId, kind }).known;
    if (!effect) return null;
    const secondsLeft = Number(effect.expires_at) - now;
    const active = effect.rank > 0 && secondsLeft > 0 ? { rank: effect.rank, secondsLeft } : null;
    if (active) running.push({ kind, rank: active.rank, secondsLeft: active.secondsLeft });
    const carriedRank = armyRelicRank(carried, kind);
    if (carriedRank > 0) carriedCount += 1;
    byKind.push({ kind, carriedRank, active });
  }
  return { loadout: carried, byKind, running, carriedCount };
};

export const hasArmyRelics = (relics: ArmyRelics | null): relics is ArmyRelics =>
  relics !== null && (relics.running.length > 0 || relics.carriedCount > 0);
