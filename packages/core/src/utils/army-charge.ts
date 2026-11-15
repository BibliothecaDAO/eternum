import { nativeRuleConstants, type NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import type { NativeFactStore } from "../client/native-fact-store";

export const ARMY_CHARGE_MODELS = ["SliceRules", "ArmyCombat"] as const;

/** The opening share for this army's next attack. Unknown combat facts keep the forecast unknown. */
export function openingChargePercent(
  store: NativeFactStore,
  army: Pick<NativeRows["ExplorerTroops"], "game_id" | "explorer_id">,
  target: bigint,
): number | undefined {
  const rules = store.require("SliceRules", { game_id: army.game_id });
  if (rules.day_unit_seconds === 0) return 0;
  const combat = store.get("ArmyCombat", { game_id: army.game_id, explorer_id: army.explorer_id });
  if (!combat) return undefined;
  return openingChargeForTarget(combat, target);
}

/** A sequential forecast advances its last target after each guard without changing native facts. */
export function openingChargeForTarget(combat: NativeRows["ArmyCombat"], target: bigint): number {
  return combat.last_target === target ? 0 : chargePercent(combat.charge);
}

/** Charge research adds the same opening share at each tier. */
export const chargePercent = (tier: number): number => tier * nativeRuleConstants.CHARGE_PERCENT_PER_TIER;
