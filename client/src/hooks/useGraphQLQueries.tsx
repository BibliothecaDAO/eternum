import { useEffect, useState } from 'react';
import { GraphQLClient } from 'graphql-request';
import { GetCaravansQuery, GetTradesQuery, getSdk } from '../generated/graphql';

export enum FetchStatus {
  Idle = 'idle',
  Loading = 'loading',
  Success = 'success',
  Error = 'error',
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
    fetchData();
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