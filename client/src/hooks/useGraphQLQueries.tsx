import { useEffect, useRef, useState } from "react";
import { GraphQLClient } from "graphql-request";
import {
  ArrivalTime,
  Capacity,
  Caravan,
  GetCaravansQuery,
  GetMyOffersQuery,
  GetOrdersQuery,
  GetRealmsQuery,
  GetTradesQuery,
  Movable,
  OrderId,
  Owner,
  Position,
  Realm,
  Resource,
  Status,
  Trade,
  getSdk,
} from "../generated/graphql";
import { useDojo } from "../DojoContext";
import { getComponentValue } from "@latticexyz/recs";
import { Utils } from "@dojoengine/core";

export enum FetchStatus {
  Idle = "idle",
  Loading = "loading",
  Success = "success",
  Error = "error",
}

const client = new GraphQLClient("http://localhost:8080/");
const sdk = getSdk(client);

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
  counterPartyOrderId: number | undefined;
  status: FetchStatus;
  error: unknown;
} => {
  const [counterPartyOrderId, setCounterPartyOrderId] = useState<
    number | undefined
  >();
  const [status, setStatus] = useState<FetchStatus>(FetchStatus.Idle);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const fetchData = async () => {
      setStatus(FetchStatus.Loading);
      try {
        const { data } = await sdk.getCounterpartyOrderId({
          orderId: orderId,
        });
        const makerTradeComponets = data?.makerTradeComponents;
        const takerTradeComponents = data?.takerTradeComponents;

        if (makerTradeComponets) {
          let trade = makerTradeComponets.find(
            (component) => component?.__typename === "Trade",
          ) as Trade;
          setCounterPartyOrderId(trade.taker_order_id);
        } else if (takerTradeComponents) {
          let trade = takerTradeComponents.find(
            (component) => component?.__typename === "Trade",
          ) as Trade;
          setCounterPartyOrderId(trade.maker_order_id);
        }
        setStatus(FetchStatus.Success);
      } catch (error) {
        setError(error);
        setStatus(FetchStatus.Error);
      }
    };
    fetchData();
  }, []);

  return {
    counterPartyOrderId,
    status,
    error,
  };
};

export interface CaravanInterface {
  caravanId: string;
  orderId: string;
}

export interface ResourceInterface {
  resourceId: number;
  amount: number;
}

export interface CaravanInfoInterface {
  arrivalTime: number;
  blocked: boolean;
  capacity: number;
  destination: PositionInterface;
  resourcesGive: ResourceInterface[];
  resourcesGet: ResourceInterface[];
}

export const useGetCaravanInfo = (
  caravanId: number,
  orderId: number,
  counterpartyOrderId: number,
): {
  caravanInfo: CaravanInfoInterface | undefined;
  status: FetchStatus;
  error: unknown;
} => {
  const [caravanInfo, setCaravanInfo] = useState<
    CaravanInfoInterface | undefined
  >();
  const [status, setStatus] = useState<FetchStatus>(FetchStatus.Idle);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const fetchData = async () => {
      setStatus(FetchStatus.Loading);
      try {
        console.log({ counterpartyOrderId });
        const { data } = await sdk.getCaravanInfo({
          caravanId: `0x${caravanId.toString(16)}`,
          counterpartyOrderId: `0x${counterpartyOrderId.toString(16)}`,
          orderId: `0x${orderId.toString(16)}`,
        });
        console.log({ data });
        const caravanEntities = data?.caravan;
        const destinationEntities = data?.destination;
        if (
          caravanEntities &&
          caravanEntities.length === 1 &&
          destinationEntities &&
          destinationEntities.length === 1
        ) {
          let movable = caravanEntities[0]?.components?.find(
            (component) => component?.__typename === "Movable",
          ) as Movable;
          let capacity = caravanEntities[0]?.components?.find(
            (component) => component?.__typename === "Capacity",
          ) as Capacity;
          let arrival = caravanEntities[0]?.components?.find(
            (component) => component?.__typename === "ArrivalTime",
          ) as ArrivalTime;
          let destination = destinationEntities[0]?.components?.find(
            (component) => component?.__typename === "Position",
          ) as Position;
          if (!data.resourcesGet || !data.resourcesGive) return undefined;
          const resourcesGetEntities = data.resourcesGet.filter((entity) =>
            entity?.components?.find(
              (component) => component?.__typename === "Resource",
            ),
          );
          let resourcesGet = resourcesGetEntities?.map((resourcesGetEntity) => {
            let resource = resourcesGetEntity?.components?.find((component) => {
              return component?.__typename === "Resource";
            }) as Resource;
            return {
              resourceId: parseInt(resource.resource_type),
              amount: parseInt(resource.balance),
            };
          });
          const resourcesGiveEntities = data.resourcesGet.filter((entity) =>
            entity?.components?.find(
              (component) => component?.__typename === "Resource",
            ),
          );
          let resourcesGive = resourcesGiveEntities?.map(
            (resourcesGiveEntity) => {
              let resource = resourcesGiveEntity?.components?.find(
                (component) => {
                  return component?.__typename === "Resource";
                },
              ) as Resource;
              return {
                resourceId: parseInt(resource.resource_type),
                amount: parseInt(resource.balance),
              };
            },
          );
          setCaravanInfo({
            arrivalTime: arrival.arrives_at,
            blocked: movable.blocked,
            capacity: parseInt(capacity.weight_gram),
            destination,
            resourcesGive,
            resourcesGet,
          });
        }
      } catch (error) {
        console.log(error);
        setError(error);
        setStatus(FetchStatus.Error);
      }
    };
    fetchData();
  }, [counterpartyOrderId]);

  return {
    caravanInfo,
    status,
    error,
  };
};

