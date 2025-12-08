import { ID } from "@bibliothecadao/types";

export enum RightView {
  None,
  Bridge,
  Automation,
  Transfer,
  StoryEvents,
}

export enum LeftView {
  None,
  MilitaryView,
  EntityView,
  ConstructionView,
  HyperstructuresView,
  ResourceArrivals,
  ChatView,
  StoryEvents,
  ResourceTable,
  RelicsView,
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
