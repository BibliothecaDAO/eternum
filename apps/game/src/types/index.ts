import { EntityType, ID, Position, StructureType } from "@bibliothecadao/types";

export enum LeftView {
  None,
  MilitaryView,
  EntityView,
  ConstructionView,
  BridgeView,
  HyperstructuresView,
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
