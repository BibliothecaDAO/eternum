import { ID, StructureType } from "@bibliothecadao/eternum";

export type BattleViewInfo = {
  battleEntityId: ID | undefined;
  engage?: boolean;
  ownArmyEntityId: ID | undefined;
  targetArmy: ID | undefined;
};

export interface StructureInfo {
  entityId: ID;
  hexCoords: { col: number; row: number };
  stage: number;
  level: number;
  isMine: boolean;
  owner: { address: bigint };
  structureType: StructureType;
  hasWonder: boolean;
}

export enum RightView {
  None,
  ResourceTable,
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
