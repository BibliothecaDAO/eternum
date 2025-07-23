import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { AccountSlice, createAccountSlice } from "./slices/account-slice";
import { createSelectionSlice, SelectionSlice } from "./slices/selection-slice";
import { createStructuresSlice, StructuresSlice } from "./slices/structures-slice";
import { createWorldSlice, WorldSlice } from "./slices/world-loading-slice";

type Store = WorldSlice & AccountSlice & StructuresSlice & SelectionSlice;

export const useStore = create<Store>()(
  subscribeWithSelector<Store>((set, get) => ({
    ...createWorldSlice(set),
    ...createAccountSlice(set),
    ...createStructuresSlice(set),
    ...createSelectionSlice(set, get),
  })),
);

export default useStore;
