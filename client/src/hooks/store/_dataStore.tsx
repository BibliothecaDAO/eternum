import { HyperStructureInterface } from "../helpers/useHyperstructure";
import { CasinoInterface, BettingRoundInterface } from "../helpers/useCasino";

export interface DataStore {
  hyperstructures: (HyperStructureInterface | undefined)[];
  setHyperstructures: (hyperstructures: (HyperStructureInterface | undefined)[]) => void;
  casinos: (CasinoInterface | undefined)[];
  setCasinos: (casino: (CasinoInterface | undefined)[]) => void;
  casinoRounds: (BettingRoundInterface | undefined)[];
  setBettingRounds: (casinoRounds: (BettingRoundInterface | undefined)[]) => void;
}
export const createDataStoreSlice = (set: any) => ({
  hyperstructures: [] as (HyperStructureInterface | undefined)[],
  setHyperstructures: (hyperstructures: (HyperStructureInterface | undefined)[]) => set({ hyperstructures }),
  casinos: [] as (CasinoInterface | undefined)[],
  setCasinos: (casinos: (CasinoInterface | undefined)[]) => set({ casinos }),
  casinoRounds: [] as (BettingRoundInterface | undefined)[],
  setBettingRounds: (casinoRounds: (BettingRoundInterface | undefined)[]) => set({ casinoRounds }),
});
