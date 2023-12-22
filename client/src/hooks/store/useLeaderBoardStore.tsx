import { TRANSFER_EVENT, foodProb, orderNameDict, resourceProb } from "@bibliothecadao/eternum";
import { create } from "zustand";
import { divideByPrecision, getEntityIdFromKeys, numberToHex } from "../../utils/utils";
import { getRealm } from "../../utils/realms";
import { pollForEvents, Event } from "../../services/eventPoller";
import { Components, getComponentValue } from "@dojoengine/recs";

export interface LeaderboardInterface {
  address: string;
  order: string;
  total_transfers: number;
  total_amount: number;
  total_points: number;
}

interface LeaderboardStore {
  loading: boolean;
  setLoading: (loading: boolean) => void;
  progress: number;
  setProgress: (progress: number) => void;
  leaderboard: Record<string, LeaderboardInterface>;
  addOrUpdateLeaderboardEntry: (address: bigint, realmId: bigint, resourceAmount: number, resourceId: number) => void;
  syncData: (hyperstructureIds: bigint[], components: Components) => void;
}

const useLeaderBoardStore = create<LeaderboardStore>((set, get) => {
  return {
    loading: false,
    progress: 0,
    leaderboard: {},

    setLoading: (loading) => set({ loading }),
    setProgress: (progress) => set({ progress }),

    // Function to add or update a leaderboard entry
    addOrUpdateLeaderboardEntry: (address: bigint, realmId: bigint, resourceAmount: number, resourceId: number) => {
      let addressString = "0x" + address.toString(16);
      set((state) => {
        const newLeaderboard = { ...state.leaderboard };
        if (newLeaderboard[addressString]) {
          newLeaderboard[addressString].total_transfers += 1;
          newLeaderboard[addressString].total_amount += resourceAmount;
          newLeaderboard[addressString].total_points += calculatePoints(resourceId, resourceAmount);
        } else {
          let realm = getRealm(realmId);
          let orderName = orderNameDict[realm.order];
          newLeaderboard[addressString] = {
            address: addressString,
            order: orderName,
            total_transfers: 1,
            total_amount: resourceAmount,
            total_points: calculatePoints(resourceId, resourceAmount),
          };
        }
        return { leaderboard: newLeaderboard };
      });
    },

    syncData: async (hyperstructureIds, components) => {
      set({ loading: true });
      set({ leaderboard: {} });

      const syncDataInternal = async (hyperstructureId: bigint) => {
        const processEvents = (event: Event) => {
          const realmId = BigInt(event.keys[2]);
          const realmEntityId = BigInt(event.data[0]);
          const resources_len = parseInt(event.data[1]);
          const owner = getComponentValue(components["Owner"], getEntityIdFromKeys([realmEntityId]));
          if (!owner) return;
          for (let i = 0; i < resources_len; i += 1) {
            const resourceId = parseInt(event.data[2 + 2 * i]);
            const resourceAmount = parseInt(event.data[2 + 2 * i + 1]);
            if (realmId === 0n) continue;
            get().addOrUpdateLeaderboardEntry(owner.address, realmId, resourceAmount, resourceId);
          }
        };

        // Keccak for Transfer event
        await pollForEvents([TRANSFER_EVENT, numberToHex(Number(hyperstructureId)), "*"], processEvents);
      };

      await Promise.all(hyperstructureIds.map(syncDataInternal)).finally(() => {
        set({ loading: false });
      });
    },
  };
});

export const calculatePoints = (resourceId: number, amount: number): number => {
  let prob: number | undefined;

  if (resourceId === 254) {
    prob = foodProb[0];
  } else if (resourceId === 255) {
    prob = foodProb[1];
  } else {
    prob = resourceProb[resourceId - 1];
  }

  if (prob) {
    const weight = 1 / prob;
    return divideByPrecision(amount) * weight;
  } else {
    return 0;
  }
};

export default useLeaderBoardStore;
