import { CombatTarget } from "@/types";
import { ArmyInfo } from "../helpers/useArmies";
import { FullStructure } from "../helpers/useStructures";

export type BattleViewInfo = {
  attackers: ArmyInfo[];
  defenders: { type: CombatTarget; entities: ArmyInfo[] | FullStructure };
};
