import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/ui/constants";
import { ID, Structure } from "@bibliothecadao/types";

export interface RealmStore {
  structureEntityId: ID;
  setStructureEntityId: (structureEntityId: ID) => void;
  playerStructures: Structure[];
  setPlayerStructures: (playerStructures: Structure[]) => void;
  arrivedArrivalsNumber: number;
  setArrivedArrivalsNumber: (arrivedArrivalsNumber: number) => void;
  pendingArrivalsNumber: number;
  setPendingArrivalsNumber: (pendingArrivalsNumber: number) => void;
}

export const createRealmStoreSlice = (set: any) => ({
  structureEntityId: UNDEFINED_STRUCTURE_ENTITY_ID,
  setStructureEntityId: (structureEntityId: ID) => set({ structureEntityId }),
  playerStructures: [],
  setPlayerStructures: (playerStructures: Structure[]) => set({ playerStructures }),
  arrivedArrivalsNumber: 0,
  setArrivedArrivalsNumber: (arrivedArrivalsNumber: number) => set({ arrivedArrivalsNumber }),
  pendingArrivalsNumber: 0,
  setPendingArrivalsNumber: (pendingArrivalsNumber: number) => set({ pendingArrivalsNumber }),
});
