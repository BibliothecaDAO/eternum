import {useMemo} from 'react';
import type {TradeOrder} from '../types';

// TODO: Replace with real data from Torii SQL trade queries
const MOCK_ORDERS: TradeOrder[] = [
  {
    tradeId: 101,
    makerId: 1001,
    makerName: 'Ironhold',
    takerGets: [{resourceId: 3, amount: 5000}],
    makerGets: [{resourceId: 29, amount: 2500}],
    ratio: 2.0,
    perLords: 0.5,
    expiresAt: Math.floor(Date.now() / 1000) + 3600 * 4,
    status: 'open',
    isOwn: true,
  },
  {
    tradeId: 102,
    makerId: 1002,
    makerName: 'Sunspire',
    takerGets: [{resourceId: 7, amount: 1000}],
    makerGets: [{resourceId: 1, amount: 8000}],
    ratio: 0.125,
    perLords: 1.6,
    expiresAt: Math.floor(Date.now() / 1000) + 3600 * 2,
    status: 'open',
    isOwn: false,
  },
  {
    tradeId: 103,
    makerId: 1003,
    makerName: 'Thornwatch',
    takerGets: [{resourceId: 9, amount: 500}],
    makerGets: [{resourceId: 29, amount: 940}],
    ratio: 0.53,
    perLords: 1.88,
    expiresAt: Math.floor(Date.now() / 1000) + 3600 * 8,
    status: 'open',
    isOwn: false,
  },
  {
    tradeId: 104,
    makerId: 1001,
    makerName: 'Ironhold',
    takerGets: [{resourceId: 12, amount: 200}],
    makerGets: [{resourceId: 4, amount: 3000}],
    ratio: 0.067,
    perLords: 2.22,
    expiresAt: Math.floor(Date.now() / 1000) + 3600 * 1,
    status: 'open',
    isOwn: true,
  },
  {
    tradeId: 105,
    makerId: 1004,
    makerName: 'Mistral Bay',
    takerGets: [{resourceId: 5, amount: 3000}],
    makerGets: [{resourceId: 29, amount: 2190}],
    ratio: 1.37,
    perLords: 0.73,
    expiresAt: Math.floor(Date.now() / 1000) - 1800,
    status: 'expired',
    isOwn: false,
  },
];

export function useTradeOrders() {
  const orders = useMemo(() => MOCK_ORDERS, []);

  const openOrders = useMemo(
    () => orders.filter(o => o.status === 'open'),
    [orders],
  );

  const myOrders = useMemo(
    () => orders.filter(o => o.isOwn),
    [orders],
  );

  const availableOrders = useMemo(
    () => orders.filter(o => o.status === 'open' && !o.isOwn),
    [orders],
  );

  return {
    orders,
    openOrders,
    myOrders,
    availableOrders,
    totalCount: orders.length,
    isLoading: false,
  };
}
