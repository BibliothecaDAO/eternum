import { CombatTarget } from "@/types";
import { Realm, Structure } from "../helpers/useStructures";

export type BattleViewInfo = {
  attackers: bigint[];
  defenders: { type: CombatTarget; entities: bigint[] | Realm | Structure };
};
