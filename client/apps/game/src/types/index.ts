import { ID } from "@bibliothecadao/types";

export enum RightView {
  None,
  ResourceTable,
  Production,
  Bridge,
  Automation,
  Logs,
  Transfer,
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
