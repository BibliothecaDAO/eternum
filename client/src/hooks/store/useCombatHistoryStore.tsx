import { create } from "zustand";
import { numberToHex } from "../../ui/utils/utils";
import { pollForEvents, Event } from "../eventPoller";
import { COMBAT_EVENT } from "@bibliothecadao/eternum";
import { CombatResultInterface, Resource, Winner } from "@bibliothecadao/eternum";
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

const parseCombatEvent = (event: Event): CombatResultInterface => {
  const attackers_len = parseInt(event.data[0]);
  let attacking_entity_ids = [];
  for (let i = 0; i < attackers_len; i++) {
    attacking_entity_ids.push(BigInt(event.data[1 + i]));
  }
  const stolen_resources_ids_len = parseInt(event.data[1 + attackers_len]);
  let stolen_resources: Resource[] = [];
  let nextIndex = 2 + attackers_len + stolen_resources_ids_len;
  for (let i = 0; i < stolen_resources_ids_len; i++) {
    stolen_resources.push({
      resourceId: parseInt(event.data[2 + attackers_len + i]),
      amount: Number(event.data[nextIndex]),
    });
    nextIndex += 1;
  }

  const stolenChestIdsLen = parseInt(event.data[nextIndex]);
  let stolenChestsIds: bigint[] = [];
  for (let i = 0; i < stolenChestIdsLen; i++) {
    let chest_id = event.data[nextIndex + i + 1];
    stolenChestsIds.push(BigInt(chest_id));
  }

  nextIndex += 1 + stolenChestIdsLen;

  const winner = parseInt(event.data[nextIndex]) === 0 ? Winner.Attacker : Winner.Target;
  nextIndex += 1;
  let damage: number | undefined;
  let attackTimestamp: number | undefined;
  damage = parseInt(event.data[nextIndex]);
  nextIndex += 1;
  attackTimestamp = parseInt(event.data[nextIndex]);

  return {
    attackerRealmEntityId: BigInt(event.keys[1]),
    targetRealmEntityId: BigInt(event.keys[2]),
    attackingEntityIds: attacking_entity_ids,
    winner,
    stolenResources: stolen_resources,
    damage,
    attackTimestamp,
    stolenChestsIds,
  };
};

export default useCombatHistoryStore;
