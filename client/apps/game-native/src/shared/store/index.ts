import {create} from 'zustand';
import {subscribeWithSelector} from 'zustand/middleware';
import {AccountSlice, createAccountSlice} from './slices/account-slice';
import {WorldSlice, createWorldSlice} from './slices/world-loading-slice';
import {
  StructuresSlice,
  createStructuresSlice,
} from './slices/structures-slice';
import {UISlice, createUISlice} from './slices/ui-slice';
import {CommandSlice, createCommandSlice} from './slices/command-slice';
import {ChatSlice, createChatSlice} from './slices/chat-slice';

export type Store = WorldSlice & AccountSlice & StructuresSlice & UISlice & CommandSlice & ChatSlice;

export const useStore = create<Store>()(
  subscribeWithSelector<Store>((set, _get) => ({
    ...createWorldSlice(set),
    ...createAccountSlice(set),
    ...createStructuresSlice(set),
    ...createUISlice(set),
    ...createCommandSlice(set),
    ...createChatSlice(set),
  })),
);

export default useStore;
