import { type BattleEventSystemUpdate } from "@bibliothecadao/eternum";
import { type HexPosition, type ID } from "@bibliothecadao/types";

import type { CombatPresentationCoordinator } from "@/three/combat/combat-presentation-coordinator";
import type { ArmyData } from "@/three/types/common";

import { getWorldPositionForHex } from "../utils";

type CombatPresentationArmies = {
  getArmy(entityId: ID): Pick<ArmyData, "category" | "tier"> | undefined;
};

export interface WorldmapCombatPresentationDeps {
  armyManager: CombatPresentationArmies;
  getCombatPresentation: () => CombatPresentationCoordinator | undefined;
  getArmyDisplayPosition: (entityId: ID) => HexPosition | undefined;
  getStructureHexPosition: (entityId: ID) => HexPosition | undefined;
}

export class WorldmapCombatPresentation {
  constructor(private readonly deps: WorldmapCombatPresentationDeps) {}

  replayIndexed(update: BattleEventSystemUpdate): void {
    const { attackerId, defenderId } = update.battleData;
    const attacker = this.deps.armyManager.getArmy(attackerId);
    if (!attacker) return;
    const attackerHex = this.deps.getArmyDisplayPosition(attackerId);
    const defenderHex = this.deps.getArmyDisplayPosition(defenderId) ?? this.deps.getStructureHexPosition(defenderId);
    if (!attackerHex || !defenderHex) return;
    const origin = getWorldPositionForHex(attackerHex);
    const target = getWorldPositionForHex(defenderHex);
    const presentation = {
      attackerId,
      defenderId,
      origin,
      target,
      tier: attacker.tier,
      troopType: attacker.category,
    };
    this.deps.getCombatPresentation()?.replayIndexed(presentation);
  }
}