export interface PositionInterface {
  x: number;
  y: number;
}

export const useGetRealmCaravans = (
  x: number,
  y: number,
): {
  caravans: CaravanInterface[] | undefined;
  status: FetchStatus;
  error: unknown;
} => {
  const [caravans, setCaravans] = useState<CaravanInterface[] | undefined>();
  const [status, setStatus] = useState<FetchStatus>(FetchStatus.Idle);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    async function fetchData() {
      setStatus(FetchStatus.Loading);
      try {
        const { data } = await sdk.getRealmsCaravans({ x: x, y: y });
        const positionEntities = data?.positionComponents;
        if (positionEntities) {
          const caravans = positionEntities
            .filter((entity) =>
              entity?.entity?.components?.find(
                (component) => component?.__typename === "CaravanMembers",
              ),
            )
            .map((item) => {
              let orderId = item?.entity?.components?.find((component) => {
                return component?.__typename === "OrderId";
              }) as OrderId;
              let keys = item?.entity?.keys;
              let caravanId = keys ? keys.split(",")[0] : "";
              return { caravanId, orderId: orderId.id };
            });
          setCaravans(caravans);
          setStatus(FetchStatus.Success);
        }
      } catch (error) {
        setError(error);
        setStatus(FetchStatus.Error);
      }
    }
    fetchData();

    const intervalId = setInterval(fetchData, 5000); // Fetch every 5 seconds

    return () => {
      clearInterval(intervalId); // Clear interval on component unmount
    };
  }, [x, y]);

  return {
    caravans,
    status,
    error,
  };
};

export interface MarketInterface {
  tradeId: string;
  makerOrderId: string;
  takerOrderId: string;
}

// TODO: add filter on trade status is open
export const useGetMarket = ({
  realmId,
}: {
  realmId: number;
}): {
  market: MarketInterface[] | undefined;
  status: FetchStatus;
  error: unknown;
} => {
  const [market, setMarket] = useState<MarketInterface[] | undefined>();
  const [status, setStatus] = useState<FetchStatus>(FetchStatus.Idle);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    async function fetchData() {
      setStatus(FetchStatus.Loading);
      try {
        const { data } = await sdk.getMarket();
        const tradeComponents = data?.tradeComponents;
        if (tradeComponents) {
          const market = tradeComponents
            .map((item) => {
              let trade = item?.entity?.components?.find((component) => {
                return component?.__typename === "Trade";
              }) as Trade;
              let status = item?.entity?.components?.find((component) => {
                return component?.__typename === "Status";
              }) as Status;

              if (
                status.value === "0x0" &&
                trade.maker_id !== `0x${realmId.toString(16)}`
              ) {
                return {
                  tradeId: trade.trade_id,
                  makerOrderId: trade.maker_order_id,
                  takerOrderId: trade.taker_order_id,
                };
              } else {
                return undefined;
              }
            })
            .filter(Boolean) as MarketInterface[];
          setMarket(market);
          setStatus(FetchStatus.Success);
        }
      } catch (error) {
        setError(error);
        setStatus(FetchStatus.Error);
      }
    }
    fetchData();

    const intervalId = setInterval(fetchData, 5000); // Fetch every 5 seconds

    return () => {
      clearInterval(intervalId); // Clear interval on component unmount
    };
  }, [realmId]);

  return {
    market,
    status,
    error,
  };
};

