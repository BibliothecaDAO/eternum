import { create } from "zustand";
import { AccountSlice, createAccountSlice } from "./slices/account-slice";
import { createStructuresSlice, StructuresSlice } from "./slices/structures-slice";
import { createToSSlice, ToSSlice } from "./slices/tos-slice";
import { createWorldSlice, WorldSlice } from "./slices/world-loading-slice";

type Store = WorldSlice & AccountSlice & StructuresSlice & ToSSlice;

export const useStore = create<Store>((set) => ({
  ...createWorldSlice(set),
  ...createAccountSlice(set),
  ...createStructuresSlice(set),
  ...createToSSlice(set),
}));

export default useStore;
