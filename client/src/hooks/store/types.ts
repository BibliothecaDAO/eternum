import { ID } from "@bibliothecadao/eternum";

export type BattleViewInfo = {
  battleEntityId: ID | undefined;
  engage?: boolean;
  ownArmyEntityId: ID | undefined;
  targetArmy: ID | undefined;
};
