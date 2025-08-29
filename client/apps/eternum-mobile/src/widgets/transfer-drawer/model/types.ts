import { ActorType, ID } from "@bibliothecadao/types";

export enum TransferDirection {
  ExplorerToStructure,
  StructureToExplorer,
  ExplorerToExplorer,
}

export enum TransferType {
  Resources,
  Troops,
}

export interface ResourceTransfer {
  resourceId: number;
  amount: number;
}

export interface TransferEntity {
  type: ActorType;
  id: ID;
  hex: { x: number; y: number };
}

export interface TransferDrawerProps {
  selected: TransferEntity;
  target: TransferEntity;
  allowBothDirections?: boolean;
}

export const getActorTypes = (direction: TransferDirection) => {
  if (direction === TransferDirection.ExplorerToStructure) {
    return { selected: ActorType.Explorer, target: ActorType.Structure };
  } else if (direction === TransferDirection.StructureToExplorer) {
    return { selected: ActorType.Structure, target: ActorType.Explorer };
  } else {
    return { selected: ActorType.Explorer, target: ActorType.Explorer };
  }
};