export enum Action {
  Engage,
  Interact,
  Join,
  View,
}

export type BattleViewInfo = {
  battle: bigint | undefined;
  engage?: boolean;
  ownArmyEntityId: bigint | undefined;
  targetArmy: bigint | undefined;
};
