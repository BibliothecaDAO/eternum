import { create } from "zustand";
import { numberToHex } from "../../utils/utils";
import { pollForEvents, Event } from "../../services/eventPoller";
import { Resource } from "../../types";
import { parseCombatEvent } from "../../utils/combat";
import { COMBAT_EVENT } from "@bibliothecadao/eternum";

export enum Winner {
  Attacker = "Attacker",
  Target = "Target",
}

export interface CombatResultInterface {
  attackerRealmEntityId: number;
  targetRealmEntityId: number;
  attackingEntityIds: number[];
  winner: Winner;
  stolenResources: Resource[];
  damage: number | undefined;
  attackTimestamp: number | undefined;
}

interface CombatHistoryStore {
  loading: boolean;
  setLoading: (loading: boolean) => void;
  progress: number;
  setProgress: (progress: number) => void;
  combatHistory: CombatResultInterface[];
  addOrUpdateCombatEntry: (result: CombatResultInterface) => void;
  syncData: (realmEntityId: number) => void;
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

    const syncDataInternal = async (realmEntityId: number) => {
      const processEvents = (event: Event) => {
        let result = parseCombatEvent(event);
        get().addOrUpdateCombatEntry(result);
      };

      // Keccak for Combat event
      await pollForEvents([COMBAT_EVENT, "*", numberToHex(realmEntityId)], processEvents, 20);
    };

    syncDataInternal(realmEntityId).then(() => {
      set({ loading: false });
    });
  },
}));

export default useCombatHistoryStore;
