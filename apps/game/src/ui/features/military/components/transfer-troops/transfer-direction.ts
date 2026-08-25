import { ActorType } from "@bibliothecadao/types";

export enum TransferDirection {
  ExplorerToStructure,
  StructureToExplorer,
  ExplorerToExplorer,
}

export const getActorTypes = (direction: TransferDirection) => {
  if (direction === TransferDirection.ExplorerToStructure) {
    return { selected: ActorType.Explorer, target: ActorType.Structure };
  }
  if (direction === TransferDirection.StructureToExplorer) {
    return { selected: ActorType.Structure, target: ActorType.Explorer };
  }
  return { selected: ActorType.Explorer, target: ActorType.Explorer };
};
