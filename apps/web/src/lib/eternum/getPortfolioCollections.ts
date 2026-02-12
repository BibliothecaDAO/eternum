//import type { AccountTokensApiResponse } from "@/types/ark";
import { graphql } from "@/gql/eternum";
import {
  formatAddress,
  SUPPORTED_L2_CHAIN_ID,
  trimAddress,
} from "@/utils/utils";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  CollectionAddresses,
  marketplaceCollections,
} from "@realms-world/constants";

import { fetchSQL } from "./apiClient";
import { QUERIES } from "./queries";

// Raw type for data fetched by fetchTokenBalancesWithMetadata
export interface RawTokenBalanceWithMetadata {
  token_id: string;
  balance: string;
  contract_address: string;
  token_owner: string; // This is account_address in the final type
  name?: string;
  symbol?: string;
  expiration?: number;
  best_price_hex?: string; // Raw hex string for bigint
  metadata?: string; // Raw JSON string
  order_id?: string;
}

/* -------------------------------------------------------------------------- */
/*                             getAccountTokens Endpoint                             */
/* -------------------------------------------------------------------------- */

const GetAccountTokensInput = z.object({
  address: z.string().optional(),
  collectionAddress: z.string().optional(),
  itemsPerPage: z.number().optional(),
  page: z.number().optional(),
});

export const getAccountTokens = createServerFn({ method: "GET" })
  .validator((input: unknown) => GetAccountTokensInput.parse(input))
  .handler(async (ctx) => {
    const {
      address,
      collectionAddress,
      /*itemsPerPage = 100,
      page = 1,*/
    } = ctx.data;
    /*const queryParams = [
      `items_per_page=${itemsPerPage}`,
      `page=${page}`,
      collectionAddress ? `collection=${collectionAddress}` : null,
    ]
      .filter(Boolean)
      .join("&");*/

    /*const response = await executeTorii(GET_ACCOUNT_TOKENS, {
      address: formatAddress(address),
    });
    console.log(response?.tokenBalances?.edges.length);
    return (
      response.tokenBalances?.edges.filter((edge) => {
        return (
          edge.node.tokenMetadata.__typename === "ERC721__Token" &&
          formatAddress(edge.node.tokenMetadata.contractAddress) ===
            (CollectionAddresses.realms[SUPPORTED_L2_CHAIN_ID] as string)
        );
      }) ?? []
    );*/
    const collectionId =
      marketplaceCollections.realms.id[SUPPORTED_L2_CHAIN_ID];
    const query = QUERIES.TOKEN_BALANCES_WITH_METADATA.replaceAll(
      "{contractAddress}",
      trimAddress(collectionAddress),
    )
      .replace("{collectionId}", collectionId.toString())
      .replace("{accountAddress}", address ?? "")
      .replace("{trimmedAccountAddress}", trimAddress(address ?? ""));

    try {
      const result = await fetchSQL<RawTokenBalanceWithMetadata[]>(query);
      const resultsWithParsedTokenId = result.map((r) => ({
        ...r,
        token_id: Number.parseInt(r.token_id.split(":")[1] ?? "0", 16) || 0,
      }));
      return resultsWithParsedTokenId;
    } catch {
      return [];
    }
  });

export const getAccountTokensQueryOptions = (
  input: z.infer<typeof GetAccountTokensInput>,
) =>
  queryOptions({
    queryKey: [
      "getAccountTokens",
      input.address,
      input.collectionAddress,
      input.page,
      input.itemsPerPage,
    ],
    queryFn: () =>
      input.address
        ? getAccountTokens({
            data: {
              address: input.address,
              collectionAddress: input.collectionAddress,
            },
          })
        : null,
    enabled: !!input.address,
  });
