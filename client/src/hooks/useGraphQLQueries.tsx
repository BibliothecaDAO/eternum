import { useEffect, useRef, useState } from 'react';
import { GraphQLClient } from 'graphql-request';
import { GetCaravansQuery, GetMyOffersQuery, GetOrdersQuery, GetRealmsQuery, GetTradesQuery, Resource, Status, Trade, getSdk } from '../generated/graphql';
import { useDojo } from '../DojoContext';
import { getComponentValue } from '@latticexyz/recs';
import { Utils } from '@dojoengine/core';

export enum FetchStatus {
  Idle = 'idle',
  Loading = 'loading',
  Success = 'success',
  Error = 'error',
}

const client = new GraphQLClient('http://localhost:8080/');
const sdk = getSdk(client);

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
}): {market: MarketInterface[] | undefined, status: FetchStatus, error: unknown} => {
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
          const market = tradeComponents.map((item) => {
            let trade = item?.entity?.components?.find((component) => {
              return component?.__typename === "Trade"
            }) as Trade;
            let status = item?.entity?.components?.find((component) => {
              return component?.__typename === "Status"
            }
            ) as Status;

            if (status.value === "0x0" && trade.maker_id !== `0x${realmId.toString(16)}`) {
              return {tradeId: trade.trade_id, makerOrderId: trade.maker_order_id, takerOrderId: trade.taker_order_id}
            } else {
              return undefined;
            }
          }).filter(Boolean) as MarketInterface[];
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
}): {myOffers: MyOfferInterface[] | undefined, status: FetchStatus, error: unknown} => {
  const [myOffers, setMyOffers] = useState<MyOfferInterface[] | undefined>();
  const [status, setStatus] = useState<FetchStatus>(FetchStatus.Idle);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    async function fetchData() {
      setStatus(FetchStatus.Loading);
      try {
        const { data } = await sdk.getMyOffers({makerId: `0x${realmId.toString(16)}`});
        const tradeComponents = data?.tradeComponents;
        if (tradeComponents) {
          const myOffers = tradeComponents.map((item) => {
            return { tradeId: item?.trade_id, makerOrderId: item?.maker_order_id, takerOrderId: item?.taker_order_id };
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

export const useGetTradeStatus = ({tradeId}: {tradeId: string}): {tradeStatus: number | undefined, status: FetchStatus, error: unknown} => {
  const [tradeStatus, setTradeStatus] = useState<number | undefined>();
  const [status, setStatus] = useState<FetchStatus>(FetchStatus.Idle);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    async function fetchData() {
      setStatus(FetchStatus.Loading);
      try {
        const { data } = await sdk.getTradeStatus({tradeId});
        const entities = data?.entities;
        if (entities && entities.length === 1) {
          entities[0]?.components?.forEach((component) => {
            if (component?.__typename === 'Status' && component.value) {
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
    error
  }

}

export interface TradeResources {
  resourcesGive: {resourceId: number, amount: number}[]
  resourcesGet: {resourceId: number, amount: number}[]
}

export const useGetTradeResources = ({makerOrderId, takerOrderId}: {makerOrderId: string, takerOrderId: string}): {tradeResources: TradeResources, status: FetchStatus, error: unknown} => {
  const [tradeResources, setTradeResources] = useState< TradeResources>({resourcesGive: [], resourcesGet: []});
  const [status, setStatus] = useState<FetchStatus>(FetchStatus.Idle);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const fetchData = async () => {
      setStatus(FetchStatus.Loading);
      try {
        const { data } = await sdk.getTradeResources({makerOrderId, takerOrderId});
        if (!data.resourcesGet || !data.resourcesGive) return undefined;
        const resourcesGetEntities = data.resourcesGet.filter((entity) =>
          entity?.components?.find(
          (component) => component?.__typename === "Resource",
          ),
        );
        let resourcesGet = resourcesGetEntities?.map((resourcesGetEntity) => {
          let resource = resourcesGetEntity?.components?.find((component) => {
          return component?.__typename === "Resource";
        }) as Resource 
        return {resourceId: parseInt(resource.resource_type), amount: parseInt(resource.balance)}
          }
        )
        const resourcesGiveEntities = data.resourcesGet.filter((entity) =>
        entity?.components?.find(
        (component) => component?.__typename === "Resource",
        ),
      );
      let resourcesGive = resourcesGiveEntities?.map((resourcesGiveEntity) => {
      let resource = resourcesGiveEntity?.components?.find((component) => {
                return component?.__typename === "Resource"
              }) as Resource 
          return {resourceId: parseInt(resource.resource_type), amount: parseInt(resource.balance)}
            }
      )
          setTradeResources({resourcesGet, resourcesGive});
          setStatus(FetchStatus.Success);
      } catch (error) {
        setError(error);
        setStatus(FetchStatus.Error);
      }
    }
    fetchData();
  }, []);

  return {
    tradeResources,
    status,
    error,
  }
}

export const getLatestRealmId = async (): Promise<number> => {
  const {data: realmData} = await fetchRealmIds();
  const entities = realmData?.entities || [];
  let highestRealmId: number | undefined;

  entities.forEach((entity: any) => {
    const realmComponent = entity.components.find(
      (component: any) => component.__typename === 'Realm'
    );
    if (realmComponent) {
      const realmId = parseInt(realmComponent.realm_id, 16);
      if (highestRealmId === undefined || realmId > highestRealmId) {
        highestRealmId = realmId;
      }
    }
  });
  return highestRealmId? highestRealmId: 0;
}

async function fetchRealmIds(): Promise<{data: GetRealmsQuery | null, status: FetchStatus, error: unknown}> {
  try {
    const { data } = await sdk.getRealmIds();
    return {data, status: FetchStatus.Success, error: null}; 
  } catch (error) {
    return {data: null, status: FetchStatus.Error, error};
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

export function useGetTradeFromCaravanId(realmEntityId: number, caravanId: number) {
  const { components: { Trade, Caravan } } = useDojo()

  const [data, setData] = useState<number | null>(null);
  const [status, setStatus] = useState<FetchStatus>(FetchStatus.Idle);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    async function fetchData() {
      setStatus(FetchStatus.Loading);
      try {
        const {data: tradeData} = await sdk.getTrades();
        let tradeIds: number[] = [];
        if (tradeData) {
          tradeData.entities?.forEach((entity) => {
                if (entity) {
                  tradeIds.push(parseInt(entity.keys))
                }
            })
        }
        let mostRecentTradeId: number| null = null;
        const sortedTradeIds = tradeIds.sort((a, b) => b - a);
        for (const tradeId of sortedTradeIds) {
          let trade = getComponentValue(Trade, Utils.getEntityIdFromKeys([BigInt(tradeId)]));
          let makerCaravan = getComponentValue(Caravan, Utils.getEntityIdFromKeys([BigInt(trade?.maker_order_id || 0), BigInt(realmEntityId)]));
          let takerCaravan = getComponentValue(Caravan, Utils.getEntityIdFromKeys([BigInt(trade?.taker_order_id || 0), BigInt(realmEntityId)]));
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