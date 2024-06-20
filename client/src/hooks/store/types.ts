import { CombatTarget } from "@/types";
import { Realm, Structure } from "../helpers/useStructures";

export type BattleViewInfo = {
  currentBattleEntityId: bigint | undefined;
  target: { type: CombatTarget; entities: bigint | Realm | Structure } | undefined;
};