export interface MyOfferInterface {
  tradeId: string;
  makerOrderId: string;
  takerOrderId: string;
}

// TODO: add filter on trade status is open
export const useGetMyOffers = ({
  realmId,
}: {
  realmId: number;
}): {
  myOffers: MyOfferInterface[] | undefined;
  status: FetchStatus;
  error: unknown;
} => {
  const [myOffers, setMyOffers] = useState<MyOfferInterface[] | undefined>();
  const [status, setStatus] = useState<FetchStatus>(FetchStatus.Idle);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    async function fetchData() {
      setStatus(FetchStatus.Loading);
      try {
        const { data } = await sdk.getMyOffers({
          makerId: `0x${realmId.toString(16)}`,
        });
        const tradeComponents = data?.tradeComponents;
        if (tradeComponents) {
          const myOffers = tradeComponents.map((item) => {
            return {
              tradeId: item?.trade_id,
              makerOrderId: item?.maker_order_id,
              takerOrderId: item?.taker_order_id,
            };
          });
          setMyOffers(myOffers);
          setStatus(FetchStatus.Success);
        }
      } catch (error) {
        setError(error);
        setStatus(FetchStatus.Error);
      }
    }
    fetchData();

    const intervalId = setInterval(fetchData, 5000); // Fetch every 5 seconds

    return () => {
      clearInterval(intervalId); // Clear interval on component unmount
    };
  }, [realmId]);

  return {
    myOffers,
    status,
    error,
  };
};

export const useGetTradeStatus = ({
  tradeId,
}: {
  tradeId: string;
}): {
  tradeStatus: number | undefined;
  status: FetchStatus;
  error: unknown;
} => {
  const [tradeStatus, setTradeStatus] = useState<number | undefined>();
  const [status, setStatus] = useState<FetchStatus>(FetchStatus.Idle);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    async function fetchData() {
      setStatus(FetchStatus.Loading);
      try {
        const { data } = await sdk.getTradeStatus({ tradeId });
        const entities = data?.entities;
        if (entities && entities.length === 1) {
          entities[0]?.components?.forEach((component) => {
            if (component?.__typename === "Status" && component.value) {
              setTradeStatus(component.value);
            }
          });
        }
      } catch (error) {
        setError(error);
        setStatus(FetchStatus.Error);
      }
    }
    fetchData();
  }, []);

  return {
    tradeStatus,
    status,
    error,
  };
};

export interface TradeResources {
  resourcesGive: { resourceId: number; amount: number }[];
  resourcesGet: { resourceId: number; amount: number }[];
}

export const useGetTradeResources = ({
  makerOrderId,
  takerOrderId,
}: {
  makerOrderId: string;
  takerOrderId: string;
}): { tradeResources: TradeResources; status: FetchStatus; error: unknown } => {
  const [tradeResources, setTradeResources] = useState<TradeResources>({
    resourcesGive: [],
    resourcesGet: [],
  });
  const [status, setStatus] = useState<FetchStatus>(FetchStatus.Idle);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const fetchData = async () => {
      setStatus(FetchStatus.Loading);
      try {
        const { data } = await sdk.getTradeResources({
          makerOrderId,
          takerOrderId,
        });
        if (!data.resourcesGet || !data.resourcesGive) return undefined;
        const resourcesGetEntities = data.resourcesGet.filter((entity) =>
          entity?.components?.find(
            (component) => component?.__typename === "Resource",
          ),
        );
        let resourcesGet = resourcesGetEntities?.map((resourcesGetEntity) => {
          let resource = resourcesGetEntity?.components?.find((component) => {
            return component?.__typename === "Resource";
          }) as Resource;
          return {
            resourceId: parseInt(resource.resource_type),
            amount: parseInt(resource.balance),
          };
        });
        const resourcesGiveEntities = data.resourcesGet.filter((entity) =>
          entity?.components?.find(
            (component) => component?.__typename === "Resource",
          ),
        );
        let resourcesGive = resourcesGiveEntities?.map(
          (resourcesGiveEntity) => {
            let resource = resourcesGiveEntity?.components?.find(
              (component) => {
                return component?.__typename === "Resource";
              },
            ) as Resource;
            return {
              resourceId: parseInt(resource.resource_type),
              amount: parseInt(resource.balance),
            };
          },
        );
        setTradeResources({ resourcesGet, resourcesGive });
        setStatus(FetchStatus.Success);
      } catch (error) {
        setError(error);
        setStatus(FetchStatus.Error);
      }
    };
    fetchData();
  }, []);

  return {
    tradeResources,
    status,
    error,
  };
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
  data: GetRealmsQuery | null;
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

