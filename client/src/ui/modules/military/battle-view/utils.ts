import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { Realm, Structure } from "@/hooks/helpers/useStructures";
import { CombatTarget } from "@/types";

export const getOwnArmy = (armyA: ArmyInfo, armyB: ArmyInfo): ArmyInfo | undefined => {
  return armyA.isMine ? armyA : armyB.isMine ? armyB : undefined;
};

export const getDefenderAndStructureFromTarget = (target: {
  type: CombatTarget;
  entity: bigint | Realm | Structure;
}): {
  defender: bigint | undefined;
  structure: Realm | Structure | undefined;
} => {
  if (target.type === CombatTarget.Army) {
    return {
      defender: target.entity as bigint,
      structure: undefined,
    };
  } else if (target.type === CombatTarget.Structure) {
    return {
      defender: BigInt((target.entity as Realm | Structure).protector?.entity_id || 0n),
      structure: target.entity as Realm | Structure,
    };
  }
  return { defender: undefined, structure: undefined };
};
