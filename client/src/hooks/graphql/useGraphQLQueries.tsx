import { useEffect, useMemo, useState } from "react";
import { GraphQLClient } from "graphql-request";
import { GetRealmIdsQuery, getSdk } from "../../generated/graphql";
import { useDojo } from "../../DojoContext";
import { numberToHex, setComponentFromEntity } from "../../utils/utils";

export enum FetchStatus {
  Idle = "idle",
  Loading = "loading",
  Success = "success",
  Error = "error",
}

const client = new GraphQLClient(import.meta.env.VITE_TORII_URL!);
const sdk = getSdk(client);

export interface RealmLaborInterface {
  [resourceId: number]: LaborInterface;
}

export interface LaborInterface {
  lastHarvest: number;
  balance: number;
  multiplier: number;
}

export const useSyncRealmLabor = (realmEntityId: number) => {
  const {
    setup: { components },
  } = useDojo();
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await sdk.getRealmLabor({
          realmEntityId: numberToHex(realmEntityId),
        });
        data?.entities?.edges?.forEach((edge) => {
          edge?.node && setComponentFromEntity(edge.node, "Labor", components);
        });
      } catch (error) {}
    };
    fetchData();
  }, [realmEntityId]);
};

export const useSyncRealmResources = (realmEntityId: number) => {
  const {
    setup: { components },
  } = useDojo();
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await sdk.getRealmResources({
          realmEntityId: numberToHex(realmEntityId),
        });
        data?.entities?.edges?.forEach((edge) => {
          edge?.node &&
            setComponentFromEntity(edge.node, "Resource", components);
        });
      } catch (error) {}
    };
    fetchData();
  }, [realmEntityId]);
};

export interface IncomingOrderInterface {
  orderId: number;
  counterPartyOrderId: number;
  claimed: boolean;
  tradeId: number;
}

export interface IncomingOrdersInterface {
  incomingOrders: IncomingOrderInterface[];
}

// TODO: when going from Caravan Panel to IncomingOrders panel, there is no loading, data is shown directly
// but when going from IncomingOrders to Market, and back to IncomingOrders, it gets reloaded (2 sec time delay), need to investigate, might be because the same trades are queried for
// incoming orders and market in the syncing hooks
export const useSyncIncomingOrders = (realmEntityId: number) => {
  const {
    setup: { components },
  } = useDojo();
  useMemo(() => {
    const fetchData = async () => {
      try {
        const { data } = await sdk.getIncomingOrders({
          realmEntityId: numberToHex(realmEntityId),
        });
        data?.makerTradeComponents?.edges?.forEach((edge) => {
          edge?.node?.entity &&
            setComponentFromEntity(edge.node.entity, "Trade", components);
        });
        data?.takerTradeComponents?.edges?.forEach((edge) => {
          edge?.node?.entity &&
            setComponentFromEntity(edge.node.entity, "Trade", components);
        });
      } catch (error) {}
    };
    fetchData();
  }, [realmEntityId]);
};

export interface IncomingOrderInfoInterface {
  arrivalTime: number;
  origin: PositionInterface;
}

export const useSyncIncomingOrderInfo = ({
  orderId,
  counterPartyOrderId,
}: {
  orderId: number;
  counterPartyOrderId: number;
}) => {
  const {
    setup: { components },
  } = useDojo();
  useMemo(() => {
    const fetchData = async () => {
      try {
        const { data } = await sdk.getIncomingOrderInfo({
          orderId: numberToHex(orderId),
          counterPartyOrderId: numberToHex(counterPartyOrderId),
        });
        data?.origin?.edges?.forEach((edge) => {
          edge?.node &&
            setComponentFromEntity(edge.node, "Position", components);
        });
        data?.resources?.edges?.forEach((edge) => {
          if (edge?.node) {
            setComponentFromEntity(edge.node, "Resource", components);
            setComponentFromEntity(edge.node, "FungibleEntities", components);
            setComponentFromEntity(edge.node, "ArrivalTime", components);
          }
        });
      } catch (error) {}
    };
    fetchData();
  }, [orderId]);
};

export interface RealmInterface {
  realmId: number;
  cities: number;
  rivers: number;
  wonder: number;
  harbors: number;
  regions: number;
  resource_types_count: number;
  resource_types_packed: number;
  order: number;
  position: PositionInterface;
  owner: number;
}

