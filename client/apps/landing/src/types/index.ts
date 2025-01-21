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
