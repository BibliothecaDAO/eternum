import { HyperStructureInterface } from "@bibliothecadao/eternum";
export interface DataStore {
  hyperstructures: (HyperStructureInterface | undefined)[];
  setHyperstructures: (hyperstructures: (HyperStructureInterface | undefined)[]) => void;
}
export const createDataStoreSlice = (set: any) => ({
  hyperstructures: [] as (HyperStructureInterface | undefined)[],
  setHyperstructures: (hyperstructures: (HyperStructureInterface | undefined)[]) => set({ hyperstructures }),
});
