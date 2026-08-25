import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  ChainId,
  CollectionAddresses,
  Collections,
} from "@realms-world/constants";

const SUPPORTED_L1_CHAIN_ID =
  process.env.VITE_PUBLIC_CHAIN === "sepolia"
    ? ChainId.SEPOLIA
    : ChainId.MAINNET;

const ALCHEMY_API_URL = `https://eth-${
  process.env.VITE_PUBLIC_CHAIN === "sepolia" ? "sepolia" : "mainnet"
}.g.alchemy.com/nft/v3/${process.env.VITE_ALCHEMY_API_KEY}`;

const L1_REALMS_STALE_TIME_MS = 60_000;

/* -------------------------------------------------------------------------- */
/*                          getL1Realms Endpoint                              */
/* -------------------------------------------------------------------------- */

const GetL1RealmsInput = z.object({
  address: z.string().optional(),
});

// Alchemy NFT response types
interface AlchemyNFT {
  tokenId: string;
  name?: string;
  title?: string;
  balance?: string;
  image?: {
    originalUrl?: string;
  };
  media?: {
    gateway?: string;
  }[];
  contract: {
    address: string;
    name?: string;
    symbol?: string;
  };
  raw?: {
    metadata?: {
      attributes?: Record<string, unknown>[];
    };
  };
}

interface AlchemyNFTsResponse {
  ownedNfts: AlchemyNFT[];
  totalCount: number;
  pageKey?: string;
}

interface TokenResponse {
  tokens: {
    token: {
      tokenId: string;
      name?: string | null;
      image?: string | null;
      collection: {
        id: string;
        name?: string;
        symbol?: string;
      };
      attributes: unknown[];
    };
    ownership: {
      tokenCount: string;
      acquiredAt: null;
    };
  }[];
  continuation: string | null;
}

export const getL1Realms = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => GetL1RealmsInput.parse(input))
  .handler(async (ctx) => {
    if (!ctx.data.address) {
      return { tokens: [], continuation: null } as TokenResponse;
    }

    const contractAddress =
      CollectionAddresses[Collections.REALMS][SUPPORTED_L1_CHAIN_ID];

    const response = await fetch(
      `${ALCHEMY_API_URL}/getNFTsForOwner?owner=${ctx.data.address.toLowerCase()}&contractAddresses[]=${contractAddress}&withMetadata=true&pageSize=100`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch NFTs: ${response.statusText}`);
    }

    const data = (await response.json()) as AlchemyNFTsResponse;

    // Transform Alchemy response to match expected format
    const tokens = data.ownedNfts.map((nft) => ({
      token: {
        tokenId: nft.tokenId,
        name: nft.name ?? nft.title ?? null,
        image: nft.image?.originalUrl ?? nft.media?.[0]?.gateway ?? null,
        collection: {
          id: nft.contract.address,
          name: nft.contract.name,
          symbol: nft.contract.symbol,
        },
        attributes: nft.raw?.metadata?.attributes ?? [],
      },
      ownership: {
        tokenCount: nft.balance ?? "1",
        acquiredAt: null,
      },
    }));

    return {
      tokens,
      continuation: data.pageKey ?? null,
    } as TokenResponse;
  });

export const getL1RealmsQueryOptions = (
  input?: z.infer<typeof GetL1RealmsInput>,
) => {
  return queryOptions({
    queryKey: ["getL1Realms", input?.address],
    queryFn: () =>
      input?.address != undefined ? getL1Realms({ data: input }) : null,
    staleTime: L1_REALMS_STALE_TIME_MS,
    refetchInterval: false,
    enabled: !!input?.address,
  });
};

interface CollectionResponse {
  collections: {
    collection: {
      id: string;
      name: string;
    };
    ownership: {
      tokenCount: string;
    };
  }[];
}

export const getL1UsersRealms = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => GetL1RealmsInput.parse(input))
  .handler(async (ctx) => {
    if (!ctx.data.address) {
      return { collections: [] };
    }

    const contractAddress =
      CollectionAddresses[Collections.REALMS][SUPPORTED_L1_CHAIN_ID];

    const response = await fetch(
      `${ALCHEMY_API_URL}/getNFTsForOwner?owner=${ctx.data.address.toLowerCase()}&contractAddresses[]=${contractAddress}&withMetadata=false&pageSize=1`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch NFTs: ${response.statusText}`);
    }

    const data = (await response.json()) as AlchemyNFTsResponse;

    // Transform to match expected format for collection summary
    const hasNFTs = data.totalCount > 0;
    const collections =
      hasNFTs && contractAddress
        ? [
            {
              collection: {
                id: contractAddress,
                name: "Realms",
              },
              ownership: {
                tokenCount: data.totalCount.toString(),
              },
            },
          ]
        : [];

    return { collections } as CollectionResponse;
  });

export const getL1UsersRealmsQueryOptions = (
  input?: z.infer<typeof GetL1RealmsInput>,
) =>
  queryOptions({
    queryKey: ["getL1UsersRealms", input?.address],
    queryFn: () =>
      input?.address != undefined ? getL1UsersRealms({ data: input }) : null,
    enabled: !!input?.address,
  });
