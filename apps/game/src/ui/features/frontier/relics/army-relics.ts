import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";

import { RELIC_KINDS, type ArmyRelic, type RelicKind } from "./relic-catalog";

/** The facts an army's relics are read from: its three slots, and each kind's running effect. */
export const ARMY_RELIC_MODELS = ["ArmyRelics", "ArmyRelicEffect"] as const;

/** An army's relics: what each of its three slots holds (null: empty), and the kinds running, with the time left. */
type ArmyRelics = {
  slots: readonly [ArmyRelic | null, ArmyRelic | null, ArmyRelic | null];
  running: readonly { kind: RelicKind; rank: number; secondsLeft: number }[];
};

/**
 * An army's relics as the chain holds them at `now`, or null while the client does not know them (the army's facts not
 * yet synchronized). An effect runs while `now` is before its end, as army_relics.cairo's bonus reads it.
 */
export const readArmyRelics = (
  store: Pick<NativeFactStore, "requireOrAbsent">,
  gameId: number,
  explorerId: number | bigint,
  now: number,
): ArmyRelics | null => {
  const carried = store.requireOrAbsent("ArmyRelics", { game_id: gameId, explorer_id: explorerId }).known;
  if (!carried) return null;
  const running: ArmyRelics["running"][number][] = [];
  for (const kind of RELIC_KINDS) {
    const effect = store.requireOrAbsent("ArmyRelicEffect", { game_id: gameId, explorer_id: explorerId, kind }).known;
    if (!effect) return null;
    const secondsLeft = Number(effect.expires_at) - now;
    if (secondsLeft > 0) running.push({ kind, rank: effect.rank, secondsLeft });
  }
  const { first, second, third } = carried;
  return { slots: [first, second, third], running };
};

/** The slot of the three that a new relic fills, or null when all three are taken and the player must choose one. */
export const freeRelicSlot = (relics: ArmyRelics): 0 | 1 | 2 | null => {
  const free = relics.slots.findIndex((slot) => slot === null);
  return free === -1 ? null : (free as 0 | 1 | 2);
};
