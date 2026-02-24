import {useMemo} from 'react';
import type {MarketPair} from '../types';

// TODO: Replace with real data from MarketManager + Torii SQL queries
const MOCK_MARKET_PAIRS: MarketPair[] = [
  {resourceId: 1, resourceName: 'Stone', lordsReserve: 50000, resourceReserve: 120000, price: 0.42, change24h: 2.3},
  {resourceId: 2, resourceName: 'Coal', lordsReserve: 35000, resourceReserve: 80000, price: 0.44, change24h: -1.1},
  {resourceId: 3, resourceName: 'Wood', lordsReserve: 45000, resourceReserve: 100000, price: 0.45, change24h: 0.8},
  {resourceId: 4, resourceName: 'Copper', lordsReserve: 28000, resourceReserve: 55000, price: 0.51, change24h: 5.2},
  {resourceId: 5, resourceName: 'Ironwood', lordsReserve: 22000, resourceReserve: 30000, price: 0.73, change24h: -2.4},
  {resourceId: 6, resourceName: 'Obsidian', lordsReserve: 18000, resourceReserve: 22000, price: 0.82, change24h: 3.6},
  {resourceId: 7, resourceName: 'Gold', lordsReserve: 40000, resourceReserve: 25000, price: 1.6, change24h: 1.2},
  {resourceId: 8, resourceName: 'Silver', lordsReserve: 32000, resourceReserve: 40000, price: 0.8, change24h: -0.5},
  {resourceId: 9, resourceName: 'Mithral', lordsReserve: 15000, resourceReserve: 8000, price: 1.88, change24h: 7.1},
  {resourceId: 10, resourceName: 'Alchemical Silver', lordsReserve: 12000, resourceReserve: 6000, price: 2.0, change24h: -3.2},
  {resourceId: 11, resourceName: 'Cold Iron', lordsReserve: 20000, resourceReserve: 18000, price: 1.11, change24h: 0.3},
  {resourceId: 12, resourceName: 'Deep Crystal', lordsReserve: 10000, resourceReserve: 4500, price: 2.22, change24h: 4.8},
];

export function useMarketPairs() {
  const pairs = useMemo(() => MOCK_MARKET_PAIRS, []);

  const sortedByPrice = useMemo(
    () => [...pairs].sort((a, b) => b.price - a.price),
    [pairs],
  );

  const sortedByChange = useMemo(
    () => [...pairs].sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h)),
    [pairs],
  );

  return {
    pairs,
    sortedByPrice,
    sortedByChange,
    isLoading: false,
  };
}
