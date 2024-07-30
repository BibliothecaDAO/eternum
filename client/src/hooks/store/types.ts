import { ID } from "@bibliothecadao/eternum";

export type BattleViewInfo = {
  battle: ID | undefined;
  engage?: boolean;
  ownArmyEntityId: ID | undefined;
  targetArmy: ID | undefined;
};
