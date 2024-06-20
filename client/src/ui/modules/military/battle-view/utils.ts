import { ArmyInfo } from "@/hooks/helpers/useArmies";

export const getOwnArmy = (armyA: ArmyInfo, armyB: ArmyInfo): ArmyInfo | undefined => {
  return armyA.isMine ? armyA : armyB.isMine ? armyB : undefined;
};