export function useGetRealmsIds() {
  const [data, setData] = useState<GetRealmsQuery | null>(null);
  const [status, setStatus] = useState<FetchStatus>(FetchStatus.Idle);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    async function fetchData() {
      setStatus(FetchStatus.Loading);
      try {
        const { data } = await sdk.getRealmIds();
        setData(data);
        setStatus(FetchStatus.Success);
      } catch (error) {
        setError(error);
        setStatus(FetchStatus.Error);
      }
    }
    fetchData();
  }, []);

  return {
    data,
    status,
    error,
  };
}

export function useGetTrades() {
  const [data, setData] = useState<GetTradesQuery | null>(null);
  const [status, setStatus] = useState<FetchStatus>(FetchStatus.Idle);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    async function fetchData() {
      setStatus(FetchStatus.Loading);
      try {
        const { data } = await sdk.getTrades();
        setData(data);
        setStatus(FetchStatus.Success);
      } catch (error) {
        setError(error);
        setStatus(FetchStatus.Error);
      }
    }
    fetchData(); // Initial fetch

    const intervalId = setInterval(fetchData, 5000); // Fetch every 5 seconds

    return () => {
      clearInterval(intervalId); // Clear interval on component unmount
    };
  }, []);

  // TODO: add polling

  return {
    data,
    status,
    error,
  };
}

export function useGetCaravans() {
  const [data, setData] = useState<GetCaravansQuery | null>(null);
  const [status, setStatus] = useState<FetchStatus>(FetchStatus.Idle);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    async function fetchData() {
      setStatus(FetchStatus.Loading);
      try {
        // TODO: getCaravans and order ids
        const { data } = await sdk.getCaravans();
        setData(data);
        setStatus(FetchStatus.Success);
      } catch (error) {
        setError(error);
        setStatus(FetchStatus.Error);
      }
    }
    fetchData();
  }, []);

  // TODO: add polling

  return {
    data,
    status,
    error,
  };
}

export function useGetOrders() {
  const [data, setData] = useState<GetOrdersQuery | null>(null);
  const [status, setStatus] = useState<FetchStatus>(FetchStatus.Idle);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    async function fetchData() {
      setStatus(FetchStatus.Loading);
      try {
        const { data } = await sdk.getOrders();
        setData(data);
        setStatus(FetchStatus.Success);
      } catch (error) {
        setError(error);
        setStatus(FetchStatus.Error);
      }
    }
    fetchData();
  }, []);

  // TODO: add polling

  return {
    data,
    status,
    error,
  };
}

export function useGetTradeFromCaravanId(
  realmEntityId: number,
  caravanId: number,
) {
  const {
    components: { Trade, Caravan },
  } = useDojo();

  const [data, setData] = useState<number | null>(null);
  const [status, setStatus] = useState<FetchStatus>(FetchStatus.Idle);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    async function fetchData() {
      setStatus(FetchStatus.Loading);
      try {
        const { data: tradeData } = await sdk.getTrades();
        let tradeIds: number[] = [];
        if (tradeData) {
          tradeData.entities?.forEach((entity) => {
            if (entity) {
              tradeIds.push(parseInt(entity.keys));
            }
          });
        }
        let mostRecentTradeId: number | null = null;
        const sortedTradeIds = tradeIds.sort((a, b) => b - a);
        for (const tradeId of sortedTradeIds) {
          let trade = getComponentValue(
            Trade,
            Utils.getEntityIdFromKeys([BigInt(tradeId)]),
          );
          let makerCaravan = getComponentValue(
            Caravan,
            Utils.getEntityIdFromKeys([
              BigInt(trade?.maker_order_id || 0),
              BigInt(realmEntityId),
            ]),
          );
          let takerCaravan = getComponentValue(
            Caravan,
            Utils.getEntityIdFromKeys([
              BigInt(trade?.taker_order_id || 0),
              BigInt(realmEntityId),
            ]),
          );
          if (makerCaravan?.caravan_id === caravanId) {
            mostRecentTradeId = tradeId;
          } else if (takerCaravan?.caravan_id === caravanId) {
            mostRecentTradeId = tradeId;
          }
        }
        setData(mostRecentTradeId);
        setStatus(FetchStatus.Success);
      } catch (error) {
        setError(error);
        setStatus(FetchStatus.Error);
      }
    }
    fetchData();
  }, []);

  // TODO: add polling

  return {
    data,
    status,
    error,
  };
}
