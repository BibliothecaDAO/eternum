import { HyperStructureInterface } from "@bibliothecadao/eternum";
export interface DataStore {
  hyperstructures: (HyperStructureInterface | undefined)[];
  setHyperstructures: (
    hyperstructures: (HyperStructureInterface | undefined)[],
    conqueredHyperstructureNumber: number,
  ) => void;
  conqueredHyperstructureNumber: number;
}
export const createDataStoreSlice = (set: any) => ({
  hyperstructures: [] as (HyperStructureInterface | undefined)[],
  setHyperstructures: (
    hyperstructures: (HyperStructureInterface | undefined)[],
    conqueredHyperstructureNumber: number,
  ) => set({ hyperstructures, conqueredHyperstructureNumber }),
  conqueredHyperstructureNumber: 0,
});
