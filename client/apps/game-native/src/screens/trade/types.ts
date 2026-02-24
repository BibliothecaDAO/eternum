export type OrderStatus = 'open' | 'filled' | 'expired' | 'cancelled';
export type SwapDirection = 'buy' | 'sell';
export type CaravanStatus = 'in_transit' | 'ready' | 'arrived';

export interface Resource {
  resourceId: number;
  amount: number;
}

export interface MarketPair {
  resourceId: number;
  resourceName: string;
  lordsReserve: number;
  resourceReserve: number;
  price: number; // Lords per unit
  change24h: number; // percentage
}

export interface TradeOrder {
  tradeId: number;
  makerId: number;
  makerName: string;
  takerGets: Resource[];
  makerGets: Resource[];
  ratio: number;
  perLords: number;
  expiresAt: number; // unix seconds
  status: OrderStatus;
  isOwn: boolean;
}

export interface CaravanInfo {
  caravanId: number;
  origin: {entityId: number; name: string; col: number; row: number};
  destination: {entityId: number; name: string; col: number; row: number};
  resources: Resource[];
  arrivalTime: number; // unix seconds
  status: CaravanStatus;
}

export interface SwapPreview {
  inputAmount: number;
  outputAmount: number;
  pricePerUnit: number;
  slippage: number;
  lpFee: number;
  ownerFee: number;
}
