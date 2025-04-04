import { ID } from "@bibliothecadao/eternum";

export enum RightView {
  None,
  ResourceTable,
  Production,
}

export enum LeftView {
  None,
  MilitaryView,
  EntityView,
  ConstructionView,
  WorldStructuresView,
  ResourceArrivals,
  ResourceTable,
}

export type BattleViewInfo = {
  battleEntityId: ID | undefined;
  engage?: boolean;
  ownArmyEntityId: ID | undefined;
  targetArmy: ID | undefined;
};

export enum ToriiSetting {
  Local = "local",
  Remote = "remote",
}
