export type RealmMetadata = {
  name: string;
  description: string;
  image: string;
  attributes: {
    trait_type: string;
    value: string | number;
  }[];
};

export interface MergedNftData {
  metadata: RealmMetadata | null;
  minPrice?: bigint | null;
  marketplaceOwner?: string | null;
  order_id?: number | null;
  expiration: number | null;
  account_address?: string | null;
  order_owner?: string | null;
  best_price_hex?: bigint | null;
  token_id: string | number;
  contract_address: string;
  name?: string | null;
  collection_floor_price?: bigint | null;
}