export const useSyncRealm = ({ entityId }: { entityId: number }) => {
  const {
    setup: { components },
  } = useDojo();

  useMemo(() => {
    const fetchData = async () => {
      try {
        const { data } = await sdk.getRealm({
          realmEntityId: numberToHex(entityId),
        });
        data?.entities?.edges?.forEach((edge) => {
          if (edge?.node) {
            setComponentFromEntity(edge.node, "Realm", components);
            setComponentFromEntity(edge.node, "Position", components);
            setComponentFromEntity(edge.node, "Owner", components);
          }
        });
      } catch (error) {}
    };
    fetchData();
  }, [entityId]);
};

export const useSyncRealms = () => {
  const {
    setup: { components },
  } = useDojo();

  useMemo(() => {
    const fetchData = async () => {
      try {
        const { data } = await sdk.getRealms();
        data?.realmComponents?.edges?.forEach((edge) => {
          if (edge?.node?.entity) {
            setComponentFromEntity(edge.node.entity, "Realm", components);
            setComponentFromEntity(edge.node.entity, "Position", components);
            setComponentFromEntity(edge.node.entity, "Owner", components);
          }
        });
      } catch (error) {}
    };
    fetchData();
  }, []);
};

export interface CounterPartyOrderIdInterface {
  counterpartyOrderId: number;
}

export const useGetCounterPartyOrderId = (
  orderId: number,
): {
  counterPartyOrderId: number;
  status: FetchStatus;
  error: unknown;
} => {
  const [counterPartyOrderId, setCounterPartyOrderId] = useState<number>(0);
  const [status, setStatus] = useState<FetchStatus>(FetchStatus.Idle);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const fetchData = async () => {
      setStatus(FetchStatus.Loading);
      try {
        const { data } = await sdk.getCounterpartyOrderId({
          orderId: numberToHex(orderId),
        });

        const makerTradeComponets = data?.makerTradeComponents;
        const takerTradeComponents = data?.takerTradeComponents;

        if (
          makerTradeComponets?.edges &&
          makerTradeComponets.edges.length > 0
        ) {
          let trade: any = makerTradeComponets.edges.find(
            (edge) => edge?.node?.__typename === "Trade",
          );
          // let trade = node?.trade as Trade;
          setCounterPartyOrderId(parseInt(trade?.node?.taker_order_id));
        } else if (
          takerTradeComponents?.edges &&
          takerTradeComponents.edges.length > 0
        ) {
          let trade: any = takerTradeComponents.edges.find(
            (edge) => edge?.node?.__typename === "Trade",
          );
          setCounterPartyOrderId(parseInt(trade?.node.maker_order_id));
        }
        setStatus(FetchStatus.Success);
      } catch (error) {
        setError(error);
        setStatus(FetchStatus.Error);
      }
    };
    fetchData();
  }, [orderId]);

  return {
    counterPartyOrderId,
    status,
    error,
  };
};

export interface CaravanInterface {
  caravanId: number;
  orderId: number;
  blocked: boolean;
  arrivalTime: number;
  capacity: number;
}

export interface ResourceInterface {
  resourceId: number;
  amount: number;
}

export interface CaravanInfoInterface {
  arrivalTime: number | undefined;
  blocked: boolean;
  capacity: number;
  destination: PositionInterface | undefined;
}

export const useSyncCaravanInfo = (
  caravanId: number,
  orderId: number,
  counterpartyOrderId: number,
) => {
  const {
    setup: { components },
  } = useDojo();
  useMemo(() => {
    const fetchData = async () => {
      try {
        const { data } = await sdk.getCaravanInfo({
          caravanId: numberToHex(caravanId),
          counterpartyOrderId: numberToHex(counterpartyOrderId),
          orderId: numberToHex(orderId),
        });
        data?.caravan?.edges?.forEach((edge) => {
          if (edge?.node) {
            setComponentFromEntity(edge.node, "ArrivalTime", components);
            setComponentFromEntity(edge.node, "Movable", components);
            setComponentFromEntity(edge.node, "Capacity", components);
          }
        });
        data?.destination?.edges?.forEach((edge) => {
          edge?.node &&
            setComponentFromEntity(edge.node, "Position", components);
        });
        data?.resourcesGet?.edges?.forEach((edge) => {
          edge?.node &&
            setComponentFromEntity(edge.node, "OrderResource", components);
          edge?.node &&
            setComponentFromEntity(edge.node, "FungibleEntities", components);
        });
        data?.resourcesGive?.edges?.forEach((edge) => {
          edge?.node &&
            setComponentFromEntity(edge.node, "OrderResource", components);
          edge?.node &&
            setComponentFromEntity(edge.node, "FungibleEntities", components);
        });
      } catch (error) {}
    };
    fetchData();
  }, [counterpartyOrderId]);
};

