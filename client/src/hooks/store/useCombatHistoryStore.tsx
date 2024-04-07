import { create } from "zustand";
import { numberToHex } from "../../ui/utils/utils";
import { pollForEvents, Event } from "../eventPoller";
import { parseCombatEvent } from "../../ui/utils/combat";
import { COMBAT_EVENT } from "@bibliothecadao/eternum";
import { CombatResultInterface } from "@bibliothecadao/eternum";

interface CombatHistoryStore {
  loading: boolean;
  setLoading: (loading: boolean) => void;
  progress: number;
  setProgress: (progress: number) => void;
  combatHistory: CombatResultInterface[];
  addOrUpdateCombatEntry: (result: CombatResultInterface) => void;
  syncData: (realmEntityId: bigint) => void;
}

const useCombatHistoryStore = create<CombatHistoryStore>((set, get) => ({
  loading: false,
  progress: 0,
  combatHistory: [],

  setLoading: (loading) => set({ loading }),
  setProgress: (progress) => set({ progress }),

  // Function to add or update a leaderboard entry
  addOrUpdateCombatEntry: (result: CombatResultInterface) => {
    set((state) => {
      return { combatHistory: [...state.combatHistory, result] };
    });
  },

  syncData: async (realmEntityId) => {
    set({ loading: true });
    set({ combatHistory: [] });

    const syncDataInternal = async (realmEntityId: bigint) => {
      const processEvents = (event: Event) => {
        let result = parseCombatEvent(event);
        get().addOrUpdateCombatEntry(result);
      };

      // Keccak for Combat event
      await pollForEvents([COMBAT_EVENT, "*", numberToHex(Number(realmEntityId))], processEvents, 20);
    };

    syncDataInternal(realmEntityId).then(() => {
      set({ loading: false });
    });
  },
}));

export default useCombatHistoryStore;
