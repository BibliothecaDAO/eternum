export type BattleViewInfo = {
  battle: bigint | undefined;
  engage?: boolean;
  ownArmyEntityId: bigint | undefined;
  targetArmy: bigint | undefined;
};
