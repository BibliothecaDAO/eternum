import { getOrderName, orders } from "@bibliothecadao/eternum";
import { create } from "zustand";
import { getEntityIdFromKeys } from "../../utils/utils";
import { getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../../DojoContext";
import { useGetRealms, useRealm } from "../helpers/useRealm";
import { useEffect } from "react";
import useRealmStore from "./useRealmStore";
import { getRealmOrderNameById } from "../../utils/realms";

export interface RealmLordsLeaderboardInterface {
  address: string;
  addressName: string;
  order: string;
  totalLords: number;
  isYours: boolean;
}

export interface OrderLordsLeaderboardInterface {
  order: string;
  realmCount: number;
  totalLords: number;
  isYours: boolean;
}

interface LeaderboardStore {
  loading: boolean;
  setLoading: (loading: boolean) => void;
  realmLordsLeaderboard: RealmLordsLeaderboardInterface[];
  orderLordsLeaderboard: OrderLordsLeaderboardInterface[];
  setLordsLeaderboards: (
    realmLordsLeaderboard: RealmLordsLeaderboardInterface[],
    orderLordsLeaderboard: OrderLordsLeaderboardInterface[],
  ) => void;
}

const useLeaderBoardStore = create<LeaderboardStore>((set, get) => {
  return {
    loading: false,
    realmLordsLeaderboard: [],
    orderLordsLeaderboard: [],
    setLordsLeaderboards: (
      realmLordsLeaderboard: RealmLordsLeaderboardInterface[],
      orderLordsLeaderboard: OrderLordsLeaderboardInterface[],
    ) => set({ realmLordsLeaderboard, orderLordsLeaderboard }),
    setLoading: (loading) => set({ loading }),
  };
});

export const useComputeLordsLeaderboards = () => {
  const {
    account: { account },
    setup: {
      components: { Resource },
    },
  } = useDojo();

  const { setLordsLeaderboards } = useLeaderBoardStore();
  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);

  const { getAddressName } = useRealm();

  const realms = useGetRealms();

  useEffect(() => {
    // todo: add player order to the useRealmStore
    const playerOrder = getRealmOrderNameById(realmEntityIds[0].realmId);

    const realmLordsLeaderboard: RealmLordsLeaderboardInterface[] = [];
    const orderLordsLeaderboard: Record<string, OrderLordsLeaderboardInterface> = {};
    orders
      // don't include order of the gods
      .filter((order) => order.orderId !== 17)
      .forEach((order) => {
        const isYours = order.orderName.toLowerCase() === playerOrder;
        orderLordsLeaderboard[order.orderName] = {
          order: order.orderName,
          realmCount: 0,
          totalLords: 0,
          isYours,
        };
      });

    for (const realm of realms) {
      const lordsAmounts = getComponentValue(Resource, getEntityIdFromKeys([realm.entity_id, 253n]));
      if (lordsAmounts && lordsAmounts?.balance > 100000000) continue;
      let order = getOrderName(realm.order);
      let owner = "0x" + realm.owner?.toString(16) || "0x0";
      const isYours = account.address === owner;
      realmLordsLeaderboard.push({
        address: owner,
        addressName: getAddressName(owner) || "",
        order,
        totalLords: Number(lordsAmounts?.balance) || 0,
        isYours,
      });

      if (!orderLordsLeaderboard[order]) {
        orderLordsLeaderboard[order] = {
          order,
          realmCount: 1,
          totalLords: Number(lordsAmounts?.balance) || 0,
          isYours: order === playerOrder,
        };
      } else {
        orderLordsLeaderboard[order].realmCount++;
        orderLordsLeaderboard[order].totalLords += Number(lordsAmounts?.balance) || 0;
      }
    }

    // sort by total lords
    setLordsLeaderboards(
      realmLordsLeaderboard.sort((a, b) => b.totalLords - a.totalLords),
      Object.values(orderLordsLeaderboard).sort((a, b) => b.totalLords - a.totalLords),
    );
  }, []);
};

export default useLeaderBoardStore;
