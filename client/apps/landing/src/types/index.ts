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
  node: {
    tokenMetadata: {
      __typename: "ERC721__Token";
      tokenId: string;
      metadataDescription?: string | null;
      imagePath: string;
      contractAddress: string;
      metadata: string;
    };
  };
  minPrice: bigint | null;
  marketplaceOwner: string | null;
  orderId: string | null;
  expiration: string | null;
  owner: string | null;
}
