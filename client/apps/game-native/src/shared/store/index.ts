import {create} from 'zustand';
import {subscribeWithSelector} from 'zustand/middleware';
import {AccountSlice, createAccountSlice} from './slices/account-slice';
import {WorldSlice, createWorldSlice} from './slices/world-loading-slice';
import {
  StructuresSlice,
  createStructuresSlice,
} from './slices/structures-slice';
import {UISlice, createUISlice} from './slices/ui-slice';

export type Store = WorldSlice & AccountSlice & StructuresSlice & UISlice;

export const useStore = create<Store>()(
  subscribeWithSelector<Store>((set, _get) => ({
    ...createWorldSlice(set),
    ...createAccountSlice(set),
    ...createStructuresSlice(set),
    ...createUISlice(set),
  })),
);

export default useStore;
