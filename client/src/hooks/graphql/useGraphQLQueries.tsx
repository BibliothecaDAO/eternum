import { useEffect, useMemo, useState } from "react";
import { GraphQLClient } from "graphql-request";
import {
  ArrivalTime,
  GetRealmIdsQuery,
  Labor,
  Owner,
  Position,
  Realm,
  Resource,
  Trade,
  getSdk,
} from "../../generated/graphql";
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

// TODO: change that to sync
export const useGetRealmLabor = (
  realmEntityId: number,
): {
  realmLabor: RealmLaborInterface;
  status: FetchStatus;
  error: unknown;
} => {
  const [realmLabor, setRealmLabor] = useState<RealmLaborInterface>({});
  const [status, setStatus] = useState<FetchStatus>(FetchStatus.Idle);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const fetchData = async () => {
      setStatus(FetchStatus.Loading);
      try {
        const { data } = await sdk.getRealmLabor({
          realmEntityId: numberToHex(realmEntityId),
        });
        const resourceLaborEntities = data?.entities;
        if (resourceLaborEntities) {
          let realmLabor: { [resourceId: number]: LaborInterface } = {};
          resourceLaborEntities.forEach((entity) => {
            let labor = entity?.components?.find((component) => {
              return component?.__typename === "Labor";
            }) as Labor;
            let keys = entity?.keys;
            if (keys) {
              let resourceId = keys.split(",")[1];
              realmLabor[parseInt(resourceId)] = {
                balance: labor.balance,
                lastHarvest: labor.last_harvest,
                multiplier: labor.multiplier,
              };
            }
          });
          setRealmLabor(realmLabor);
          setStatus(FetchStatus.Success);
        }
      } catch (error) {
        setError(error);
        setStatus(FetchStatus.Error);
      }
    };
    fetchData();
    const intervalId = setInterval(fetchData, 5000); // Fetch every 5 seconds

    return () => {
      clearInterval(intervalId); // Clear interval on component unmount
    };
  }, [realmEntityId]);

  return {
    realmLabor,
    status,
    error,
  };
};

export interface RealmResourcesInterface {
  [resourceId: number]: ResourceInterface;
}

