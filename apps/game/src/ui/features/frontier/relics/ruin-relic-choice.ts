import { armyRelicsEnabled } from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { StructureType } from "@bibliothecadao/types";
import { useState } from "react";

import { useGame } from "@/hooks/context/game-context";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { RELIC_WORDS } from "@/ui/design-system/kit/words";

import { ARMY_RELIC_MODELS, freeRelicSlot, readArmyRelics } from "./army-relics";
import type { ArmyRelic } from "./relic-catalog";

/**
 * The relic a carried one is chosen to make room for, bound to what it was chosen against: the army, the ruin, the slot
 * and the relic that slot held. It stands only while all four still hold.
 */
type ReplacementChoice = { armyId: number; ruinId: number; slot: 0 | 1 | 2; held: ArmyRelic };

/** The site an attack targets, as far as its relic goes. */
type TargetSite = Pick<NativeRows["ExpeditionSite"], "game_id" | "entity_id" | "category">;

/**
 * Where an attack on a site stands with relics, read from the facts at the moment asked:
 * - `none`: the target is known to pay no relic (not a ruin, or a game whose ruins pay none);
 * - `unknown`: what the ruin pays (`relic` null) or the army's relics are not known yet: no attack leaves until they are;
 * - `room`: the army has a free slot, which the contract fills;
 * - `full`: all three are taken, `chosen` is the slot the player picked (null until a choice stands).
 */
type RuinRelicState =
  | { kind: "none" }
  | { kind: "unknown"; relic: ArmyRelic | null }
  | { kind: "room"; relic: ArmyRelic }
  | { kind: "full"; relic: ArmyRelic; carried: readonly [ArmyRelic, ArmyRelic, ArmyRelic]; chosen: 0 | 1 | 2 | null };

const RUIN_RELIC_MODELS = ["RuinRelic", "SliceRules", "ChestRules", ...ARMY_RELIC_MODELS] as const;

const sameRelic = (a: ArmyRelic | null, b: ArmyRelic) => a !== null && a.kind === b.kind && a.rank === b.rank;

/**
 * The relic a site pays, null when it is known to pay none, undefined while that cannot be told. The rules decide
 * whether a ruin pays one; in a game whose ruins do, every standing ruin holds its RuinRelic, so a missing row is a fact
 * not delivered yet, never a ruin that pays nothing.
 */
const relicPaidBy = (
  store: Pick<NativeFactStore, "get" | "subscriptionScope">,
  site: TargetSite,
): ArmyRelic | null | undefined => {
  if (site.category !== StructureType.Ruin) return null;
  const row = store.get("RuinRelic", { game_id: site.game_id, entity_id: site.entity_id });
  if (row) return { kind: row.kind, rank: row.rank };
  return armyRelicsEnabled(store, site.game_id) === false ? null : undefined;
};

/** The state of an attack by `armyId` on `site`, with the player's choice kept only while it still names the same relic. */
export const ruinRelicState = (
  store: Pick<NativeFactStore, "get" | "requireOrAbsent" | "subscriptionScope">,
  site: TargetSite,
  armyId: number | null,
  now: number,
  choice: ReplacementChoice | null,
): RuinRelicState => {
  const relic = relicPaidBy(store, site);
  if (relic === null) return { kind: "none" };
  if (relic === undefined) return { kind: "unknown", relic: null };
  const army = armyId === null ? null : readArmyRelics(store, site.game_id, armyId, now);
  if (!army) return { kind: "unknown", relic };
  if (freeRelicSlot(army) !== null) return { kind: "room", relic };
  const carried = army.slots as readonly [ArmyRelic, ArmyRelic, ArmyRelic];
  const ruinId = Number(site.entity_id);
  const stands =
    choice !== null &&
    choice.armyId === armyId &&
    choice.ruinId === ruinId &&
    sameRelic(carried[choice.slot], choice.held);
  return { kind: "full", relic, carried, chosen: stands ? choice.slot : null };
};

/** Why an attack must stay home for its relic, said on the card's step and refused at dispatch; null when it may go. */
const relicHold = (state: RuinRelicState): string | null => {
  if (state.kind === "unknown") return state.relic ? RELIC_WORDS.reading : RELIC_WORDS.readingRuin;
  if (state.kind === "full" && state.chosen === null) return RELIC_WORDS.chooseFirst;
  return null;
};

/**
 * A site attack's relic state on its card, with the replacement the player taps, and the slot to send read again from
 * the facts at the moment Attack goes: `dispatchSlot` gives the slot (undefined for a free slot or no relic), or throws
 * the hold when the order must not leave (what the ruin pays or the relics unknown, or a full army with no choice).
 */
export const useRuinRelicChoice = (site: TargetSite | null, armyId: number | null) => {
  const { setup } = useGame();
  const now = useCurrentBlockTimestamp();
  useNativeRevision(RUIN_RELIC_MODELS);
  const [choice, setChoice] = useState<ReplacementChoice | null>(null);
  if (site === null) return null;
  const state = ruinRelicState(setup.store, site, armyId, now, choice);
  const replace = (slot: 0 | 1 | 2) => {
    if (state.kind !== "full" || armyId === null) return;
    setChoice({ armyId, ruinId: Number(site.entity_id), slot, held: state.carried[slot] });
  };
  const dispatchSlot = (): 0 | 1 | 2 | undefined => {
    // The facts as they stand when Attack goes, not as the card last drew them.
    const current = ruinRelicState(setup.store, site, armyId, now, choice);
    const hold = relicHold(current);
    if (hold) throw new Error(hold);
    return current.kind === "full" && current.chosen !== null ? current.chosen : undefined;
  };
  return { state, hold: relicHold(state), replace, dispatchSlot };
};
