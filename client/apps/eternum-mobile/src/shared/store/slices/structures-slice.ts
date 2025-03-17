import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/shared/consts";
import { ID } from "@bibliothecadao/eternum";

export interface StructuresSlice {
  structureEntityId: ID;
  setStructureEntityId: (structureEntityId: ID) => void;
}

export const createStructuresSlice = (set: any) => ({
  structureEntityId: UNDEFINED_STRUCTURE_ENTITY_ID,
  setStructureEntityId: (structureEntityId: ID) => set({ structureEntityId }),
});
