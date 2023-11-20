import { create } from "zustand";
import { numberToHex } from "../../utils/utils";
import { Event, pollForEvents } from "../graphql/useLeaderboard";
import { Resource } from "../../types";

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

    const syncDataInternal = async (realmEntityId) => {
      const processEvents = (event: Event) => {
        const attackers_len = parseInt(event.data[0]);
        let attacking_entity_ids = [];
        for (let i = 0; i < attackers_len; i++) {
          attacking_entity_ids.push(parseInt(event.data[1 + i]));
        }
        const winner = parseInt(event.data[1 + attackers_len]) === 0 ? Winner.Attacker : Winner.Target;
        const stolen_resources_ids_len = parseInt(event.data[2 + attackers_len]);
        let stolen_resources: Resource[] = [];
        let nextIndex = 3 + attackers_len + stolen_resources_ids_len + 1;
        for (let i = 0; i < stolen_resources_ids_len; i++) {
          stolen_resources.push({
            resourceId: parseInt(event.data[3 + attackers_len + i]),
            amount: parseInt(event.data[nextIndex]),
          });
          nextIndex += 1;
        }
        let damage: number | undefined;
        let attackTimestamp: number | undefined;
        if (event.data.length > nextIndex) {
          damage = parseInt(event.data[nextIndex]);
          attackTimestamp = parseInt(event.data[nextIndex + 1]);
        }

        let result: CombatResultInterface = {
          attackerRealmEntityId: parseInt(event.keys[1]),
          targetRealmEntityId: parseInt(event.keys[2]),
          attackingEntityIds: attacking_entity_ids,
          winner,
          stolenResources: stolen_resources,
          damage,
          attackTimestamp,
        };
        get().addOrUpdateCombatEntry(result);
      };

      // Keccak for Combat event
      await pollForEvents(
        ["0x30f73782da72e6613eab4ee2cf2ebc3d75cb02d6dd8c537483bb2717a2afb57", "*", numberToHex(realmEntityId)],
        processEvents,
        20,
      );
    };

    syncDataInternal(realmEntityId).then(() => {
      set({ loading: false });
    });
  },
}));

export default useCombatHistoryStore;
