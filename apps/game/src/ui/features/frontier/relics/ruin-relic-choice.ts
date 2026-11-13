import { configManager } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { useState } from "react";

import { useGame } from "@/hooks/context/game-context";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";

import { ARMY_RELIC_MODELS, freeRelicSlot, readArmyRelics } from "./army-relics";
import type { ArmyRelic } from "./relic-catalog";

/**
 * The relic a carried one is chosen to make room for, bound to what it was chosen against: the army, the ruin, the slot
 * and the relic that slot held. It stands only while all four still hold.
 */
type ReplacementChoice = { armyId: number; ruinId: number; slot: 0 | 1 | 2; held: ArmyRelic };

/**
 * Where an attack on a ruin stands with relics, read from the facts at the moment asked:
 * - `none`: the target pays no relic (not a Season 1 ruin);
 * - `unknown`: the army's relics are not known yet (an incomplete snapshot): no attack leaves until they are;
 * - `room`: the army has a free slot, which the contract fills;
 * - `full`: all three are taken, `chosen` is the slot the player picked (null until a choice stands).
 */
type RuinRelicState =
  | { kind: "none" }
  | { kind: "unknown"; relic: ArmyRelic }
  | { kind: "room"; relic: ArmyRelic }
  | { kind: "full"; relic: ArmyRelic; carried: readonly [ArmyRelic, ArmyRelic, ArmyRelic]; chosen: 0 | 1 | 2 | null };

const RUIN_RELIC_MODELS = ["RuinRelic", ...ARMY_RELIC_MODELS] as const;

const sameRelic = (a: ArmyRelic | null, b: ArmyRelic) => a !== null && a.kind === b.kind && a.rank === b.rank;

/** The state of an attack by `armyId` on `ruinId`, with the player's choice kept only while it still names the same relic. */
export const ruinRelicState = (
  store: Pick<NativeFactStore, "get" | "requireOrAbsent">,
  ruinId: number,
  armyId: number | null,
  now: number,
  choice: ReplacementChoice | null,
): RuinRelicState => {
  const gameId = configManager.getActiveGameId();
  const ruinRelic = store.get("RuinRelic", { game_id: gameId, entity_id: ruinId });
  if (!ruinRelic) return { kind: "none" };
  const relic = { kind: ruinRelic.kind, rank: ruinRelic.rank };
  const army = armyId === null ? null : readArmyRelics(store, gameId, armyId, now);
  if (!army) return { kind: "unknown", relic };
  if (freeRelicSlot(army) !== null) return { kind: "room", relic };
  const carried = army.slots as readonly [ArmyRelic, ArmyRelic, ArmyRelic];
  const stands =
    choice !== null &&
    choice.armyId === armyId &&
    choice.ruinId === ruinId &&
    sameRelic(carried[choice.slot], choice.held);
  return { kind: "full", relic, carried, chosen: stands ? choice.slot : null };
};

/**
 * A ruin attack's relic state on its card, with the replacement the player taps, and the slot to send read again from
 * the facts at the moment Attack goes: `dispatchSlot` answers `{ slot }` (undefined for a free slot or no relic), or
 * null when the order must not leave (the relics unknown, or a full army with no standing choice).
 */
export const useRuinRelicChoice = (ruinId: number | null, armyId: number | null) => {
  const { setup } = useGame();
  const now = useCurrentBlockTimestamp();
  useNativeRevision(RUIN_RELIC_MODELS);
  const [choice, setChoice] = useState<ReplacementChoice | null>(null);
  if (ruinId === null) return null;
  const state = ruinRelicState(setup.store, ruinId, armyId, now, choice);
  const replace = (slot: 0 | 1 | 2) => {
    if (state.kind !== "full" || armyId === null) return;
    setChoice({ armyId, ruinId, slot, held: state.carried[slot] });
  };
  const dispatchSlot = (): { slot: 0 | 1 | 2 | undefined } | null => {
    // The facts as they stand when Attack goes, not as the card last drew them.
    const current = ruinRelicState(setup.store, ruinId, armyId, now, choice);
    if (current.kind === "unknown") return null;
    if (current.kind === "full") return current.chosen === null ? null : { slot: current.chosen };
    return { slot: undefined };
  };
  return { state, replace, dispatchSlot };
};
