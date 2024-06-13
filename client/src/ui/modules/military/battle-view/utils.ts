import { ArmyInfo } from "@/hooks/helpers/useArmies";

export const getOwnArmy = (armyA: ArmyInfo, armyB: ArmyInfo): ArmyInfo | undefined => {
  return armyA.isMine ? armyA : armyB.isMine ? armyB : undefined;
};

export const getAttackerDefender = (
  armyA: ArmyInfo,
  armyB: ArmyInfo,
): { attackerArmy: ArmyInfo; defenderArmy: ArmyInfo } => {
  return String(armyA.battle_side) === "Attack" || armyA.isMine
    ? { attackerArmy: armyA, defenderArmy: armyB }
    : { attackerArmy: armyB, defenderArmy: armyA };
};
