// Types for chest opening feature

export interface RealmMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

export interface MergedNftData {
  token_id: string;
  balance?: string;
  contract_address?: string;
  account_address?: string;
  name?: string | null;
  symbol?: string | null;
  expiration?: number | null;
  best_price_hex?: bigint | null;
  metadata?: RealmMetadata | null;
  order_id?: string | null;
  collection_floor_price?: string;
}

export interface TokenBalanceWithToken {
  token_id: string;
  balance: string;
  contract_address: string;
  account_address: string;
  name: string | null;
  symbol: string | null;
  expiration: number | null;
  best_price_hex: bigint | null;
  metadata: RealmMetadata | null;
  order_id?: string | null;
  /** Count of items with same metadata (when grouped) */
  count?: number;
}

export interface CollectibleClaimed {
  token_id: string;
  metadata: string | RealmMetadata | null;
  timestamp: string;
  token_address: string;
  token_recipient: string;
}
