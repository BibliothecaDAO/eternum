import { StructureType } from "@bibliothecadao/eternum";
import { Hexagon, TravelPath } from "../../types";

export interface MapStore {
  hexData: Hexagon[] | undefined;
  setHexData: (hexData: Hexagon[]) => void;
  existingStructures: { col: number; row: number; type: StructureType; entityId: bigint }[];
  setExistingStructures: (
    existingStructures: { col: number; row: number; type: StructureType; entityId: bigint }[],
  ) => void;
}

export const createMapStoreSlice = (set: any) => ({
  hexData: undefined,
  setHexData: (hexData: Hexagon[]) => {
    set({ hexData });
  },
  existingStructures: [],
  setExistingStructures: (existingStructures: { col: number; row: number; type: StructureType; entityId: bigint }[]) =>
    set({ existingStructures }),
});