// TODO: change that to sync
export const useGetRealmResources = (
  realmEntityId: number,
): {
  realmResources: RealmResourcesInterface;
  status: FetchStatus;
  error: unknown;
} => {
  const [realmResources, setRealmResources] = useState<RealmResourcesInterface>(
    {},
  );
  const [status, setStatus] = useState<FetchStatus>(FetchStatus.Idle);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const fetchData = async () => {
      setStatus(FetchStatus.Loading);
      try {
        const { data } = await sdk.getRealmResources({
          realmEntityId: `0x${realmEntityId.toString(16)}`,
        });
        const resourceEntities = data?.entities;
        if (resourceEntities) {
          let realmResources: { [resourceId: number]: ResourceInterface } = {};
          resourceEntities.map((entity) => {
            let resource = entity?.components?.find((component) => {
              return component?.__typename === "Resource";
            }) as Resource;
            let keys = entity?.keys;
            if (keys) {
              let resourceId = keys.split(",")[1];
              realmResources[parseInt(resourceId)] = {
                resourceId: parseInt(resourceId),
                amount: parseInt(resource.balance),
              };
            }
          });
          setRealmResources(realmResources);
          setStatus(FetchStatus.Success);
        }
      } catch (error) {
        setError(error);
        setStatus(FetchStatus.Error);
      }
    };
    fetchData();
    const intervalId = setInterval(fetchData, 5000); // Fetch every 5 seconds

    return () => {
      clearInterval(intervalId); // Clear interval on component unmount
    };
  }, [realmEntityId]);

  return {
    realmResources,
    status,
    error,
  };
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
  const { components } = useDojo();
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await sdk.getIncomingOrders({
          realmEntityId: numberToHex(realmEntityId),
        });
        data?.makerTradeComponents?.forEach((component) => {
          if (component?.entity) {
            let { entity } = component;
            setComponentFromEntity(entity, "Trade", components);
          }
        });
        data?.takerTradeComponents?.forEach((component) => {
          if (component?.entity) {
            let { entity } = component;
            setComponentFromEntity(entity, "Trade", components);
          }
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
  const { components } = useDojo();
  useMemo(() => {
    const fetchData = async () => {
      try {
        const { data } = await sdk.getIncomingOrderInfo({
          orderId: numberToHex(orderId),
          counterPartyOrderId: numberToHex(counterPartyOrderId),
        });
        data?.origin?.forEach((entity) => {
          setComponentFromEntity(entity, "Position", components);
        });
        data?.arrivalTime?.forEach((entity) => {
          setComponentFromEntity(entity, "ArrivalTime", components);
        });
        data?.resources?.forEach((entity) => {
          setComponentFromEntity(entity, "Resource", components);
          setComponentFromEntity(entity, "FungibleEntities", components);
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
  owner: string;
}

// TODO: change that to sync
export const useGetRealm = ({
  entityId,
}: {
  entityId: number;
}): {
  realm: RealmInterface | undefined;
  status: FetchStatus;
  error: unknown;
} => {
  const [realm, setRealm] = useState<RealmInterface | undefined>();
  const [status, setStatus] = useState<FetchStatus>(FetchStatus.Idle);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const fetchData = async () => {
      setStatus(FetchStatus.Loading);
      try {
        const { data } = await sdk.getRealm({
          realmEntityId: `0x${entityId.toString(16)}`,
        });
        const entities = data?.entities;
        if (entities && entities.length === 1) {
          let realm = entities[0]?.components?.find(
            (component) => component?.__typename === "Realm",
          ) as Realm;
          let position = entities[0]?.components?.find(
            (component) => component?.__typename === "Position",
          ) as Position;
          let owner = entities[0]?.components?.find(
            (component) => component?.__typename === "Owner",
          ) as Owner;

          setRealm({
            realmId: realm.realm_id,
            cities: realm.cities,
            rivers: realm.rivers,
            wonder: realm.wonder,
            harbors: realm.harbors,
            regions: realm.regions,
            resource_types_count: realm.resource_types_count,
            resource_types_packed: realm.resource_types_packed,
            order: realm.order,
            position: { x: position.x, y: position.y },
            owner: owner.address,
          });
        }
      } catch (error) {
        setError(error);
        setStatus(FetchStatus.Error);
      }
    };
    fetchData();
  }, [entityId]);

  return {
    realm,
    status,
    error,
  };
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

        if (makerTradeComponets && makerTradeComponets.length > 0) {
          let trade = makerTradeComponets.find(
            (component) => component?.__typename === "Trade",
          ) as Trade;
          setCounterPartyOrderId(parseInt(trade.taker_order_id));
        } else if (takerTradeComponents && takerTradeComponents.length > 0) {
          let trade = takerTradeComponents.find(
            (component) => component?.__typename === "Trade",
          ) as Trade;
          setCounterPartyOrderId(parseInt(trade.maker_order_id));
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
  const { components } = useDojo();
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await sdk.getCaravanInfo({
          caravanId: numberToHex(caravanId),
          counterpartyOrderId: numberToHex(counterpartyOrderId),
          orderId: numberToHex(orderId),
        });

        data?.destination?.forEach((entity) => {
          setComponentFromEntity(entity, "Position", components);
        });
        data?.resourcesGet?.map((entity) => {
          setComponentFromEntity(entity, "Resource", components);
        });
        data?.resourcesGive?.map((entity) => {
          setComponentFromEntity(entity, "Resource", components);
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
  const { components } = useDojo();
  useEffect(() => {
    async function fetchData() {
      try {
        const { data } = await sdk.getRealmsCaravans({ x: x, y: y });
        data?.positionComponents?.forEach((component) => {
          if (component?.entity) {
            let { entity } = component;
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
  const { components } = useDojo();
  useMemo(() => {
    async function fetchData() {
      try {
        const { data } = await sdk.getMarket();
        data?.tradeComponents?.map((component) => {
          if (component?.entity) {
            let { entity } = component;
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
  const { components } = useDojo();

  useMemo(() => {
    async function fetchData() {
      try {
        const { data } = await sdk.getMyOffers({
          makerId: numberToHex(realmId),
        });
        data.tradeComponents?.map((component) => {
          if (component?.entity) {
            let { entity } = component;
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
  const { components } = useDojo();

  useMemo(() => {
    const fetchData = async () => {
      try {
        const { data } = await sdk.getTradeResources({
          makerOrderId,
          takerOrderId,
        });
        data.makerFungibleEntities?.map((entity) => {
          setComponentFromEntity(entity, "FungibleEntities", components);
        });
        data.takerFungibleEntities?.map((entity) => {
          setComponentFromEntity(entity, "FungibleEntities", components);
        });
        data.resourcesGet?.map((entity) => {
          setComponentFromEntity(entity, "Resource", components);
        });
        data.resourcesGive?.map((entity) => {
          setComponentFromEntity(entity, "Resource", components);
        });
      } catch (error) {}
    };
    fetchData();
  }, [makerOrderId, takerOrderId]);
};

export const getLatestRealmId = async (): Promise<number> => {
  const { data: realmData } = await fetchRealmIds();
  const entities = realmData?.entities || [];
  let highestRealmId: number | undefined;

  entities.forEach((entity: any) => {
    const realmComponent = entity.components.find(
      (component: any) => component.__typename === "Realm",
    );
    if (realmComponent) {
      const realmId = parseInt(realmComponent.realm_id, 16);
      if (highestRealmId === undefined || realmId > highestRealmId) {
        highestRealmId = realmId;
      }
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
