import { useEffect, useRef, useState } from 'react';
import { GraphQLClient } from 'graphql-request';
import { GetCaravansQuery, GetOrdersQuery, GetRealmIdsQuery, GetTradesQuery, getSdk } from '../generated/graphql';
import { useDojo } from '../DojoContext';
import { getComponentValue } from '@latticexyz/recs';
import { Utils } from '@dojoengine/core';

export enum FetchStatus {
  Idle = 'idle',
  Loading = 'loading',
  Success = 'success',
  Error = 'error',
}

export const getLatestRealmId = async (): Promise<number> => {
  const { data: realmData } = await fetchRealmIds();
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
  return highestRealmId ? highestRealmId : 0;
}

async function fetchRealmIds(): Promise<{ data: GetRealmIdsQuery | null, status: FetchStatus, error: unknown }> {
  try {
    const client = new GraphQLClient('http://localhost:8080/');
    const sdk = getSdk(client);
    const { data } = await sdk.getRealmIds();
    return { data, status: FetchStatus.Success, error: null };
  } catch (error) {
    return { data: null, status: FetchStatus.Error, error };
  }
}

export function useGetRealmsIds() {
  const [data, setData] = useState<GetRealmIdsQuery | null>(null);
  const [status, setStatus] = useState<FetchStatus>(FetchStatus.Idle);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    async function fetchData() {
      setStatus(FetchStatus.Loading);
      try {
        const client = new GraphQLClient('http://localhost:8080/');
        const sdk = getSdk(client);
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
        const client = new GraphQLClient('http://localhost:8080/');
        const sdk = getSdk(client);
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
        const client = new GraphQLClient('http://localhost:8080/');
        const sdk = getSdk(client);
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
        const client = new GraphQLClient('http://localhost:8080/');
        const sdk = getSdk(client);
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
        const client = new GraphQLClient('http://localhost:8080/');
        const sdk = getSdk(client);
        const { data: tradeData } = await sdk.getTrades();
        let tradeIds: number[] = [];
        if (tradeData) {
          tradeData.entities?.forEach((entity) => {
            if (entity) {
              tradeIds.push(parseInt(entity.keys))
            }
          })
        }
        let mostRecentTradeId: number | null = null;
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