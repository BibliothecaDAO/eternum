export type RealmMetadata = {
  name: string;
  description: string;
  image: string;
  attributes: {
    trait_type: string;
    value: string | number;
  }[];
};

export type SeasonPassMint = {
  node: {
    __typename?: "Token__Balance";
    tokenMetadata: {
      __typename: "ERC721__Token";
      tokenId: string;
      metadataDescription: string;
      imagePath: string;
      contractAddress: string;
      metadata: string;
    };
  };
} | null;

export interface MarketOrder {
  active: boolean;
  token_id: string;
  collection_id: string;
  owner: string;
  price: string;
  expiration: string;
}

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
}
