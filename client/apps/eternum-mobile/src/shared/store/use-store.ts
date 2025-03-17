import { create } from "zustand";
import { AccountStore, createAccountStoreSlice } from "./use-account-store";
import { createWorldStoreSlice, WorldStore } from "./use-world-loading";

type Store = WorldStore & AccountStore;

export const useStore = create<Store>((set) => ({
  ...createWorldStoreSlice(set),
  ...createAccountStoreSlice(set),
}));
