import { getOrderName, orders } from "@bibliothecadao/eternum";
import { create } from "zustand";
import { getEntityIdFromKeys } from "../../ui/utils/utils";
import { getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../context/DojoContext";
import { useGetRealms, useRealm } from "../helpers/useRealm";
import { useEffect } from "react";
import { useEntities } from "../helpers/useEntities";

export interface PlayerResourceLeaderboardInterface {
  address: string;
  addressName: string;
  order: string;
  totalResources: number;
  isYours: boolean;
}

export interface OrderResourceLeaderboardInterface {
  order: string;
  realmCount: number;
  totalResources: number;
  isYours: boolean;
}

interface LeaderboardStore {
  loading: boolean;
  setLoading: (loading: boolean) => void;
  playerResourceLeaderboard: PlayerResourceLeaderboardInterface[];
  orderResourceLeaderboard: OrderResourceLeaderboardInterface[];
  setResourceLeaderboards: (
    playerResourceLeaderboard: PlayerResourceLeaderboardInterface[],
    orderResourceLeaderboard: OrderResourceLeaderboardInterface[],
  ) => void;
}

const useLeaderBoardStore = create<LeaderboardStore>((set) => {
  return {
    loading: false,
    playerResourceLeaderboard: [],
    orderResourceLeaderboard: [],
    setResourceLeaderboards: (
      playermResourceLeaderboard: PlayerResourceLeaderboardInterface[],
      orderResourceLeaderboard: OrderResourceLeaderboardInterface[],
    ) => set({ playerResourceLeaderboard: playermResourceLeaderboard, orderResourceLeaderboard }),
    setLoading: (loading) => set({ loading }),
  };
});

export const useComputeResourceLeaderboards = (resourceId: bigint) => {
  const {
    account: { account },
    setup: {
      components: { Resource, Realm },
    },
  } = useDojo();

  const { setResourceLeaderboards } = useLeaderBoardStore();
  const { playerRealms } = useEntities();

  const { getAddressName } = useRealm();

  // todo: do entities like bank accounts as well
  const realms = useGetRealms();

  useEffect(() => {
    const playerOrder = getOrderName(
      getComponentValue(Realm, getEntityIdFromKeys([playerRealms()[0]?.entity_id || 0n]))?.order || 0,
    );

    const playerResourceLeaderboard: PlayerResourceLeaderboardInterface[] = [];
    const orderResourceLeaderboard: Record<string, OrderResourceLeaderboardInterface> = {};
    orders
      .filter((order) => order.orderId !== 17)
      .forEach((order) => {
        const isYours = order.orderName.toLowerCase() === playerOrder;
        orderResourceLeaderboard[order.orderName] = {
          order: order.orderName,
          realmCount: 0,
          totalResources: 0,
          isYours,
        };
      });

    for (const realm of realms) {
      const owner = "0x" + realm.owner?.toString(16) || "0x0";
      const resourceAmounts = getComponentValue(Resource, getEntityIdFromKeys([realm.entity_id, resourceId]));
      if (resourceAmounts && resourceAmounts?.balance > 100000000) continue;
      let order = getOrderName(realm.order);
      const isYours = account.address === owner;
      const existingEntryIndex = playerResourceLeaderboard.findIndex((entry) => entry.address === owner);
      if (existingEntryIndex !== -1) {
        playerResourceLeaderboard[existingEntryIndex].totalResources += Number(resourceAmounts?.balance) || 0;
      } else {
        playerResourceLeaderboard.push({
          address: owner,
          addressName: getAddressName(owner) || "",
          order,
          totalResources: Number(resourceAmounts?.balance) || 0,
          isYours,
        });
      }

      if (!orderResourceLeaderboard[order]) {
        orderResourceLeaderboard[order] = {
          order,
          realmCount: 1,
          totalResources: Number(resourceAmounts?.balance) || 0,
          isYours: order === playerOrder,
        };
      } else {
        orderResourceLeaderboard[order].realmCount++;
        orderResourceLeaderboard[order].totalResources += Number(resourceAmounts?.balance) || 0;
      }
    }

    setResourceLeaderboards(
      playerResourceLeaderboard.sort((a, b) => b.totalResources - a.totalResources),
      Object.values(orderResourceLeaderboard).sort((a, b) => b.totalResources - a.totalResources),
    );
  }, [resourceId]);
};

export default useLeaderBoardStore;
