import { CombatTarget } from "@/types";
import { Realm, Structure } from "../helpers/useStructures";
import { Position } from "@bibliothecadao/eternum";

export type BattleViewInfo = {
  battle: Position | undefined;
  target: { type: CombatTarget; entity: bigint | Realm | Structure } | undefined;
};
