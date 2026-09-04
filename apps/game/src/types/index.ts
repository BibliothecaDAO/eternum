import { EntityType, ID, Position, StructureType } from "@bibliothecadao/types";

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

export interface RelicInventory {
  resourceId: ID;
  amount: number;
}

export interface EntityWithRelics {
  entityId: ID;
  position: Position;
  structureType?: StructureType;
  type: EntityType;
  relics: RelicInventory[];
}

export interface PlayerRelicsData {
  structures: EntityWithRelics[];
  armies: EntityWithRelics[];
}
