import { ID } from "@bibliothecadao/types";

export enum LeftView {
  None,
  MilitaryView,
  EntityView,
  ConstructionView,
  BridgeView,
  HyperstructuresView,
  ResourceArrivals,
  ChatView,
  StoryEvents,
  ResourceTable,
  RelicsView,
  PredictionMarket,
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