export interface PositionInterface {
  x: number;
  y: number;
}

export const useSyncRealmCaravans = (x: number, y: number) => {
  const {
    setup: { components },
  } = useDojo();
  useMemo(() => {
    async function fetchData() {
      try {
        const { data } = await sdk.getRealmsCaravans({ x: x, y: y });
        data?.positionComponents?.edges?.forEach((edge) => {
          if (edge?.node?.entity) {
            let {
              node: { entity },
            } = edge;
            setComponentFromEntity(entity, "OrderId", components);
            setComponentFromEntity(entity, "Movable", components);
            setComponentFromEntity(entity, "ArrivalTime", components);
            setComponentFromEntity(entity, "Capacity", components);
            setComponentFromEntity(entity, "Position", components);
            setComponentFromEntity(entity, "CaravanMembers", components);
          }
        });
      } catch (error) {}
    }
    fetchData();
  }, [x, y]);
};

export interface MarketInterface {
  tradeId: number;
  makerId: number;
  makerOrderId: number;
  takerOrderId: number;
  expiresAt: number;
}

// TODO: add filter on trade status is open
export const useSyncMarket = ({ realmId }: { realmId: number }) => {
  const {
    setup: { components },
  } = useDojo();
  useMemo(() => {
    async function fetchData() {
      try {
        const { data } = await sdk.getMarket();
        data?.tradeComponents?.edges?.forEach((edge) => {
          if (edge?.node?.entity) {
            let {
              node: { entity },
            } = edge;
            setComponentFromEntity(entity, "Trade", components);
            setComponentFromEntity(entity, "Status", components);
          }
        });
      } catch (error) {}
    }
    fetchData();
  }, [realmId]);
};

export interface MyOfferInterface {
  tradeId: string;
  makerOrderId: string;
  takerOrderId: string;
  expiresAt: number;
  status: string;
}

export const useSyncMyOffers = ({ realmId }: { realmId: number }) => {
  const {
    setup: { components },
  } = useDojo();

  useMemo(() => {
    async function fetchData() {
      try {
        const { data } = await sdk.getMyOffers({
          makerId: numberToHex(realmId),
        });
        data.tradeComponents?.edges?.forEach((edge) => {
          if (edge?.node?.entity) {
            let {
              node: { entity },
            } = edge;
            setComponentFromEntity(entity, "Trade", components);
            setComponentFromEntity(entity, "Status", components);
          }
        });
      } catch (error) {}
    }
    fetchData();
  }, [realmId]);
};

export const useSyncTradeResources = ({
  makerOrderId,
  takerOrderId,
}: {
  makerOrderId: string;
  takerOrderId: string;
}) => {
  const {
    setup: { components },
  } = useDojo();

  useMemo(() => {
    const fetchData = async () => {
      try {
        const { data } = await sdk.getTradeResources({
          makerOrderId,
          takerOrderId,
        });
        data.resourcesGet?.edges?.map((edge) => {
          edge?.node &&
            setComponentFromEntity(edge.node, "FungibleEntities", components);
          edge?.node &&
            setComponentFromEntity(edge.node, "OrderResource", components);
        });
        data.resourcesGive?.edges?.map((edge) => {
          edge?.node &&
            setComponentFromEntity(edge.node, "FungibleEntities", components);
          edge?.node &&
            setComponentFromEntity(edge.node, "OrderResource", components);
        });
      } catch (error) {}
    };
    fetchData();
  }, [makerOrderId, takerOrderId]);
};

export const getLatestRealmId = async (): Promise<number> => {
  const { data } = await fetchRealmIds();

  let highestRealmId: number | undefined;
  data?.realmComponents?.edges?.forEach((edge) => {
    const realmId = parseInt(edge?.node?.realm_id);
    if (highestRealmId === undefined || realmId > highestRealmId) {
      highestRealmId = realmId;
    }
  });
  return highestRealmId ? highestRealmId : 0;
};

async function fetchRealmIds(): Promise<{
  data: GetRealmIdsQuery | null;
  status: FetchStatus;
  error: unknown;
}> {
  try {
    const { data } = await sdk.getRealmIds();
    return { data, status: FetchStatus.Success, error: null };
  } catch (error) {
    return { data: null, status: FetchStatus.Error, error };
  }
}
