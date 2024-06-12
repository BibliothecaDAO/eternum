import { CombatTarget } from "@/types";
import { ArmyInfo } from "../helpers/useArmies";
import { FullStructure } from "../helpers/useStructures";

export type BattleViewInfo = {
  ownArmy: ArmyInfo;
  opponentEntity: { type: CombatTarget; entity: ArmyInfo | FullStructure };
};
